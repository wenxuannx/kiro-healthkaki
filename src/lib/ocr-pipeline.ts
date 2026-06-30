/**
 * OCR Pipeline Module
 *
 * Stateless document processing pipeline:
 * 1. Convert image buffer to base64
 * 2. Send to Gemini with document extraction prompt
 * 3. Parse structured JSON response (with fallback for malformed JSON)
 * 4. Apply NRIC redaction to all text fields
 * 5. Return redacted extraction result
 *
 * Image data is discarded after Gemini response — never persisted.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.11, 3.3, 4.1, 4.2
 */

import type { RawExtractedData, RedactedExtractedData } from "@/types";
import { OcrExtractionError } from "@/types";
import { redactExtractedData } from "@/lib/nric-redactor";
import { geminiModel } from "@/services/gemini";

const EXTRACTION_PROMPT = `You are a medical document reader for a Singapore healthcare assistant application.

Analyse the provided medical document image and extract the following information:
1. Medical codes (ICD-10, SNOMED, or local clinic codes found on the document)
2. Diagnoses or condition names mentioned
3. Date of visit (in YYYY-MM-DD format if identifiable)
4. Healthcare institution name
5. Full text content of the document

IMPORTANT:
- If you find any NRIC numbers (format: one letter S/T/F/G followed by 7 digits followed by one letter), replace them with [REDACTED].
- If a field cannot be identified, use null for single values or an empty array for lists.
- Return ONLY a JSON object with no additional text or explanation.

Respond with this exact JSON structure:
{
  "medicalCodes": ["string array of codes found"],
  "diagnoses": ["string array of diagnoses/conditions"],
  "visitDate": "YYYY-MM-DD or null",
  "institution": "institution name or null",
  "rawText": "full text content of the document"
}`;

/**
 * Checks whether an extraction result is empty (all fields null/empty).
 * Used to detect cases where Gemini could not extract meaningful data.
 */
function isEmptyExtraction(data: RawExtractedData): boolean {
  const hasNoCodes =
    !data.medicalCodes || data.medicalCodes.length === 0;
  const hasNoDiagnoses =
    !data.diagnoses || data.diagnoses.length === 0;
  const hasNoVisitDate = !data.visitDate;
  const hasNoInstitution = !data.institution;

  return hasNoCodes && hasNoDiagnoses && hasNoVisitDate && hasNoInstitution;
}

/**
 * Parses a JSON response from Gemini, handling markdown code fences
 * and other common wrapping patterns.
 */
function parseGeminiResponse(responseText: string): RawExtractedData {
  let cleaned = responseText.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  if (cleaned.startsWith("```")) {
    // Remove opening fence (with optional language identifier)
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    // Remove closing fence
    cleaned = cleaned.replace(/\n?```\s*$/, "");
  }

  cleaned = cleaned.trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: try to find a JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new OcrExtractionError(
          "Failed to parse OCR response: invalid JSON"
        );
      }
    } else {
      throw new OcrExtractionError(
        "Failed to parse OCR response: no JSON object found"
      );
    }
  }

  // Normalize fields with safe defaults
  const data: RawExtractedData = {
    medicalCodes: Array.isArray(parsed.medicalCodes)
      ? (parsed.medicalCodes as string[]).filter(
          (c) => typeof c === "string"
        )
      : [],
    diagnoses: Array.isArray(parsed.diagnoses)
      ? (parsed.diagnoses as string[]).filter(
          (d) => typeof d === "string"
        )
      : [],
    visitDate:
      typeof parsed.visitDate === "string" ? parsed.visitDate : null,
    institution:
      typeof parsed.institution === "string" ? parsed.institution : null,
    rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
  };

  return data;
}

/**
 * Full OCR pipeline: extract via Gemini → parse → redact → return.
 *
 * Image data is NOT persisted at any point. The fileBuffer reference
 * is only used to create the base64 string for the Gemini API call,
 * and is discarded after the response is received.
 *
 * @param fileBuffer - The raw image bytes
 * @param mimeType - The MIME type of the image (e.g., "image/jpeg")
 * @returns Object containing the redacted extracted data
 * @throws OcrExtractionError if extraction fails or produces empty results
 * @throws NricRedactionError if redaction fails (fail-closed)
 */
export async function processDocument(
  fileBuffer: ArrayBuffer,
  mimeType: string
): Promise<{ extracted: RedactedExtractedData }> {
  // Convert ArrayBuffer to base64
  const base64Data = Buffer.from(fileBuffer).toString("base64");

  // Send to Gemini with extraction prompt
  const result = await geminiModel.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    { text: EXTRACTION_PROMPT },
  ]);

  // Image data is now discarded — only the text response is retained
  const response = result.response;
  const responseText = response.text();

  if (!responseText) {
    throw new OcrExtractionError(
      "OCR extraction failed: empty response from Gemini"
    );
  }

  // Parse the JSON response
  const rawData = parseGeminiResponse(responseText);

  // Check for empty extraction (Requirement 2.6)
  if (isEmptyExtraction(rawData)) {
    throw new OcrExtractionError(
      "Document could not be read. Please retake the photo with better lighting or angle."
    );
  }

  // Apply NRIC redaction (Layer 2 — deterministic regex safety net)
  // This throws NricRedactionError on failure (fail-closed)
  const redactedData = redactExtractedData(rawData);

  return { extracted: redactedData };
}
