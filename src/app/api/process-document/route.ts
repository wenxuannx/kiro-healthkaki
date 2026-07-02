import { NextRequest, NextResponse } from "next/server";
import { validateFile, validatePdfPageCount } from "@/lib/file-validator";
import { processDocument } from "@/lib/ocr-pipeline";
import { lookupSubsidies } from "@/lib/subsidy-lookup";
import { translateBatch, NON_ENGLISH_LANGUAGES } from "@/lib/translator";
import { createClient } from "@/services/supabase/server";
import {
  FileValidationError,
  NricRedactionError,
  OcrExtractionError,
  TimeoutError,
} from "@/types";
import type {
  ExtractedPrescription,
  ProcessDocumentResponse,
  SubsidyLookupParams,
} from "@/types";

const PROCESSING_TIMEOUT_MS = 60_000; // 60s — Gemini can be slow on cold starts

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
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
    const birthYearValue = formData.get("birthYear");
    const clinicTypeValue = formData.get("clinicType");
    const chronicConditionsValue = formData.get("chronicConditions");
    const birthYearRaw = typeof birthYearValue === "string" ? birthYearValue : null;
    const clinicTypeRaw = typeof clinicTypeValue === "string" ? clinicTypeValue : null;
    const chronicConditionsRaw = typeof chronicConditionsValue === "string" ? chronicConditionsValue : null;

    const parsedBirthYear = birthYearRaw ? Number(birthYearRaw) : undefined;
    const currentYear = new Date().getFullYear();
    const birthYear = Number.isInteger(parsedBirthYear) && parsedBirthYear! >= 1900 && parsedBirthYear! <= currentYear
      ? parsedBirthYear
      : undefined;
    const clinicTypes = ["public_hospital", "polyclinic", "gp_clinic"] as const;
    const clinicType = clinicTypes.find((type) => type === clinicTypeRaw);

    // --- Parse optional citizenship/income fields (used for CHAS tier and
    // Pioneer/Merdeka Generation eligibility, and citizenship-gated schemes) ---
    const citizenshipStatusValue = formData.get("citizenshipStatus");
    const citizenshipYearValue = formData.get("citizenshipYear");
    const incomePerCapitaValue = formData.get("incomePerCapita");

    const citizenshipStatuses = ["citizen", "pr", "foreigner"] as const;
    const citizenshipStatusRaw =
      typeof citizenshipStatusValue === "string" ? citizenshipStatusValue : null;
    const citizenshipStatus = citizenshipStatuses.find(
      (status) => status === citizenshipStatusRaw
    );

    const citizenshipYearRaw =
      typeof citizenshipYearValue === "string" ? Number(citizenshipYearValue) : undefined;
    const citizenshipYear =
      Number.isInteger(citizenshipYearRaw) && citizenshipYearRaw! >= 1900 && citizenshipYearRaw! <= currentYear
        ? citizenshipYearRaw
        : undefined;

    const incomePerCapitaRaw =
      typeof incomePerCapitaValue === "string" ? Number(incomePerCapitaValue) : undefined;
    const incomePerCapita =
      incomePerCapitaRaw !== undefined && Number.isFinite(incomePerCapitaRaw) && incomePerCapitaRaw >= 0
        ? incomePerCapitaRaw
        : undefined;

    let chronicConditions: string[] = [];
    if (chronicConditionsRaw) {
      try {
        const parsed: unknown = JSON.parse(chronicConditionsRaw);
        chronicConditions = Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 50)
          : [];
      } catch {
        // Ignore malformed chronicConditions — proceed without them
      }
    }

    // --- Processing pipeline with timeout ---
    const processingPromise = async (): Promise<ProcessDocumentResponse> => {
      // Step 1: OCR extraction + NRIC redaction (handled internally by processDocument)
      const { extracted } = await processDocument(fileBuffer, file.type);

      // Step 1.25: Translate prescription frequency + instructions into the
      // non-English languages for multilingual display/TTS. Runs AFTER NRIC
      // redaction so no unredacted text is ever sent for translation.
      // Non-fatal: on failure the fields stay untranslated (English fallback).
      if (extracted.prescriptions.length > 0) {
        try {
          const translated = await translateBatch(
            extracted.prescriptions.map((p) => ({
              frequency: p.frequency ?? "",
              instructions: p.instructions ?? "",
            }))
          );
          extracted.prescriptions = extracted.prescriptions.map((p, i) => {
            const perLang = translated[i];
            const translations: NonNullable<
              ExtractedPrescription["translations"]
            > = { "en-SG": null, "cmn-Hans-CN": null, "ms-MY": null, "ta-IN": null };
            for (const lang of NON_ENGLISH_LANGUAGES) {
              const fields = perLang[lang];
              if (!fields) continue;
              translations[lang] = {
                // Only surface a translation for fields that had source text.
                frequency: p.frequency ? fields.frequency : null,
                instructions: p.instructions ? fields.instructions : null,
              };
            }
            return { ...p, translations };
          });
        } catch (translateError) {
          console.error(
            "[process-document] Prescription translation failed (non-fatal):",
            translateError
          );
        }
      }

      // Step 1.5: Persist the file + extraction to Supabase — non-fatal on failure,
      // since the extraction result is still valuable even if persistence fails.
      try {
        const supabase = await createClient();
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileName, fileBuffer, { contentType: file.type });

        if (uploadError) {
          console.error("[process-document] Supabase storage upload failed (non-fatal):", uploadError);
        } else {
          const { error: dbError } = await supabase.from("document_submissions").insert({
            storage_path: uploadData.path,
            medical_codes: extracted.medicalCodes,
            diagnoses: extracted.diagnoses,
            visit_date: extracted.visitDate,
            institution: extracted.institution,
            raw_text: extracted.rawText,
          });

          if (dbError) {
            console.error("[process-document] Supabase insert into document_submissions failed (non-fatal):", dbError);
          }
        }
      } catch (persistError) {
        console.error("[process-document] Document persistence failed (non-fatal):", persistError);
      }

      // Step 2: Subsidy lookup — gracefully handle failures
      let subsidies: ProcessDocumentResponse["subsidies"] = [];
      let message: string | null = null;
      let needsManualInput = false;

      try {
        const lookupParams: SubsidyLookupParams = {
          medicalCodes: extracted.medicalCodes,
          diagnoses: [
            ...extracted.diagnoses,
            ...chronicConditions,
          ],
          claimedSubsidies: extracted.claimedSubsidies,
          institution: extracted.institution,
          birthYear,
          clinicType: clinicType || undefined,
          citizenshipStatus,
          citizenshipYear,
          incomePerCapita,
        };

        const lookupResult = await lookupSubsidies(lookupParams);
        subsidies = lookupResult.subsidies;
        message = lookupResult.message;
        needsManualInput = lookupResult.needsManualInput;
      } catch (subsidyError) {
        // Subsidy lookup failure should NOT crash the whole request.
        // The OCR extraction is the valuable part — return it with empty subsidies.
        console.error("[process-document] Subsidy lookup failed (non-fatal):", subsidyError);
        message = "Subsidy lookup is temporarily unavailable. Your document was processed successfully.";
        needsManualInput = false;
      }

      return {
        extracted,
        subsidies,
        message,
        needsManualInput,
      };
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError("Processing timed out"));
      }, PROCESSING_TIMEOUT_MS);
    });

    const result = await Promise.race([processingPromise(), timeoutPromise]);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    // --- Error mapping with logging ---
    if (error instanceof FileValidationError) {
      console.error("[process-document] File validation error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof NricRedactionError) {
      console.error("[process-document] NRIC redaction error:", error.message);
      return NextResponse.json(
        { error: "Privacy protection failed - document rejected" },
        { status: 500 }
      );
    }

    if (error instanceof OcrExtractionError) {
      console.error("[process-document] OCR extraction error:", error.message);
      return NextResponse.json(
        { error: "Document extraction failed. Please try a clearer image." },
        { status: 500 }
      );
    }

    if (error instanceof TimeoutError) {
      console.error("[process-document] Timeout error:", error.message);
      return NextResponse.json(
        { error: "Processing timed out. Please try again." },
        { status: 504 }
      );
    }

    // Check for AbortSignal timeout (DOMException with name "TimeoutError")
    if (
      error instanceof Error &&
      error.name === "TimeoutError"
    ) {
      console.error("[process-document] AbortSignal timeout:", error.message);
      return NextResponse.json(
        { error: "Processing timed out. Please try again." },
        { status: 504 }
      );
    }

    // Unexpected errors
    console.error("[process-document] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
