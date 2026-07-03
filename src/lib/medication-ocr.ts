import { geminiModel } from "@/services/gemini";
import type { MedicationExtraction, MedicationOcrResult } from "@/types";

/**
 * Gemini prompt for medication label extraction.
 * Tailored for elderly patients in Singapore — extracts medication name,
 * purpose in plain language, and dosage frequency from printed labels.
 */
export const MEDICATION_EXTRACTION_PROMPT = `You are a medication label reader for elderly patients in Singapore.

Analyse the provided medication label image and extract:
1. Medication name (brand name or generic name as printed)
2. Purpose/indication (what the medication is for, in simple plain language)
3. Dosage frequency (how often to take it, e.g., "Twice daily", "Once every morning")

IMPORTANT: 
- Only extract from PRINTED text on official labels.
- Provide the purpose in simple, plain language suitable for elderly patients.
- If you cannot identify a medication name, return null for medicationName.

Respond ONLY with a JSON object:
{
  "medicationName": "string or null",
  "purpose": "string - plain language explanation",
  "dosageFrequency": "string - how often to take",
  "confidence": 0.0 to 1.0
}`;

/** Confidence threshold — below this, OCR output is unreliable. */
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Extracts medication information from a printed label image using Gemini.
 * Uses a medication-specific prompt distinct from the document extraction prompt.
 *
 * @param imageBuffer - Raw image bytes (after handwriting check passes)
 * @param mimeType - Image MIME type
 * @returns MedicationOcrResult with structured medication data
 */
export async function extractMedicationInfo(
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<MedicationOcrResult> {
  try {
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const result = await geminiModel.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      { text: MEDICATION_EXTRACTION_PROMPT },
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON from Gemini response — strip markdown fences if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
      null,
      text,
    ];
    const jsonString = jsonMatch[1]?.trim() ?? text.trim();

    const parsed = JSON.parse(jsonString);

    // Apply Property 11: set missing fields to null/empty/0
    const extraction: MedicationExtraction = {
      medicationName: parsed.medicationName ?? null,
      purpose:
        typeof parsed.purpose === "string" ? parsed.purpose : "",
      dosageFrequency:
        typeof parsed.dosageFrequency === "string"
          ? parsed.dosageFrequency
          : "",
      confidence:
        typeof parsed.confidence === "number" &&
        parsed.confidence >= 0 &&
        parsed.confidence <= 1
          ? parsed.confidence
          : 0,
    };

    return {
      success: true,
      extraction,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      extraction: null,
      error:
        error instanceof Error
          ? error.message
          : "Medication extraction failed",
    };
  }
}

/**
 * Validates a MedicationExtraction object.
 * Returns true if medicationName is non-null and non-empty string.
 */
export function isValidMedicationExtraction(
  extraction: MedicationExtraction | null
): extraction is MedicationExtraction {
  if (extraction === null) return false;
  return (
    typeof extraction.medicationName === "string" &&
    extraction.medicationName.trim().length > 0
  );
}

/**
 * Determines if extraction confidence is below the safety threshold.
 * Threshold: 0.7
 * Below threshold means OCR output is unreliable — show warning to verify with pharmacist.
 */
export function isBelowConfidenceThreshold(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLD;
}
