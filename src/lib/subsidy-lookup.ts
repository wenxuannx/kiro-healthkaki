import { createClient } from "@/services/supabase/server";
import { translateBatch, NON_ENGLISH_LANGUAGES } from "@/lib/translator";
import type {
  SubsidyScheme,
  SubsidyLookupParams,
  SubsidyLookupResult,
  SubsidyResult,
  SupportedLanguage,
} from "@/types";

type ClinicType = "public_hospital" | "polyclinic" | "gp_clinic";

/**
 * Maps an institution name to a clinic type category.
 * Uses keyword matching on the institution string.
 */
export function mapInstitutionToClinicType(
  institution: string | null
): ClinicType | null {
  if (!institution) return null;

  const lower = institution.toLowerCase();

  if (lower.includes("hospital")) return "public_hospital";
  // National/specialist centres (SNEC, National Heart Centre, National Cancer
  // Centre, National Skin Centre, National Dental Centre, National
  // Neuroscience Institute, etc.) are hospital-tier Specialist Outpatient
  // Clinics for subsidy purposes, not neighbourhood GP clinics — despite
  // "centre"/"institute" in the name looking similar to a GP "medical centre".
  if (
    lower.includes("national") &&
    (lower.includes("centre") || lower.includes("center") || lower.includes("institute"))
  ) {
    return "public_hospital";
  }
  if (lower.includes("polyclinic")) return "polyclinic";
  if (
    lower.includes("clinic") ||
    lower.includes("gp") ||
    lower.includes("family medicine") ||
    lower.includes("medical centre") ||
    lower.includes("medical center")
  ) {
    return "gp_clinic";
  }

  return null;
}

/**
 * Filters subsidy schemes by birth year eligibility.
 * A scheme matches if:
 *   - Both min_birth_year and max_birth_year are null (no bounds), OR
 *   - birthYear falls within [min_birth_year, max_birth_year] (inclusive,
 *     treating null min as -Infinity and null max as +Infinity)
 *
 * If birthYear is undefined, all schemes are included (age-gated schemes
 * like Pioneer/Merdeka cannot be filtered without birth year data).
 */
export function filterByBirthYear(
  schemes: SubsidyScheme[],
  birthYear: number | undefined
): SubsidyScheme[] {
  if (birthYear === undefined) {
    return schemes;
  }

  return schemes.filter((scheme) => {
    const min = scheme.min_birth_year;
    const max = scheme.max_birth_year;

    // No bounds — scheme is not age-gated
    if (min === null && max === null) return true;

    // Only lower bound
    if (min !== null && max === null) return birthYear >= min;

    // Only upper bound
    if (min === null && max !== null) return birthYear <= max;

    // Both bounds
    return birthYear >= min! && birthYear <= max!;
  });
}

/**
 * Filters subsidy schemes by current age (schemes with a min_age threshold,
 * e.g. Flexi-MediSave's "age 60 and above" — evaluated against today's date,
 * unlike filterByBirthYear's fixed historical cohorts). A scheme with
 * min_age === null has no age gate and always passes. If birthYear is
 * undefined, age-gated schemes are excluded (cannot confirm eligibility).
 */
export function filterByMinAge(
  schemes: SubsidyScheme[],
  birthYear: number | undefined
): SubsidyScheme[] {
  const currentYear = new Date().getFullYear();

  return schemes.filter((scheme) => {
    if (scheme.min_age === null) return true;
    if (birthYear === undefined) return false;
    return currentYear - birthYear >= scheme.min_age;
  });
}

/**
 * Filters subsidy schemes by household income per capita.
 * Same inclusive-bounds/null-as-infinity semantics as filterByBirthYear.
 * If incomePerCapita is undefined, all schemes are included (income-gated
 * schemes like the CHAS tiers cannot be filtered without income data).
 */
export function filterByIncomePerCapita(
  schemes: SubsidyScheme[],
  incomePerCapita: number | undefined
): SubsidyScheme[] {
  if (incomePerCapita === undefined) {
    return schemes;
  }

  return schemes.filter((scheme) => {
    const min = scheme.min_income_per_capita;
    const max = scheme.max_income_per_capita;

    if (min === null && max === null) return true;
    if (min !== null && max === null) return incomePerCapita >= min;
    if (min === null && max !== null) return incomePerCapita <= max;
    return incomePerCapita >= min! && incomePerCapita <= max!;
  });
}

/**
 * Filters subsidy schemes by citizenship status/year.
 * A scheme with citizenship_required === null has no citizenship gate and
 * always passes. Otherwise the caller's citizenshipStatus must satisfy the
 * requirement, and — if the scheme also has a citizenship_by_year cutoff
 * (Pioneer/Merdeka Generation) — the caller's citizenshipYear must be on or
 * before that cutoff.
 * If citizenshipStatus is undefined, citizenship-gated schemes are excluded
 * (we cannot confirm eligibility without this data) but ungated schemes
 * still pass through.
 */
export function filterByCitizenship(
  schemes: SubsidyScheme[],
  citizenshipStatus: "citizen" | "pr" | "foreigner" | undefined,
  citizenshipYear: number | undefined
): SubsidyScheme[] {
  return schemes.filter((scheme) => {
    const required = scheme.citizenship_required;
    if (required === null) return true;
    if (citizenshipStatus === undefined) return false;

    const statusOk =
      required === "citizen"
        ? citizenshipStatus === "citizen"
        : citizenshipStatus === "citizen" || citizenshipStatus === "pr";
    if (!statusOk) return false;

    if (scheme.citizenship_by_year !== null) {
      if (citizenshipYear === undefined) return false;
      if (citizenshipYear > scheme.citizenship_by_year) return false;
    }

    return true;
  });
}

/**
 * Pioneer/Merdeka Generation (age-cohort) and CHAS (income-tier) schemes are
 * mutually exclusive: per MOH, seniors who qualify for a generation package
 * use it instead of a standard CHAS card. A scheme counts as "age-cohort" if
 * it has a birth-year bound, and "income-tier" if it has an income bound.
 * Only applied when birthYear is known — otherwise we can't tell whether the
 * caller qualifies for a cohort scheme, so income-tier schemes are left in.
 */
function excludeIncomeTierIfCohortMatched(
  schemes: SubsidyScheme[],
  birthYear: number | undefined
): SubsidyScheme[] {
  if (birthYear === undefined) return schemes;

  const isAgeCohort = (s: SubsidyScheme) =>
    s.min_birth_year !== null || s.max_birth_year !== null;
  const isIncomeTier = (s: SubsidyScheme) =>
    s.min_income_per_capita !== null || s.max_income_per_capita !== null;

  const matchedCohort = schemes.some(isAgeCohort);
  if (!matchedCohort) return schemes;

  return schemes.filter((s) => !isIncomeTier(s));
}

/**
 * Diagnoses recognised by the MediSave Chronic Disease Management Programme —
 * also used to decide whether a CHAS visit is priced at the "common illness"
 * rate or the (higher) chronic simple/complex rate. Kept in sync with the
 * `applicable_diagnoses` on the "MediSave Chronic Disease Management
 * Programme" row in `subsidy_schemes`.
 */
const CDMP_DIAGNOSES = [
  "hypertension",
  "diabetes",
  "lipid_disorder",
  "stroke",
  "chronic_kidney_disease",
  "asthma",
  "copd",
];

/**
 * Resolves the flat dollar amount for a scheme priced as a fixed amount
 * rather than a percentage, from the scheme's consolidated pricing_tiers.
 *   - Tiered schemes (keyed by "common"/"chronic_simple"/"chronic_complex" —
 *     CHAS, MediSave-CDMP): chosen by how many CDMP-listed chronic diagnoses
 *     were extracted (0 / 1 / 2+ matches).
 *   - Untiered schemes (keyed by "flat" — Flexi-MediSave, MediSave outpatient
 *     scans): a single amount regardless of diagnosis.
 * Returns null for schemes with no pricing_tiers, or when the resolved tier
 * has no subsidy for this visit type (e.g. CHAS Green pays nothing for
 * common illnesses).
 */
function resolveFlatAmount(
  scheme: SubsidyScheme,
  diagnoses: string[]
): { amount: number | null; period: "visit" | "year" | null } {
  const tiers = scheme.pricing_tiers;
  if (!tiers) return { amount: null, period: null };

  const chronicMatches = diagnoses.filter((d) => CDMP_DIAGNOSES.includes(d)).length;

  const amount =
    "flat" in tiers
      ? (tiers.flat ?? null)
      : chronicMatches >= 2
        ? (tiers.chronic_complex ?? null)
        : chronicMatches === 1
          ? (tiers.chronic_simple ?? null)
          : (tiers.common ?? null);

  return { amount, period: scheme.pricing_period };
}

/**
 * Transforms a SubsidyScheme DB row into a SubsidyResult for the API response.
 * The DB only stores a translated name per language (chinese_name/malay_name/tamil_name) —
 * there are no separately translated description columns, so coverageDescription and
 * eligibilityConditions reuse the English description for every language.
 */
function toSubsidyResult(scheme: SubsidyScheme, diagnoses: string[]): SubsidyResult {
  const translatedName: Record<SupportedLanguage, string | null> = {
    "en-SG": scheme.name,
    "cmn-Hans-CN": scheme.chinese_name,
    "ms-MY": scheme.malay_name,
    "ta-IN": scheme.tamil_name,
  };

  const translations = {} as SubsidyResult["translations"];
  for (const lang of Object.keys(translatedName) as SupportedLanguage[]) {
    const name = translatedName[lang];
    translations[lang] = name
      ? {
          schemeName: name,
          coverageDescription: scheme.description,
          eligibilityConditions: scheme.description,
        }
      : null;
  }

  const { amount, period } = resolveFlatAmount(scheme, diagnoses);

  // Some schemes have neither a flat modelled amount nor a coverage
  // percentage — their real payout depends on data this pipeline doesn't
  // extract (MediShield Life's day-rate/claim-limit tables; MediFund's
  // discretionary, human-reviewed process; MediSave's heavy-therapy and
  // vaccination/screening schedules, which vary per drug/vaccine rather than
  // being a single dollar figure). Showing "0%" there would read as "no help
  // available", which is wrong — show an explanatory note instead.
  const schemeNameLower = scheme.name.toLowerCase();
  const coverageNote =
    scheme.coverage_percentage === null && amount === null
      ? schemeNameLower.includes("medifund")
        ? "Case-by-case — apply through a Medical Social Worker at the hospital."
        : schemeNameLower.includes("vaccination") || schemeNameLower.includes("screening")
          ? "Often covered up to a fixed amount per vaccine/screening — check with the clinic which ones qualify."
          : schemeNameLower.includes("heavy medical") || schemeNameLower.includes("dialysis")
            ? "Heavily subsidised for ongoing treatment — check the exact amount with the hospital billing counter."
            : schemeNameLower.includes("medishield")
              ? "Covers large hospital bills and selected costly outpatient treatments, up to $200,000 a year. You pay a co-insurance share starting at 10% (higher for larger bills), after a deductible of $1,500–$3,000 depending on your ward class and age. Ask the billing counter how much of your specific bill MediShield Life has claimed."
              : "Coverage depends on your specific treatment and claim limits — check with the hospital billing counter."
      : null;

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    coverageDescription: scheme.description,
    eligibilityConditions: scheme.description,
    estimatedCoveragePercent: scheme.coverage_percentage ?? 0,
    estimatedAmount: amount,
    estimatedAmountPeriod: amount !== null ? period : null,
    coverageNote,
    translations,
  };
}

/**
 * Fills in translated coverage/eligibility descriptions for each subsidy,
 * mutating the passed results in place. The scheme name (already translated
 * from the DB) is preserved; where the DB had no translated name, the English
 * name is used as the fallback so the language block is never left empty.
 *
 * Non-fatal: any translation failure leaves the existing English text intact.
 */
async function applyDescriptionTranslations(
  subsidies: SubsidyResult[]
): Promise<void> {
  if (subsidies.length === 0) return;

  const translated = await translateBatch(
    subsidies.map((s) => ({ description: s.coverageDescription }))
  );

  subsidies.forEach((subsidy, i) => {
    const perLang = translated[i];
    for (const lang of NON_ENGLISH_LANGUAGES) {
      const description = perLang[lang]?.description;
      if (!description) continue; // keep English fallback

      const existing = subsidy.translations[lang];
      subsidy.translations[lang] = {
        schemeName: existing?.schemeName ?? subsidy.schemeName,
        coverageDescription: description,
        eligibilityConditions: description,
      };
    }
  });
}

/**
 * Queries Supabase subsidy_schemes table.
 * Matches on applicable_codes OR applicable_diagnoses, or is universal
 * (a scheme with both arrays empty matches everything). Also matches
 * schemes explicitly named as a claim/payer on the bill (e.g. a
 * "Claim from CHAS" line matches any scheme whose name contains "CHAS").
 * Filters by institution type mapping and birth year.
 * Returns empty with message if no codes/diagnoses/claims were extracted.
 */
export async function lookupSubsidies(
  params: SubsidyLookupParams
): Promise<SubsidyLookupResult> {
  const {
    medicalCodes,
    diagnoses,
    claimedSubsidies = [],
    billItemDescriptions = [],
    institution,
    birthYear,
    clinicType,
    citizenshipStatus,
    citizenshipYear,
    incomePerCapita,
  } = params;

  const hasCodes = medicalCodes.length > 0 && medicalCodes.some((c) => c.trim() !== "");
  const hasDiagnoses = diagnoses.length > 0 && diagnoses.some((d) => d.trim() !== "");
  const hasClaims = claimedSubsidies.length > 0 && claimedSubsidies.some((c) => c.trim() !== "");
  const hasBillItems = billItemDescriptions.length > 0 && billItemDescriptions.some((d) => d.trim() !== "");

  // Diagnosis/code/claim/procedure-gated schemes (e.g. MediSave CDMP,
  // outpatient scans) can't be inferred without at least one of those
  // signals. But "universal" schemes (empty applicable_codes/
  // applicable_diagnoses/applicable_procedures — MediShield Life, MediFund,
  // Pioneer/Merdeka) are only gated on institution/citizenship/birth year, so
  // a bare payment receipt with an identifiable institution and no clinical
  // detail should still be able to surface those, rather than bailing out
  // entirely.
  if (!hasCodes && !hasDiagnoses && !hasClaims && !hasBillItems && !institution) {
    return {
      subsidies: [],
      message: "Insufficient data was extracted to determine subsidy eligibility",
      needsManualInput: true,
    };
  }

  // Determine clinic type: explicit param takes priority, then map from institution
  const resolvedClinicType: ClinicType | null =
    clinicType ?? mapInstitutionToClinicType(institution);

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.from("subsidy_schemes").select("*");

    if (error) {
      console.error("[subsidy-lookup] Supabase query error:", error.message, error.code);
      return {
        subsidies: [],
        message: "Subsidy lookup unavailable",
        needsManualInput: false,
      };
    }

    const nonEmptyCodes = medicalCodes.map((c) => c.trim()).filter(Boolean).slice(0, 50);
    const nonEmptyDiagnoses = diagnoses.map((d) => d.trim().toLowerCase()).filter(Boolean).slice(0, 50);
    const nonEmptyClaims = claimedSubsidies.map((c) => c.trim().toLowerCase()).filter(Boolean).slice(0, 50);
    const nonEmptyBillItems = billItemDescriptions.map((d) => d.trim().toLowerCase()).filter(Boolean).slice(0, 50);

    let allSchemes = (data as SubsidyScheme[]) ?? [];

    // A scheme with no applicable_codes/applicable_diagnoses/applicable_procedures is universal (matches everything).
    allSchemes = allSchemes.filter((scheme) => {
      const isUniversal =
        scheme.applicable_codes.length === 0 &&
        scheme.applicable_diagnoses.length === 0 &&
        scheme.applicable_procedures.length === 0;
      if (isUniversal) return true;

      const codeMatch = scheme.applicable_codes.some((c) => nonEmptyCodes.includes(c));
      const diagnosisMatch = scheme.applicable_diagnoses.some((d) =>
        nonEmptyDiagnoses.some((docDiagnosis) => docDiagnosis.includes(d.toLowerCase()))
      );
      // A bill line item mentioning a gated procedure (e.g. "CT Scan") is
      // evidence of eligibility for procedure-gated schemes like MediSave's
      // outpatient scan cap, independent of diagnosis extraction.
      const procedureMatch = scheme.applicable_procedures.some((p) =>
        nonEmptyBillItems.some((item) => item.includes(p.toLowerCase()))
      );
      // A bill that explicitly names this scheme as a claim/payer (e.g. "Claim from CHAS")
      // is itself evidence of eligibility, regardless of diagnosis/code extraction.
      const schemeName = scheme.name.toLowerCase();
      const claimMatch = nonEmptyClaims.some(
        (claim) => schemeName.includes(claim) || claim.includes(schemeName)
      );
      return codeMatch || diagnosisMatch || procedureMatch || claimMatch;
    });

    // Filter by clinic type — empty institution_types means universal.
    if (resolvedClinicType) {
      allSchemes = allSchemes.filter(
        (scheme) => scheme.institution_types.length === 0 || scheme.institution_types.includes(resolvedClinicType)
      );
    }

    // Filter by birth year, current age, income per capita, and citizenship
    allSchemes = filterByBirthYear(allSchemes, birthYear);
    allSchemes = filterByMinAge(allSchemes, birthYear);
    allSchemes = filterByIncomePerCapita(allSchemes, incomePerCapita);
    allSchemes = filterByCitizenship(allSchemes, citizenshipStatus, citizenshipYear);

    // Pioneer/Merdeka Generation supersedes standard CHAS tiers when matched.
    allSchemes = excludeIncomeTierIfCohortMatched(allSchemes, birthYear);

    let subsidies = allSchemes.map((scheme) => toSubsidyResult(scheme, nonEmptyDiagnoses));

    // A CHAS tier that resolves to no subsidy for this visit (e.g. CHAS
    // Green pays nothing for a common illness) isn't a real match — drop it
    // rather than showing a $0 "eligible" card.
    subsidies = subsidies.filter((s) => {
      const scheme = allSchemes.find((sc) => sc.name === s.schemeName);
      const hasFlatPricing = scheme && scheme.pricing_tiers !== null;
      if (!hasFlatPricing) return true;
      return s.estimatedAmount !== null && s.estimatedAmount > 0;
    });

    if (subsidies.length === 0) {
      return {
        subsidies: [],
        message:
          "No matching subsidy schemes were found. Please consult a medical social worker for further assistance.",
        needsManualInput: false,
      };
    }

    // Translate the scheme descriptions into the non-English languages.
    // Scheme NAMES already come pre-translated from the DB columns; here we
    // fill in the coverage/eligibility text (which otherwise reused English).
    // Non-fatal: on failure the English text is retained.
    await applyDescriptionTranslations(subsidies);

    return {
      subsidies,
      message: null,
      needsManualInput: false,
    };
  } catch (error) {
    // Instead of throwing and crashing the whole pipeline, return graceful empty result
    console.error("[subsidy-lookup] Unexpected error:", error);
    return {
      subsidies: [],
      message: "Subsidy lookup unavailable",
      needsManualInput: false,
    };
  }
}
