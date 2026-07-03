// ============================================================
// Shared Type Definitions for HealthKaki Medical Assistant
// Requirements: 2.7, 3.1, 5.3, 6.5
// ============================================================

// --- Language & Processing Types ---

export type SupportedLanguage = "en-SG" | "cmn-Hans-CN" | "ms-MY" | "ta-IN";

export type ProcessingStage =
  | "uploading"
  | "reading"
  | "finding"
  | "scanning_medication";

// --- Subsidy Types ---

export interface SubsidyResult {
  // The subsidy_schemes.id this result came from — used to look up richer
  // static content (benefits list, how-to-use instructions) that doesn't
  // vary per lookup, so isn't worth storing per-request.
  schemeId: string;
  schemeName: string;
  coverageDescription: string;
  eligibilityConditions: string;
  estimatedCoveragePercent: number;
  // Flat dollar subsidy amount, when the scheme is priced as a fixed amount
  // rather than as a percentage. Null for percentage-based schemes
  // (Pioneer/Merdeka/MediShield/MediFund).
  estimatedAmount: number | null;
  // Whether estimatedAmount is a per-visit subsidy (CHAS tiers) or an annual
  // withdrawal cap (MediSave CDMP). Null when estimatedAmount is null.
  estimatedAmountPeriod: "visit" | "year" | null;
  // Set when neither a coverage percentage nor a flat amount could be
  // determined (MediShield Life's claim limits and MediFund's discretionary
  // payouts aren't modelled) — a short explanation to show instead of a
  // misleading "0%". Null whenever estimatedCoveragePercent or estimatedAmount
  // is meaningful.
  coverageNote: string | null;
  translations: Record<
    SupportedLanguage,
    {
      schemeName: string;
      coverageDescription: string;
      eligibilityConditions: string;
    } | null
  >;
}

// Matches the live `subsidy_schemes` table schema in Supabase.
// NOTE: this differs from supabase/migrations/001_create_subsidy_schemes.sql and
// supabase/seed.sql, which describe a schema that was never actually applied to
// the live database — the columns below are what's really deployed.
export interface SubsidyScheme {
  id: string;
  name: string;
  chinese_name: string | null;
  malay_name: string | null;
  tamil_name: string | null;
  description: string;
  coverage_percentage: number | null;
  applicable_codes: string[];
  applicable_diagnoses: string[];
  // Bill line-item keywords this scheme is gated on (e.g. "ct scan", "mri" for
  // MediSave outpatient scans) — matched against extracted bill item
  // descriptions, unlike applicable_diagnoses which matches diagnosis text.
  // Empty for every other scheme.
  applicable_procedures: string[];
  min_birth_year: number | null;
  max_birth_year: number | null;
  institution_types: string[];
  min_income_per_capita: number | null;
  max_income_per_capita: number | null;
  citizenship_required: "citizen" | "citizen_or_pr" | null;
  citizenship_by_year: number | null;
  // Minimum current age (in years, evaluated against today's date, NOT a
  // fixed birth-year cohort like min_birth_year/max_birth_year) required for
  // this scheme — used for Flexi-MediSave ("age 60 and above"). Null for
  // every other scheme.
  min_age: number | null;
  // Consolidated flat-dollar pricing model, used by every scheme priced as a
  // fixed amount rather than a percentage (CHAS tiers, MediSave-CDMP,
  // Flexi-MediSave, MediSave outpatient scans, and any future flat-dollar
  // scheme) — replaces what used to be a separate pair of DB columns per
  // scheme. Keys are either:
  //   - "common" / "chronic_simple" / "chronic_complex", chosen by how many
  //     CDMP-listed chronic diagnoses were matched (0 / 1 / 2+) — used by
  //     schemes tiered by diagnosis count (CHAS, MediSave-CDMP), or
  //   - "flat", a single untiered amount — used by schemes that don't vary
  //     by diagnosis (Flexi-MediSave, MediSave outpatient scans).
  // Null for percentage-based schemes (Pioneer/Merdeka/MediShield/MediFund).
  pricing_tiers: Record<string, number> | null;
  // Whether pricing_tiers is a per-visit subsidy (CHAS) or an annual
  // withdrawal cap (MediSave-CDMP/Flexi-MediSave/outpatient scans). Null when
  // pricing_tiers is null.
  pricing_period: "visit" | "year" | null;
}

// --- Document Extraction Types ---

export interface ExtractedPrescription {
  medicationName: string;
  dosage: string | null;
  frequency: string | null;
  instructions: string | null;
  // Plain-language explanation of what the medication is for, inferred by
  // Gemini from the medication name (not printed on most documents).
  purpose: string | null;
  // Populated after extraction+redaction by the process-document route.
  // Medication name and dosage are intentionally NOT translated (proper noun /
  // numeric strength); frequency/instructions are translated via Gemini,
  // purpose is translated via DeepL (see src/lib/deepl.ts).
  translations?: Record<
    SupportedLanguage,
    { frequency: string | null; instructions: string | null; purpose: string | null } | null
  >;
}

export interface ExtractedBillItem {
  description: string;
  amount: number | null;
}

export interface ExtractedBill {
  currency: string;
  totalAmount: number | null;
  items: ExtractedBillItem[];
  // The amount actually owed by the patient after subsidy/insurance
  // deductions, as printed on the bill (e.g. "Patient Total", "Amount
  // Payable"). Distinct from totalAmount, which is the pre-deduction charge.
  payableAmount: number | null;
}

export type DocumentTypeId = "invoice" | "referral" | "prescription";

export interface RawExtractedData {
  medicalCodes: string[];
  diagnoses: string[];
  visitDate: string | null;
  institution: string | null;
  rawText: string;
  prescriptions: ExtractedPrescription[];
  bill: ExtractedBill | null;
  documentType: DocumentTypeId | null;
  // Payer/subsidy names itemised as a claim or deduction on a bill (e.g. "CHAS", "MediSave").
  claimedSubsidies: string[];
  // Referral-letter-only fields (null for other document types).
  referralType: string | null; // e.g. "FAST TRACK", "Routine"
  appointmentDateTime: string | null; // printed as-is, often left blank on the letter
  appointmentCenterTel: string | null;
}

export interface RedactedExtractedData {
  medicalCodes: string[];
  diagnoses: string[];
  visitDate: string | null;
  institution: string | null;
  rawText: string; // All NRIC patterns replaced with [REDACTED]
  prescriptions: ExtractedPrescription[];
  bill: ExtractedBill | null;
  documentType: DocumentTypeId | null;
  claimedSubsidies: string[];
  referralType: string | null;
  appointmentDateTime: string | null;
  appointmentCenterTel: string | null;
}

export type ExtractedDocumentData = RedactedExtractedData;

// --- Redaction Types ---

export interface RedactionResult {
  success: boolean;
  redactedText: string;
  redactionCount: number;
}

// --- Subsidy Lookup Types ---

export interface SubsidyLookupParams {
  medicalCodes: string[];
  diagnoses: string[];
  // Payer/subsidy names itemised as a claim or deduction on a bill (e.g. "CHAS", "MediSave").
  claimedSubsidies?: string[];
  // Bill line-item descriptions (e.g. "CT Scan", "Consultation Fee") — used to
  // detect procedure-gated schemes like MediSave's outpatient scan cap, which
  // isn't triggered by a diagnosis.
  billItemDescriptions?: string[];
  institution: string | null;
  birthYear?: number;
  clinicType?: "public_hospital" | "polyclinic" | "gp_clinic";
  // Person-level fields used to filter mutually-exclusive age-cohort (Pioneer/
  // Merdeka Generation) and income-tier (CHAS) schemes, and citizenship-gated
  // national frameworks. All optional — omitting them simply skips that filter.
  citizenshipStatus?: "citizen" | "pr" | "foreigner";
  citizenshipYear?: number;
  incomePerCapita?: number;
}

export interface SubsidyLookupResult {
  subsidies: SubsidyResult[];
  message: string | null;
  needsManualInput: boolean;
}

// --- Manual Input Types ---

export interface ManualInputData {
  birthYear: number;
  clinicType: "public_hospital" | "polyclinic" | "gp_clinic";
  chronicConditions: string[];
}

// --- API Response Types ---

export interface ProcessDocumentResponse {
  extracted: ExtractedDocumentData;
  subsidies: SubsidyResult[];
  message: string | null;
  needsManualInput: boolean;
}

// --- App State ---

export interface AppState {
  // Flow state
  stage:
    | "capture"
    | "processing"
    | "results"
    | "error"
    | "manual-input"
    | "medication-capture"
    | "medication-processing"
    | "medication-results"
    | "medication-error";
  processingStage: ProcessingStage | null;

  // Data
  selectedFile: File | null;
  previewUrl: string | null;
  extractedData: ExtractedDocumentData | null;
  subsidyResults: SubsidyResult[];

  // Medication data
  medicationResult: MedicationResult | null;
  medicationWarning: "low_confidence" | null;
  handwritingRejected: boolean;

  // UI preferences
  language: SupportedLanguage;

  // Error state
  error: {
    message: string;
    instruction?: string;
    retryable: boolean;
    stage?: ProcessingStage;
    type?: "handwriting_detected" | "unreadable_label" | "not_medication_label";
  } | null;
}

// --- Medication Types ---

export interface MedicationResult {
  medicationName: string;
  purpose: string;
  dosageFrequency: string;
  confidence: number;
  translations: Record<
    SupportedLanguage,
    {
      purpose: string;
      dosageFrequency: string;
    } | null
  >;
}

export interface MedicationExtraction {
  medicationName: string;
  purpose: string;
  dosageFrequency: string;
  confidence: number;
}

export interface MedicationOcrResult {
  success: boolean;
  extraction: MedicationExtraction | null;
  error: string | null;
}

export interface HandwritingDetectionResult {
  isHandwritten: boolean;
  confidence: number;
  reason: string | null;
}

export interface ProcessMedicationResponse {
  medication: {
    medicationName: string;
    purpose: string;
    dosageFrequency: string;
    confidence: number;
    translations: Record<
      SupportedLanguage,
      {
        purpose: string;
        dosageFrequency: string;
      } | null
    >;
  };
  warning: "low_confidence" | null;
}

// ============================================================
// Error Classes
// ============================================================

/**
 * Base error class for all HealthKaki errors.
 */
export class HealthKakiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HealthKakiError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when NRIC redaction fails or encounters an error.
 * Fail-closed: document processing is halted to prevent privacy breach.
 */
export class NricRedactionError extends HealthKakiError {
  constructor(message: string = "NRIC redaction failed") {
    super(message);
    this.name = "NricRedactionError";
  }
}

/**
 * Thrown when OCR extraction fails or returns empty/invalid data.
 */
export class OcrExtractionError extends HealthKakiError {
  constructor(message: string = "OCR extraction failed") {
    super(message);
    this.name = "OcrExtractionError";
  }
}

/**
 * Thrown when subsidy lookup query fails.
 */
export class SubsidyLookupError extends HealthKakiError {
  constructor(message: string = "Subsidy lookup failed") {
    super(message);
    this.name = "SubsidyLookupError";
  }
}

/**
 * Thrown when file validation fails (wrong type, too large, too many pages).
 */
export class FileValidationError extends HealthKakiError {
  constructor(message: string = "File validation failed") {
    super(message);
    this.name = "FileValidationError";
  }
}

/**
 * Thrown when a processing stage exceeds its timeout.
 */
export class TimeoutError extends HealthKakiError {
  constructor(message: string = "Processing timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Thrown when handwriting is detected on a medication label image.
 * Includes safety warning message and instruction for the user.
 */
export class HandwritingDetectedError extends HealthKakiError {
  public readonly instruction: string;

  constructor(
    message: string = "Handwritten labels cannot be accepted because misread handwriting may lead to incorrect medication information",
    instruction: string = "Please scan only official printed labels from the pharmacy or manufacturer"
  ) {
    super(message);
    this.name = "HandwritingDetectedError";
    this.instruction = instruction;
  }
}

/**
 * Thrown when medication extraction fails.
 * Supports "unreadable" and "not_medication" variants.
 */
export class MedicationExtractionError extends HealthKakiError {
  public readonly variant: "unreadable" | "not_medication";
  public readonly instruction: string;

  constructor(
    variant: "unreadable" | "not_medication",
    message?: string,
    instruction?: string
  ) {
    const defaultMessages: Record<string, string> = {
      unreadable: "Could not read the medication label",
      not_medication:
        "This does not appear to be a medication label",
    };
    const defaultInstructions: Record<string, string> = {
      unreadable:
        "Please retake the photo with better lighting, ensuring the printed text is clearly visible",
      not_medication:
        "Please scan the printed sticker or label on the medication box or bottle",
    };

    super(message ?? defaultMessages[variant]);
    this.name = "MedicationExtractionError";
    this.variant = variant;
    this.instruction = instruction ?? defaultInstructions[variant];
  }
}


// ============================================================
// Legacy Types (retained for backward compatibility with existing screens)
// ============================================================

export type Screen =
  | "home"
  | "camera"
  | "confirm"
  | "processing"
  | "results"
  | "details"
  | "bill"
  | "medications"
  | "history"
  | "help"
  | "settings"
  | "error"
  | "login"
  | "onboarding";

// --- Profile Types ---
// Matches the `public.profiles` table (id references auth.users).
// `nric` and `date_of_birth` are set at first login (see /api/auth/nric);
// the remaining fields are null until the onboarding form is submitted.
// `citizenship_status` being non-null is what signals onboarding is done.
export interface Profile {
  id: string;
  nric: string;
  full_name: string | null;
  date_of_birth: string;
  citizenship_status: "citizen" | "pr" | "foreigner" | null;
  citizenship_year: number | null;
  household_monthly_income: number | null;
  household_size: number | null;
  created_at: string;
  updated_at: string;
}

export type ErrorType =
  | "upload"
  | "processing"
  | "no_subsidies"
  | "offline"
  | "validation";

export type Language = "en" | "zh" | "ms" | "ta";

export interface SubsidyCard {
  id: string;
  // The subsidy_schemes.id this card came from — used to look up richer
  // static content (benefits list, how-to-use instructions).
  schemeId: string;
  name: string;
  chineseName: string;
  eligible: boolean;
  saves: number;
  outOfPocket: number;
  // Flat dollar subsidy amount, when the scheme (e.g. a CHAS tier or MediSave
  // CDMP annual cap) is priced as a fixed amount rather than as a percentage.
  // Null falls back to saves/outOfPocket.
  amount: number | null;
  // Whether `amount` is a per-visit subsidy (CHAS) or an annual cap (MediSave
  // CDMP). Null when amount is null.
  amountPeriod: "visit" | "year" | null;
  // Set when neither `amount` nor `saves` could be determined for this
  // scheme (MediShield Life claim limits, MediFund's discretionary payouts) —
  // a short explanation to show instead of a misleading "0%". Null otherwise.
  coverageNote: string | null;
  icon: string;
  badgeColor: "orange" | "teal" | "navy" | "gray";
  description: string;
  benefits: string[];
  howToUse: string;
}

export interface Medication {
  id: string;
  name: string;
  genericName: string;
  purpose: string;
  dosage: string;
  frequency: string;
  timing: string;
  specialNotes: string;
  icon: string;
  translations: {
    zh: {
      purpose: string;
      frequency: string;
      timing: string;
      specialNotes: string;
    };
    ms: {
      purpose: string;
      frequency: string;
      timing: string;
      specialNotes: string;
    };
    ta: {
      purpose: string;
      frequency: string;
      timing: string;
      specialNotes: string;
    };
  };
}

export interface BillLine {
  item: string;
  amount: number;
  subsidised: boolean;
  coveredBy?: string;
}

export interface ScanResult {
  id: string;
  date: string;
  time: string;
  documentType: string;
  clinicName: string;
  totalBill: number;
  totalSaved: number;
  outOfPocket: number;
  canUseMediSave: boolean;
  mediSaveBalance: number;
  finalCost: number;
  confidence: number;
  subsidies: SubsidyCard[];
  medications?: Medication[];
  billLines?: BillLine[];
}

export interface HistoryItem {
  id: string;
  date: string;
  time: string;
  clinicName: string;
  outOfPocket: number;
  totalSaved: number;
  documentType: string;
}
