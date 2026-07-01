import { NextRequest } from "next/server";
import { geminiModel } from "@/services/gemini";
import { createClient } from "@/services/supabase/server";

const DOCUMENT_TYPES = ["invoice", "referral", "diagnosis", "prescription", "followup", "specialist"] as const;

const EXTRACTION_PROMPT = `You are a medical document parser for Singapore's subsidy system.

Analyse the provided medical document image and extract the following:
1. Medical codes (ICD-10, SNOMED, or local clinic codes)
2. Diagnosis or condition names
3. Date of visit
4. Healthcare institution name
5. Document type — classify as exactly one of the following lowercase string values (use the value on the left of the colon, not the description):
   - "invoice": a bill, receipt, or itemised charges for services/medication issued after a visit
   - "referral": contains a "Referral To" / "Referral Notes" section directing the patient to another institution, department, or specialist — regardless of the document's title or header (e.g. a page titled "Documents Review Report" that contains referral notes is still "referral")
   - "diagnosis": states a new diagnosis or chronic condition without referring the patient elsewhere
   - "prescription": a prescription or medication dispensing slip listing drug names and dosages
   - "followup": a follow-up appointment reminder or letter for an existing condition
   - "specialist": a specialist consultation memo or clinical notes from a specialist visit
   Judge by the document's content and structure, not its printed title. Only use null if none of the above apply after reading the full content.

IMPORTANT: Automatically redact any NRIC numbers (format: [SFTG]XXXXXXX[A-Z]) by replacing them with [REDACTED].

Respond ONLY with a JSON object in this exact shape:
{
  "medicalCodes": ["string"],
  "diagnoses": ["string"],
  "visitDate": "YYYY-MM-DD or null",
  "institution": "string or null",
  "documentType": "invoice|referral|diagnosis|prescription|followup|specialist or null",
  "rawText": "full extracted text with NRIC redacted"
}`;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const supabase = await createClient();

  const fileBuffer = await file.arrayBuffer();
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const base64 = Buffer.from(fileBuffer).toString("base64");

  // Storage upload and Gemini extraction don't depend on each other — run them
  // concurrently instead of paying both latencies back-to-back.
  const [uploadResult, geminiResult] = await Promise.all([
    supabase.storage.from("documents").upload(fileName, fileBuffer, { contentType: file.type }),
    geminiModel
      .generateContent([EXTRACTION_PROMPT, { inlineData: { data: base64, mimeType: file.type } }])
      .then((result) => ({ text: result.response.text().trim(), error: null as unknown }))
      .catch((err) => ({ text: null, error: err })),
  ]);

  const { data: uploadData, error: uploadError } = uploadResult;
  if (uploadError) {
    console.error("[process-document] Supabase storage upload failed:", uploadError);
    return Response.json({ error: "Failed to upload file" }, { status: 500 });
  }

  if (geminiResult.error || geminiResult.text === null) {
    console.error("[process-document] Gemini extraction call failed:", geminiResult.error);
    return Response.json({ error: "Failed to analyse document" }, { status: 500 });
  }
  const responseText = geminiResult.text;

  let extracted: {
    medicalCodes: string[];
    diagnoses: string[];
    visitDate: string | null;
    institution: string | null;
    documentType: (typeof DOCUMENT_TYPES)[number] | null;
    rawText: string;
  };

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const rawParsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    extracted = { ...rawParsed, documentType: normalizeDocumentType(rawParsed.documentType) };
    if (extracted.documentType === null && rawParsed.documentType) {
      console.warn(`[process-document] Unrecognized documentType from Gemini: ${JSON.stringify(rawParsed.documentType)}`);
    }
  } catch (err) {
    console.error("[process-document] Failed to parse Gemini response as JSON:", responseText, err);
    return Response.json({ error: "Failed to parse extraction result" }, { status: 500 });
  }

  // Save result to Supabase
  const { data: submission, error: dbError } = await supabase
    .from("document_submissions")
    .insert({
      storage_path: uploadData.path,
      medical_codes: extracted.medicalCodes,
      diagnoses: extracted.diagnoses,
      visit_date: extracted.visitDate,
      institution: extracted.institution,
      raw_text: extracted.rawText,
    })
    .select()
    .single();

  if (dbError) {
    console.error("[process-document] Supabase insert into document_submissions failed:", dbError);
    return Response.json({ error: "Failed to save submission" }, { status: 500 });
  }

  const subsidies = await lookupSubsidies(
    supabase,
    extracted.medicalCodes,
    extracted.diagnoses,
    extracted.institution
  );

  if (subsidies.error) {
    return Response.json({ error: subsidies.error }, { status: 500 });
  }

  return Response.json({ submission, extracted, subsidies: subsidies.matches, subsidiesMessage: subsidies.message });
}

// Gemini sometimes returns a synonym or human-readable label instead of the
// exact enum string despite prompt instructions — normalize common variants
// before falling back to null.
const DOCUMENT_TYPE_SYNONYMS: Record<string, (typeof DOCUMENT_TYPES)[number]> = {
  referral: "referral",
  "referral letter": "referral",
  "referral notes": "referral",
  "referral note": "referral",
  invoice: "invoice",
  bill: "invoice",
  receipt: "invoice",
  diagnosis: "diagnosis",
  "diagnosis letter": "diagnosis",
  "chronic condition letter": "diagnosis",
  prescription: "prescription",
  "prescription slip": "prescription",
  "medication slip": "prescription",
  followup: "followup",
  "follow-up": "followup",
  "follow-up letter": "followup",
  "follow up letter": "followup",
  specialist: "specialist",
  "specialist memo": "specialist",
  "specialist consultation": "specialist",
};

function normalizeDocumentType(value: unknown): (typeof DOCUMENT_TYPES)[number] | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (DOCUMENT_TYPES.includes(key as (typeof DOCUMENT_TYPES)[number])) {
    return key as (typeof DOCUMENT_TYPES)[number];
  }
  return DOCUMENT_TYPE_SYNONYMS[key] ?? null;
}

type InstitutionType = "public_hospital" | "polyclinic" | "gp_clinic";

function mapInstitutionType(institution: string | null): InstitutionType | null {
  if (!institution) return null;
  const name = institution.toLowerCase();
  if (name.includes("polyclinic")) return "polyclinic";
  if (name.includes("hospital")) return "public_hospital";
  if (name.includes("clinic")) return "gp_clinic";
  return null;
}

async function lookupSubsidies(
  supabase: Awaited<ReturnType<typeof createClient>>,
  medicalCodes: string[],
  diagnoses: string[],
  institution: string | null
) {
  const hasCodes = medicalCodes.some((c) => c.trim().length > 0);
  const hasDiagnoses = diagnoses.some((d) => d.trim().length > 0);

  if (!hasCodes && !hasDiagnoses) {
    return {
      matches: [],
      message: "Not enough data was extracted from your document to determine subsidy eligibility.",
      error: null,
    };
  }

  const { data: schemes, error } = await supabase.from("subsidy_schemes").select("*");

  if (error) {
    console.error("[process-document] Supabase select on subsidy_schemes failed:", error);
    return { matches: [], message: null, error: "Failed to look up subsidies. Please try again later." };
  }

  const institutionType = mapInstitutionType(institution);
  const lowerDiagnoses = diagnoses.map((d) => d.toLowerCase());

  const matches = (schemes ?? []).filter((scheme) => {
    const isUniversal = scheme.applicable_diagnoses.length === 0 && scheme.applicable_codes.length === 0;
    const conditionMatch =
      isUniversal ||
      scheme.applicable_diagnoses.some((d: string) =>
        lowerDiagnoses.some((docDiagnosis) => docDiagnosis.includes(d.toLowerCase()))
      ) ||
      scheme.applicable_codes.some((c: string) => medicalCodes.includes(c));

    const institutionMatch =
      !institutionType ||
      scheme.institution_types.length === 0 ||
      scheme.institution_types.includes(institutionType);

    return conditionMatch && institutionMatch;
  });

  return {
    matches,
    message: matches.length === 0
      ? "No matching subsidy schemes were found. Consider consulting a medical social worker for further assistance."
      : null,
    error: null,
  };
}
