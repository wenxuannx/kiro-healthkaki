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

import type { DocumentTypeId, RawExtractedData, RedactedExtractedData } from "@/types";
import { OcrExtractionError } from "@/types";
import { redactExtractedData } from "@/lib/nric-redactor";
import { geminiModel } from "@/services/gemini";
import { extractMedicationInfo } from "@/lib/medication-ocr";

const DOCUMENT_TYPES: DocumentTypeId[] = ["invoice", "referral", "prescription"];

// Gemini sometimes returns a synonym or human-readable label instead of the
// exact enum string despite prompt instructions — normalize common variants
// before falling back to null.
const DOCUMENT_TYPE_SYNONYMS: Record<string, DocumentTypeId> = {
  referral: "referral",
  "referral letter": "referral",
  "referral notes": "referral",
  "referral note": "referral",
  invoice: "invoice",
  bill: "invoice",
  receipt: "invoice",
  prescription: "prescription",
  "prescription slip": "prescription",
  "medication slip": "prescription",
};

function normalizeDocumentType(value: unknown): DocumentTypeId | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (DOCUMENT_TYPES.includes(key as DocumentTypeId)) {
    return key as DocumentTypeId;
  }
  return DOCUMENT_TYPE_SYNONYMS[key] ?? null;
}

const PRESCRIPTION_FOLLOW_UP_PROMPT = `Act as a prescription OCR reader. Inspect the original medical document carefully, including tables, medication-order sections, discharge medication lists, and small printed labels. Extract every medication that is explicitly printed.

Return ONLY a JSON array. Each item must have this shape:
{
  "medicationName": "printed name",
  "dosage": "printed strength or dose, or null",
  "frequency": "printed frequency, or null",
  "instructions": "other printed directions, or null",
  "purpose": "plain-language explanation of what this medication is for, or null"
}

Medication names may be brand or generic names. A strength such as "500 mg" belongs in dosage — including when it appears inside a longer printed item description (e.g. "AUGMENTIN 625MG TABLET" → medicationName "Augmentin", dosage "625mg"), not left stuck inside medicationName. Directions such as "take one tablet twice daily after food" should be split between frequency and instructions when possible.

purpose is almost never printed on the document — infer it from your own medical knowledge of the drug (generic or brand name), in one short plain-English phrase suitable for an elderly patient (e.g. "Antibiotic for bacterial infection", "Lowers blood pressure", "Relieves pain and fever"). Only use null if you cannot identify the medication well enough to know what it treats.

On a bill/invoice, an "Item Name" / "Quantity" / "UOM" table lists what was dispensed, not how to take it — the Quantity/UOM columns (e.g. "14 Tablet") are the count sold, NOT the dosage or frequency. Never put a dispensed quantity into dosage or frequency. Bills typically print no dosing schedule at all; leave frequency and instructions null rather than guessing when the document has no such directions printed.

Do not infer or invent medication details. Do not return diagnoses, procedures, or allergies as medications. Return [] only when the document contains no prescription or medication-order entries.`;

const EXTRACTION_PROMPT = `You are a medical document reader for a Singapore healthcare assistant application.

Analyse the provided medical document image and extract the following information:
1. Medical codes (ICD-10, SNOMED, or local clinic codes found on the document)
2. Diagnoses or condition names mentioned
3. Date of visit (in YYYY-MM-DD format if identifiable)
4. Healthcare institution name
5. Full text content of the document
6. Prescription medications, including the printed medication name, dosage, frequency, and instructions.
   A strength printed inside a longer item description (e.g. "AUGMENTIN 625MG TABLET" on a bill line
   item) belongs in dosage, not medicationName — split it out. On a bill, the Quantity/UOM columns
   (e.g. "14 Tablet") are the count dispensed, NOT a dosage or frequency; never put them there. Bills
   rarely print a dosing schedule — leave frequency/instructions null rather than guessing one.
   Also include a "purpose": a one-phrase plain-English explanation of what each medication is for,
   inferred from your own medical knowledge of the drug (it is almost never printed on the document
   itself) — e.g. "Antibiotic for bacterial infection", "Lowers blood pressure". Use null only if you
   cannot identify the medication well enough to know what it treats.
7. Printed bill total and line items, if this is a bill or invoice
8. Subsidy or payer claims itemised on the bill as a deduction from the total — lines such as
   "Claim from CHAS", "MediSave claim", "Claim from Medifund", "MediShield Life". Return only the
   payer/scheme name (e.g. "CHAS", "MediSave"), not the amount.
8b. The amount actually owed by the patient after any subsidy/insurance deductions, if printed —
    look for a line such as "Patient Total", "Amount Payable", "Balance Due", or "Nett Payable"
    that appears after subsidy/claim deduction lines. This is different from the pre-deduction
    total. Use null if the bill has no subsidy claim lines or this amount isn't printed.
9. Document type — classify as exactly one of the following lowercase string values (use the value on the left of the colon, not the description):
   - "invoice": a bill, receipt, or itemised charges for services/medication issued after a visit
   - "referral": contains a "Referral To" / "Referral Notes" section directing the patient to another institution, department, or specialist — regardless of the document's title or header
   - "prescription": a prescription or medication dispensing slip listing drug names and dosages
   Judge by the document's content and structure, not its printed title. Only use null if none of the above apply after reading the full content.

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
  "rawText": "full text content of the document",
  "prescriptions": [
    {
      "medicationName": "printed medication name",
      "dosage": "printed dosage or null",
      "frequency": "printed frequency or null",
      "instructions": "other printed directions or null",
      "purpose": "plain-language explanation of what this medication is for, or null"
    }
  ],
  "bill": {
    "currency": "SGD",
    "totalAmount": 120.50,
    "items": [{ "description": "printed line-item description", "amount": 20.00 }],
    "payableAmount": 42.76
  },
  "claimedSubsidies": ["string array of payer/subsidy names itemised as a claim on the bill, e.g. CHAS"],
  "documentType": "invoice|referral|prescription or null"
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
  const hasNoPrescriptions = !data.prescriptions || data.prescriptions.length === 0;
  const hasNoBill = !data.bill;
  const hasNoClaimedSubsidies = !data.claimedSubsidies || data.claimedSubsidies.length === 0;

  return hasNoCodes && hasNoDiagnoses && hasNoVisitDate && hasNoInstitution && hasNoPrescriptions && hasNoBill && hasNoClaimedSubsidies;
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
    prescriptions: Array.isArray(parsed.prescriptions)
      ? parsed.prescriptions.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const prescription = item as Record<string, unknown>;
          if (typeof prescription.medicationName !== "string" || !prescription.medicationName.trim()) return [];
          const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
          return [{
            medicationName: prescription.medicationName.trim(),
            dosage: optionalText(prescription.dosage),
            frequency: optionalText(prescription.frequency),
            instructions: optionalText(prescription.instructions),
            purpose: optionalText(prescription.purpose),
          }];
        })
      : [],
    bill: normalizeBill(parsed.bill),
    claimedSubsidies: Array.isArray(parsed.claimedSubsidies)
      ? (parsed.claimedSubsidies as unknown[])
          .filter((c): c is string => typeof c === "string" && c.trim() !== "")
          .map((c) => c.trim())
      : [],
    documentType: normalizeDocumentType(parsed.documentType),
  };

  if (data.documentType === null && parsed.documentType) {
    console.warn(`[ocr-pipeline] Unrecognized documentType from Gemini: ${JSON.stringify(parsed.documentType)}`);
  }

  return data;
}

function normalizeBill(value: unknown): RawExtractedData["bill"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const bill = value as Record<string, unknown>;
  const amount = (field: unknown) => {
    const parsed = typeof field === "number" ? field : typeof field === "string" ? Number(field.replace(/[^0-9.-]/g, "")) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const items = Array.isArray(bill.items) ? bill.items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const description = row.description ?? row.item ?? row.name;
    if (typeof description !== "string" || !description.trim()) return [];
    return [{ description: description.trim(), amount: amount(row.amount ?? row.price ?? row.total) }];
  }) : [];
  const totalAmount = amount(bill.totalAmount ?? bill.total_amount ?? bill.total);
  const payableAmount = amount(bill.payableAmount ?? bill.payable_amount ?? bill.patientTotal ?? bill.patient_total);
  if (totalAmount === null && items.length === 0) return null;
  return {
    currency: typeof bill.currency === "string" && bill.currency.trim() ? bill.currency.trim() : "SGD",
    totalAmount,
    items,
    payableAmount,
  };
}

function normalizePrescriptions(value: unknown): RawExtractedData["prescriptions"] {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>).prescriptions ?? (value as Record<string, unknown>).medications ?? value
    : value;
  const items = Array.isArray(candidate) ? candidate : [candidate];
  return items.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      return [{ medicationName: item.trim(), dosage: null, frequency: null, instructions: null, purpose: null }];
    }
    if (!item || typeof item !== "object") return [];
    const prescription = item as Record<string, unknown>;
    const name = prescription.medicationName ?? prescription.medication_name ?? prescription.medication ?? prescription.name ?? prescription.drugName ?? prescription.drug_name ?? prescription.drug;
    if (typeof name !== "string" || !name.trim()) return [];
    const optionalText = (field: unknown) => typeof field === "string" && field.trim() ? field.trim() : null;
    return [{
      medicationName: name.trim(),
      dosage: optionalText(prescription.dosage ?? prescription.dose ?? prescription.strength),
      frequency: optionalText(prescription.frequency ?? prescription.freq ?? prescription.schedule),
      instructions: optionalText(prescription.instructions ?? prescription.directions ?? prescription.sig ?? prescription.route),
      purpose: optionalText(prescription.purpose ?? prescription.indication),
    }];
  });
}

function extractPrescriptionsFromOcrText(rawText: string): RawExtractedData["prescriptions"] {
  const medicationSignal = /\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml)|tablet(?:s)?|capsule(?:s)?|caplet(?:s)?|take\s+\d+|once daily|twice daily|\b(?:od|bd|tds|qid|prn|mane|nocte)\b)\b/i;
  const nonMedicationSignal = /\b(?:blood pressure|body weight|height|glucose|hba1c|cholesterol|sodium|potassium|creatinine|haemoglobin|hemoglobin)\b/i;
  const seen = new Set<string>();

  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3 && line.length <= 240 && medicationSignal.test(line) && !nonMedicationSignal.test(line))
    .flatMap((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      const dosage = line.match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml)\b/i)?.[0] ?? null;
      const frequency = line.match(/\b(?:once daily|twice daily|three times daily|four times daily|every \d+ hours|as needed|od|bd|tds|qid|prn|mane|nocte)\b/i)?.[0] ?? null;
      // No LLM pass here (pure regex fallback), so purpose can't be inferred.
      return [{ medicationName: line, dosage, frequency, instructions: line, purpose: null }];
    })
    .slice(0, 30);
}

async function extractSingleMedication(base64Data: string, mimeType: string): Promise<RawExtractedData["prescriptions"]> {
  const imageBuffer = Uint8Array.from(Buffer.from(base64Data, "base64")).buffer;
  const result = await extractMedicationInfo(imageBuffer, mimeType);
  if (!result.success || !result.extraction?.medicationName?.trim()) return [];
  return [{
    medicationName: result.extraction.medicationName.trim(),
    dosage: null,
    frequency: result.extraction.dosageFrequency?.trim() || null,
    instructions: null,
    purpose: result.extraction.purpose?.trim() || null,
  }];
}

function parsePrescriptionResponse(responseText: string): RawExtractedData["prescriptions"] {
  const cleaned = responseText.trim().replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  try {
    return normalizePrescriptions(JSON.parse(cleaned));
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const json = arrayMatch?.[0] ?? objectMatch?.[0];
    return json ? normalizePrescriptions(JSON.parse(json)) : [];
  }
}

async function extractPrescriptionsFromImage(base64Data: string, mimeType: string): Promise<RawExtractedData["prescriptions"]> {
  try {
    const result = await geminiModel.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: PRESCRIPTION_FOLLOW_UP_PROMPT },
    ]);
    return parsePrescriptionResponse(result.response.text());
  } catch {
    console.error("[ocr-pipeline] Focused prescription image extraction failed");
    return [];
  }
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

  // Send to Gemini with extraction prompt (retry up to 3 times for transient errors)
  let responseText = "";
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
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
      responseText = response.text();
      break;
    } catch (geminiError) {
      const errMsg = geminiError instanceof Error ? geminiError.message : "Unknown Gemini error";
      console.error(`[ocr-pipeline] Gemini API call failed (attempt ${attempt}/${MAX_RETRIES}):`, errMsg);

      // Retry on 503 (high demand) or 429 (rate limit) errors
      const isRetryable = errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("high demand") || errMsg.includes("overloaded");
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw new OcrExtractionError(
          `OCR extraction failed: Gemini API error — ${errMsg}`
        );
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`[ocr-pipeline] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (!responseText) {
    throw new OcrExtractionError(
      "OCR extraction failed: empty response from Gemini"
    );
  }

  // Parse the JSON response
  let rawData;
  try {
    rawData = parseGeminiResponse(responseText);
  } catch (parseError) {
    console.error("[ocr-pipeline] Failed to parse Gemini response");
    throw parseError;
  }

  // Check for empty extraction (Requirement 2.6)
  if (isEmptyExtraction(rawData)) {
    throw new OcrExtractionError(
      "Document could not be read. Please retake the photo with better lighting or angle."
    );
  }

  if (rawData.prescriptions.length === 0) {
    rawData.prescriptions = await extractPrescriptionsFromImage(base64Data, mimeType);
  }

  if (rawData.prescriptions.length === 0) {
    rawData.prescriptions = await extractSingleMedication(base64Data, mimeType);
  }

  if (rawData.prescriptions.length === 0 && rawData.rawText.trim()) {
    rawData.prescriptions = extractPrescriptionsFromOcrText(rawData.rawText);
  }

  // Apply NRIC redaction (Layer 2 — deterministic regex safety net)
  // This throws NricRedactionError on failure (fail-closed)
  const redactedData = redactExtractedData(rawData);

  return { extracted: redactedData };
}
