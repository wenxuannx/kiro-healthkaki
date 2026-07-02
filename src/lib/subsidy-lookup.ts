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
 * Transforms a SubsidyScheme DB row into a SubsidyResult for the API response.
 * The DB only stores a translated name per language (chinese_name/malay_name/tamil_name) —
 * there are no separately translated description columns, so coverageDescription and
 * eligibilityConditions reuse the English description for every language.
 */
function toSubsidyResult(scheme: SubsidyScheme): SubsidyResult {
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

  return {
    schemeName: scheme.name,
    coverageDescription: scheme.description,
    eligibilityConditions: scheme.description,
    estimatedCoveragePercent: scheme.coverage_percentage ?? 0,
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
  const { medicalCodes, diagnoses, claimedSubsidies = [], institution, birthYear, clinicType } =
    params;

  const hasCodes = medicalCodes.length > 0 && medicalCodes.some((c) => c.trim() !== "");
  const hasDiagnoses = diagnoses.length > 0 && diagnoses.some((d) => d.trim() !== "");
  const hasClaims = claimedSubsidies.length > 0 && claimedSubsidies.some((c) => c.trim() !== "");

  if (!hasCodes && !hasDiagnoses && !hasClaims) {
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

    let allSchemes = (data as SubsidyScheme[]) ?? [];

    // A scheme with no applicable_codes/applicable_diagnoses is universal (matches everything).
    allSchemes = allSchemes.filter((scheme) => {
      const isUniversal = scheme.applicable_codes.length === 0 && scheme.applicable_diagnoses.length === 0;
      if (isUniversal) return true;

      const codeMatch = scheme.applicable_codes.some((c) => nonEmptyCodes.includes(c));
      const diagnosisMatch = scheme.applicable_diagnoses.some((d) =>
        nonEmptyDiagnoses.some((docDiagnosis) => docDiagnosis.includes(d.toLowerCase()))
      );
      // A bill that explicitly names this scheme as a claim/payer (e.g. "Claim from CHAS")
      // is itself evidence of eligibility, regardless of diagnosis/code extraction.
      const schemeName = scheme.name.toLowerCase();
      const claimMatch = nonEmptyClaims.some(
        (claim) => schemeName.includes(claim) || claim.includes(schemeName)
      );
      return codeMatch || diagnosisMatch || claimMatch;
    });

    // Filter by clinic type — empty institution_types means universal.
    if (resolvedClinicType) {
      allSchemes = allSchemes.filter(
        (scheme) => scheme.institution_types.length === 0 || scheme.institution_types.includes(resolvedClinicType)
      );
    }

    // Filter by birth year
    allSchemes = filterByBirthYear(allSchemes, birthYear);

    if (allSchemes.length === 0) {
      return {
        subsidies: [],
        message:
          "No matching subsidy schemes were found. Please consult a medical social worker for further assistance.",
        needsManualInput: false,
      };
    }

    const subsidies = allSchemes.map(toSubsidyResult);

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
