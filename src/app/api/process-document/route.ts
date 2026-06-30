import { NextRequest, NextResponse } from "next/server";
import { validateFile, validatePdfPageCount } from "@/lib/file-validator";
import { processDocument } from "@/lib/ocr-pipeline";
import { lookupSubsidies } from "@/lib/subsidy-lookup";
import {
  FileValidationError,
  NricRedactionError,
  OcrExtractionError,
  SubsidyLookupError,
  TimeoutError,
} from "@/types";
import type { ProcessDocumentResponse, SubsidyLookupParams } from "@/types";

const PROCESSING_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // --- File Validation ---
    const validationResult = validateFile(file);
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    // Read file buffer for further processing
    const fileBuffer = await file.arrayBuffer();

    // PDF-specific page count check
    if (file.type === "application/pdf") {
      const pdfResult = validatePdfPageCount(fileBuffer);
      if (!pdfResult.valid) {
        return NextResponse.json(
          { error: pdfResult.error },
          { status: 400 }
        );
      }
    }

    // --- Parse optional manual fallback fields ---
    const birthYearRaw = formData.get("birthYear") as string | null;
    const clinicTypeRaw = formData.get("clinicType") as string | null;
    const chronicConditionsRaw = formData.get("chronicConditions") as string | null;

    const birthYear = birthYearRaw ? parseInt(birthYearRaw, 10) : undefined;
    const clinicType = clinicTypeRaw as
      | "public_hospital"
      | "polyclinic"
      | "gp_clinic"
      | undefined;

    let chronicConditions: string[] = [];
    if (chronicConditionsRaw) {
      try {
        chronicConditions = JSON.parse(chronicConditionsRaw);
      } catch {
        // Ignore malformed chronicConditions — proceed without them
      }
    }

    // --- Processing pipeline with timeout ---
    const processingPromise = async (): Promise<ProcessDocumentResponse> => {
      // Step 1: OCR extraction + NRIC redaction (handled internally by processDocument)
      const { extracted } = await processDocument(fileBuffer, file.type);

      // Step 2: Subsidy lookup
      const lookupParams: SubsidyLookupParams = {
        medicalCodes: extracted.medicalCodes,
        diagnoses: [
          ...extracted.diagnoses,
          ...chronicConditions,
        ],
        institution: extracted.institution,
        birthYear: !isNaN(birthYear as number) ? birthYear : undefined,
        clinicType: clinicType || undefined,
      };

      const lookupResult = await lookupSubsidies(lookupParams);

      return {
        extracted,
        subsidies: lookupResult.subsidies,
        message: lookupResult.message,
        needsManualInput: lookupResult.needsManualInput,
      };
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError("Processing timed out"));
      }, PROCESSING_TIMEOUT_MS);
    });

    const result = await Promise.race([processingPromise(), timeoutPromise]);

    // Image data is now out of scope — stateless, nothing persisted
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    // --- Error mapping ---
    if (error instanceof FileValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof NricRedactionError) {
      return NextResponse.json(
        { error: "Privacy protection failed - document rejected" },
        { status: 500 }
      );
    }

    if (error instanceof OcrExtractionError) {
      return NextResponse.json(
        { error: "Document extraction failed" },
        { status: 500 }
      );
    }

    if (error instanceof SubsidyLookupError) {
      return NextResponse.json(
        { error: "Subsidy lookup failed" },
        { status: 500 }
      );
    }

    if (error instanceof TimeoutError) {
      return NextResponse.json(
        { error: "Processing timed out" },
        { status: 504 }
      );
    }

    // Check for AbortSignal timeout (DOMException with name "TimeoutError")
    if (
      error instanceof Error &&
      error.name === "TimeoutError"
    ) {
      return NextResponse.json(
        { error: "Processing timed out" },
        { status: 504 }
      );
    }

    // Unexpected errors
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
