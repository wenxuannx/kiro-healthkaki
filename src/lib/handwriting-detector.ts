import { geminiModel } from "@/services/gemini";
import type { HandwritingDetectionResult } from "@/types";

/**
 * Prompt used to detect handwriting in medication label images.
 * Requirements: 9.4, 9.5, 9.6, 9.7
 */
export const HANDWRITING_DETECTION_PROMPT = `Analyse this medication label image.
Determine if the label contains ANY handwritten text (cursive, block letters written by hand, 
or any non-printed text). Focus on dosage instructions, medication names, and notes.

Respond ONLY with a JSON object:
{
  "isHandwritten": true/false,
  "confidence": 0.0 to 1.0,
  "reason": "description of what was detected or null"
}

IMPORTANT: Err on the side of caution. If there is ANY doubt about whether text is 
handwritten vs printed, classify it as handwritten for patient safety.`;

/**
 * Fail-safe default when Gemini response cannot be parsed.
 * Defaults to handwritten=true for patient safety.
 */
const PARSE_FAILURE_DEFAULT: HandwritingDetectionResult = {
  isHandwritten: true,
  confidence: 1.0,
  reason: "Parse failure - defaulting to handwritten for safety",
};

/**
 * Detects whether a medication label image contains handwritten text.
 * Uses Gemini 1.5 Flash for vision analysis.
 *
 * Errs on the side of caution: if any doubt or parse failure occurs,
 * classifies as handwritten for patient safety.
 *
 * @param imageBuffer - The image data as an ArrayBuffer
 * @param mimeType - The MIME type of the image (e.g., "image/jpeg")
 * @returns Structured detection result
 *
 * Requirements: 9.4, 9.5, 9.6, 9.7
 */
export async function detectHandwriting(
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<HandwritingDetectionResult> {
  const base64Data = Buffer.from(imageBuffer).toString("base64");

  const result = await geminiModel.generateContent([
    HANDWRITING_DETECTION_PROMPT,
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
  ]);

  const response = result.response;
  const text = response.text();

  return parseHandwritingResponse(text);
}

/**
 * Parses the Gemini response text into a HandwritingDetectionResult.
 * Handles markdown code fences and malformed JSON gracefully.
 * On any parse failure, defaults to isHandwritten=true for safety.
 */
export function parseHandwritingResponse(
  text: string
): HandwritingDetectionResult {
  try {
    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      // Remove opening fence (with optional language identifier)
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
      // Remove closing fence
      cleaned = cleaned.replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (typeof parsed.isHandwritten !== "boolean") {
      return PARSE_FAILURE_DEFAULT;
    }

    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 1.0;

    const reason =
      parsed.reason === null || parsed.reason === "null"
        ? null
        : typeof parsed.reason === "string"
          ? parsed.reason
          : null;

    return {
      isHandwritten: parsed.isHandwritten,
      confidence,
      reason,
    };
  } catch {
    // On ANY parse failure, default to handwritten for patient safety
    return PARSE_FAILURE_DEFAULT;
  }
}
