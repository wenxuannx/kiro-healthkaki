import { createClient } from "@/services/supabase/server";
import { translateBatch, NON_ENGLISH_LANGUAGES } from "@/lib/translator";
import type {
  SubsidyScheme,
  SubsidyLookupParams,
  SubsidyLookupResult,
  SubsidyResult,
  SupportedLanguage,
  Language,
} from "@/types";

type ClinicType = "public_hospital" | "polyclinic" | "gp_clinic" | "dental_clinic";

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
  // Checked before the generic "clinic" branch below, since a dental clinic
  // name (e.g. "ABC Dental Clinic") would otherwise also match "clinic".
  if (lower.includes("dental")) return "dental_clinic";
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
 * A Singapore-born citizen was never "naturalised" and so has no
 * citizenship_year on file — unlike a PR or a naturalised citizen, whose
 * status began at a specific, later date that we can't infer. When status is
 * "citizen" and citizenshipYear is missing, fall back to birthYear (citizen
 * since birth) rather than treating the cutoff as unconfirmable.
 */
export function filterByCitizenship(
  schemes: SubsidyScheme[],
  citizenshipStatus: "citizen" | "pr" | "foreigner" | undefined,
  citizenshipYear: number | undefined,
  birthYear: number | undefined
): SubsidyScheme[] {
  const effectiveCitizenshipYear =
    citizenshipYear ?? (citizenshipStatus === "citizen" ? birthYear : undefined);

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
      if (effectiveCitizenshipYear === undefined) return false;
      if (effectiveCitizenshipYear > scheme.citizenship_by_year) return false;
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
  diagnoses: string[],
  resolvedClinicType: ClinicType | null
): { amount: number | null; period: "visit" | "year" | null; capNote: string | null } {
  const tiers = scheme.pricing_tiers;
  if (!tiers) return { amount: null, period: null, capNote: null };

  // pricing_institution_types restricts tiers to specific clinic types (e.g.
  // Merdeka Generation's flat CHAS-style dollar amount only applies at a GP
  // visit — at a polyclinic/hospital the benefit is a percentage instead,
  // see bonus_percentage in toSubsidyResult). Null/undefined means no
  // restriction — undefined is treated the same as null so this doesn't
  // break before the pricing_institution_types migration has been applied.
  const pricingInstitutionTypes = scheme.pricing_institution_types ?? null;
  const institutionOk =
    pricingInstitutionTypes === null ||
    (resolvedClinicType !== null && pricingInstitutionTypes.includes(resolvedClinicType));
  if (!institutionOk) return { amount: null, period: null, capNote: null };

  const chronicMatches = diagnoses.filter((d) => CDMP_DIAGNOSES.includes(d)).length;
  const tierKey =
    "flat" in tiers
      ? "flat"
      : chronicMatches >= 2
        ? "chronic_complex"
        : chronicMatches === 1
          ? "chronic_simple"
          : "common";

  const amount = tiers[tierKey] ?? null;
  const cap = scheme.annual_caps?.[tierKey] ?? null;
  const capNote =
    amount !== null && cap !== null
      ? `Capped at $${cap.toFixed(0)} a year across visits at this tier.`
      : null;

  return { amount, period: scheme.pricing_period, capNote };
}

/**
 * Transforms a SubsidyScheme DB row into a SubsidyResult for the API response.
 * The DB only stores a translated name per language (chinese_name/malay_name/tamil_name) —
 * there are no separately translated description columns, so coverageDescription and
 * eligibilityConditions reuse the English description for every language.
 */
function toSubsidyResult(
  scheme: SubsidyScheme,
  diagnoses: string[],
  resolvedClinicType: ClinicType | null,
  age: number | undefined,
  matchedSchemeIds: Set<string>,
  birthYear: number | undefined
): SubsidyResult {
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

  const { amount, period, capNote } = resolveFlatAmount(scheme, diagnoses, resolvedClinicType);

  // The Merdeka Bonus (and similarly-shaped future stacked bonuses) only
  // applies at specific institution types (public hospital SOC/polyclinic,
  // not private GP/dental where the flat pricing_tiers amount applies
  // instead) — see bonus_institution_types.
  const bonusPercentage = scheme.bonus_percentage ?? null;
  const bonusApplies =
    bonusPercentage !== null &&
    resolvedClinicType !== null &&
    (scheme.bonus_institution_types?.includes(resolvedClinicType) ?? false);

  // Age-banded bonus (e.g. MediShield Life's generation-package premium
  // top-ups) — each tier is gated on the caller's current age, and
  // optionally also on satisfying another scheme's own eligibility filters
  // (cohort_scheme_id) and/or a fixed birth-year cutoff (max_birth_year).
  // Multiple cohorts can contribute tiers to the same scheme; the highest
  // percentage among all tiers the caller satisfies applies.
  const ageBonusTiers = scheme.age_bonus_tiers ?? null;
  const applicableAgeBonusTiers =
    ageBonusTiers !== null && age !== undefined
      ? ageBonusTiers.filter(
          (t) =>
            age >= t.min_age &&
            (t.cohort_scheme_id == null || matchedSchemeIds.has(t.cohort_scheme_id)) &&
            (t.max_birth_year == null || (birthYear !== undefined && birthYear <= t.max_birth_year))
        )
      : [];
  const winningAgeBonusTier =
    applicableAgeBonusTiers.length > 0
      ? applicableAgeBonusTiers.reduce((best, t) => (t.percentage > best.percentage ? t : best))
      : null;
  const ageBonusPercentage = winningAgeBonusTier?.percentage ?? null;

  const estimatedCoveragePercent =
    (scheme.coverage_percentage ?? 0) +
    (bonusApplies ? bonusPercentage! : 0) +
    (ageBonusPercentage ?? 0);

  // Some schemes have neither a flat modelled amount nor a coverage
  // percentage of their own — their real payout depends on data this
  // pipeline doesn't extract (MediShield Life's day-rate/claim-limit tables;
  // MediFund's discretionary, human-reviewed process; MediSave's heavy-
  // therapy and vaccination/screening schedules, which vary per drug/vaccine
  // rather than being a single dollar figure). Showing "0%" there would read
  // as "no help available", which is wrong — show an explanatory note
  // instead. Based on the scheme's OWN coverage_percentage/amount, not the
  // final estimatedCoveragePercent — otherwise a Merdeka Generation member's
  // age-banded MediShield top-up (5%/10%) would make estimatedCoveragePercent
  // non-zero and silently swallow this explanatory text.
  const schemeNameLower = scheme.name.toLowerCase();
  const baseCoverageComputed = scheme.coverage_percentage !== null || amount !== null;
  const fallbackNoteTranslations: Record<Language, string> | null = !baseCoverageComputed
    ? schemeNameLower.includes("medifund")
      ? {
          en: "Case-by-case — apply through a Medical Social Worker at the hospital.",
          zh: "个案审核——请通过医院的医务社工申请。",
          ms: "Kes demi kes — mohon melalui Pekerja Sosial Perubatan di hospital.",
          ta: "தனித்தனி வழக்கு — மருத்துவமனையில் உள்ள மருத்துவ சமூக பணியாளர் மூலம் விண்ணப்பிக்கவும்.",
        }
      : schemeNameLower.includes("vaccination") || schemeNameLower.includes("screening")
        ? {
            en: "Often covered up to a fixed amount per vaccine/screening — check with the clinic which ones qualify.",
            zh: "通常按每种疫苗/筛查项目提供固定金额的津贴——请向诊所查询哪些项目符合资格。",
            ms: "Selalunya dilindungi sehingga jumlah tetap bagi setiap vaksin/saringan — semak dengan klinik yang mana layak.",
            ta: "பெரும்பாலும் ஒவ்வொரு தடுப்பூசி/பரிசோதனைக்கும் நிலையான தொகை வரை உள்ளடக்கப்படும் — எவை தகுதியானவை என கிளினிக்கிடம் சரிபார்க்கவும்.",
          }
        : schemeNameLower.includes("heavy medical") || schemeNameLower.includes("dialysis")
          ? {
              en: "Heavily subsidised for ongoing treatment — check the exact amount with the hospital billing counter.",
              zh: "持续治疗可获大幅津贴——具体金额请向医院收费柜台查询。",
              ms: "Disubsidi secara besar-besaran untuk rawatan berterusan — semak jumlah tepat dengan kaunter bil hospital.",
              ta: "தொடர்ச்சியான சிகிச்சைக்கு அதிக மானியம் — சரியான தொகையை மருத்துவமனை பில்லிங் கவுண்டரிடம் சரிபார்க்கவும்.",
            }
          : schemeNameLower.includes("medishield")
            ? {
                en: "Covers large hospital bills and selected costly outpatient treatments, up to $200,000 a year. You pay a co-insurance share starting at 10% (higher for larger bills), after a deductible of $1,500–$3,000 depending on your ward class and age. Ask the billing counter how much of your specific bill MediShield Life has claimed.",
                zh: "涵盖高额住院账单及部分高费用门诊治疗，每年最高$200,000。在扣除$1,500至$3,000（视病房等级及年龄而定）的自付额后，您需承担从10%起的共同保险份额（账单越大比例可能更高）。请向收费柜台查询MediShield Life已承担您账单的具体金额。",
                ms: "Meliputi bil hospital yang besar dan rawatan pesakit luar terpilih yang mahal, sehingga $200,000 setahun. Anda membayar bahagian ko-insurans bermula pada 10% (lebih tinggi untuk bil yang lebih besar), selepas potongan $1,500–$3,000 bergantung kepada kelas wad dan umur anda. Tanya kaunter bil berapa banyak bil khusus anda telah dituntut oleh MediShield Life.",
                ta: "பெரிய மருத்துவமனை பில்கள் மற்றும் தேர்ந்தெடுக்கப்பட்ட அதிக செலவு கொண்ட வெளிநோயாளர் சிகிச்சைகளை ஆண்டுக்கு $200,000 வரை உள்ளடக்கும். உங்கள் வார்டு வகை மற்றும் வயதைப் பொறுத்து $1,500–$3,000 விலக்குத் தொகைக்குப் பிறகு, 10%-இல் தொடங்கும் இணை-காப்பீட்டுப் பங்கை நீங்கள் செலுத்த வேண்டும். MediShield Life உங்கள் குறிப்பிட்ட பில்லில் எவ்வளவு உரிமைகோரியுள்ளது என பில்லிங் கவுண்டரிடம் கேளுங்கள்.",
              }
            : {
                en: "Coverage depends on your specific treatment and claim limits — check with the hospital billing counter.",
                zh: "保障范围取决于您的具体治疗及索赔限额——请向医院收费柜台查询。",
                ms: "Perlindungan bergantung kepada rawatan khusus dan had tuntutan anda — semak dengan kaunter bil hospital.",
                ta: "பாதுகாப்பு உங்கள் குறிப்பிட்ட சிகிச்சை மற்றும் உரிமைகோரல் வரம்புகளைப் பொறுத்தது — மருத்துவமனை பில்லிங் கவுண்டரிடம் சரிபார்க்கவும்.",
              }
    : null;

  // The cardholder-facing name of the cohort scheme that produced the
  // winning tier (Merdeka Generation's 5%/10%, Pioneer Generation's
  // 50%/100%) — keeps the note text generic across cohorts instead of
  // hardcoding one scheme's name.
  const COHORT_LABELS: Record<string, Record<Language, string>> = {
    merdeka_generation: { en: "Merdeka Generation", zh: "立国一代", ms: "Generasi Merdeka", ta: "Merdeka Generation" },
    pioneer_generation: { en: "Pioneer Generation", zh: "建国一代", ms: "Generasi Perintis", ta: "Pioneer Generation" },
  };
  const cohortLabel =
    winningAgeBonusTier?.cohort_scheme_id != null
      ? (COHORT_LABELS[winningAgeBonusTier.cohort_scheme_id] ?? null)
      : null;
  // If a higher tier from the same cohort is still reachable at an older age
  // (e.g. Merdeka's 5% rising to 10% at 76), mention it — but not for a
  // birth-year-gated tier like Pioneer's full coverage for those born ≤1934,
  // since that isn't something the caller can "grow into".
  const nextAgeBonusTier =
    winningAgeBonusTier != null && ageBonusTiers !== null
      ? ageBonusTiers
          .filter(
            (t) =>
              t.cohort_scheme_id === winningAgeBonusTier.cohort_scheme_id &&
              t.max_birth_year == null &&
              t.percentage > winningAgeBonusTier.percentage
          )
          .sort((a, b) => a.min_age - b.min_age)[0] ?? null
      : null;

  const ageBonusNoteTranslations: Record<Language, string> | null =
    ageBonusPercentage !== null && cohortLabel !== null
      ? ageBonusPercentage >= 100
        ? {
            en: `As a ${cohortLabel.en} cardholder, your annual MediShield Life premium is fully covered.`,
            zh: `作为${cohortLabel.zh}持卡人，您的终身健保年度保费已获全额补贴。`,
            ms: `Sebagai pemegang kad ${cohortLabel.ms}, premium tahunan MediShield Life anda dilindungi sepenuhnya.`,
            ta: `${cohortLabel.ta} அட்டைதாரராக, உங்கள் ஆண்டு MediShield Life பிரீமியம் முழுவதுமாக ஈடுசெய்யப்படுகிறது.`,
          }
        : {
            en: `As a ${cohortLabel.en} cardholder, you also get an extra ${ageBonusPercentage}% off your annual MediShield Life premium${
              nextAgeBonusTier ? ` (rising to ${nextAgeBonusTier.percentage}% once you turn ${nextAgeBonusTier.min_age})` : ""
            }.`,
            zh: `作为${cohortLabel.zh}持卡人，您的终身健保年度保费还可再获额外${ageBonusPercentage}%的折扣${
              nextAgeBonusTier ? `（年满${nextAgeBonusTier.min_age}岁后将提高至${nextAgeBonusTier.percentage}%）` : ""
            }。`,
            ms: `Sebagai pemegang kad ${cohortLabel.ms}, anda turut mendapat tambahan ${ageBonusPercentage}% diskaun untuk premium tahunan MediShield Life anda${
              nextAgeBonusTier ? ` (meningkat kepada ${nextAgeBonusTier.percentage}% apabila anda mencapai umur ${nextAgeBonusTier.min_age})` : ""
            }.`,
            ta: `${cohortLabel.ta} அட்டைதாரராக, உங்கள் ஆண்டு MediShield Life பிரீமியத்தில் கூடுதலாக ${ageBonusPercentage}% தள்ளுபடி பெறுவீர்கள்${
              nextAgeBonusTier ? ` (${nextAgeBonusTier.min_age} வயதை அடைந்தவுடன் ${nextAgeBonusTier.percentage}%-ஆக உயரும்)` : ""
            }.`,
          }
      : null;

  const LANGS: Language[] = ["en", "zh", "ms", "ta"];
  const noteForLang = (lang: Language): string =>
    [fallbackNoteTranslations?.[lang], ageBonusNoteTranslations?.[lang]]
      .filter((v): v is string => Boolean(v))
      .join(" ");
  const joinedNotes = Object.fromEntries(LANGS.map((l) => [l, noteForLang(l)])) as Record<
    Language,
    string
  >;

  // Generation-package dental subsidies vary too widely by procedure to
  // model as a single number — explain the range instead.
  const DENTAL_RANGE_NOTES: Record<string, Record<Language, string>> = {
    merdeka_generation: {
      en: "Dental treatment subsidies range from $16.00 to $620.00 per procedure depending on complexity — check with the CHAS dental clinic for your specific procedure.",
      zh: "牙科治疗津贴根据疗程复杂程度，每项介于$16.00至$620.00之间——请向CHAS牙科诊所查询您具体疗程的津贴。",
      ms: "Subsidi rawatan pergigian antara $16.00 hingga $620.00 setiap prosedur bergantung kepada kerumitan — semak dengan klinik pergigian CHAS untuk prosedur khusus anda.",
      ta: "பல் மருத்துவ சிகிச்சை மானியங்கள் சிக்கலான தன்மையைப் பொறுத்து ஒரு சிகிச்சைக்கு $16.00 முதல் $620.00 வரை மாறுபடும் — உங்கள் குறிப்பிட்ட சிகிச்சைக்கு CHAS பல் மருத்துவ கிளினிக்கிடம் சரிபார்க்கவும்.",
    },
    pioneer_generation: {
      en: "Dental treatment subsidies range from $21.00 to $625.00 per procedure depending on complexity — check with the CHAS dental clinic for your specific procedure.",
      zh: "牙科治疗津贴根据疗程复杂程度，每项介于$21.00至$625.00之间——请向CHAS牙科诊所查询您具体疗程的津贴。",
      ms: "Subsidi rawatan pergigian antara $21.00 hingga $625.00 setiap prosedur bergantung kepada kerumitan — semak dengan klinik pergigian CHAS untuk prosedur khusus anda.",
      ta: "பல் மருத்துவ சிகிச்சை மானியங்கள் சிக்கலான தன்மையைப் பொறுத்து ஒரு சிகிச்சைக்கு $21.00 முதல் $625.00 வரை மாறுபடும் — உங்கள் குறிப்பிட்ட சிகிச்சைக்கு CHAS பல் மருத்துவ கிளினிக்கிடம் சரிபார்க்கவும்.",
    },
  };

  const coverageNoteTranslations: Record<Language, string> | null =
    resolvedClinicType === "dental_clinic" && DENTAL_RANGE_NOTES[scheme.id]
      ? DENTAL_RANGE_NOTES[scheme.id]
      : joinedNotes.en.length > 0
        ? joinedNotes
        : capNote !== null
          ? { en: capNote, zh: capNote, ms: capNote, ta: capNote }
          : null;

  const coverageNote = coverageNoteTranslations?.en ?? null;

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    coverageDescription: scheme.description,
    eligibilityConditions: scheme.description,
    estimatedCoveragePercent,
    estimatedAmount: amount,
    estimatedAmountPeriod: amount !== null ? period : null,
    coverageNote,
    coverageNoteTranslations,
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
    allSchemes = filterByCitizenship(allSchemes, citizenshipStatus, citizenshipYear, birthYear);

    // Pioneer/Merdeka Generation supersedes standard CHAS tiers when matched.
    allSchemes = excludeIncomeTierIfCohortMatched(allSchemes, birthYear);

    // Snapshot of scheme ids that survived all eligibility filters, so
    // age-banded bonuses (e.g. MediShield Life's Merdeka premium top-up) can
    // check whether the caller also qualifies for a cohort scheme like
    // Merdeka Generation without re-running its eligibility logic inline.
    const matchedSchemeIds = new Set(allSchemes.map((scheme) => scheme.id));
    const age = birthYear !== undefined ? new Date().getFullYear() - birthYear : undefined;

    let subsidies = allSchemes.map((scheme) =>
      toSubsidyResult(scheme, nonEmptyDiagnoses, resolvedClinicType, age, matchedSchemeIds, birthYear)
    );

    // A CHAS tier that resolves to no subsidy for this visit (e.g. CHAS
    // Green pays nothing for a common illness) isn't a real match — drop it
    // rather than showing a $0 "eligible" card.
    subsidies = subsidies.filter((s) => {
      const scheme = allSchemes.find((sc) => sc.name === s.schemeName);
      if (!scheme || scheme.pricing_tiers === null) return true;

      // Institution-gated pricing_tiers (e.g. Merdeka Generation's flat
      // dollar amount only applying at a GP visit) legitimately resolve to
      // no amount at other clinic types, where a bonus_percentage or a
      // scheme-specific coverageNote may apply instead — don't drop those.
      const pricingInstitutionTypes = scheme.pricing_institution_types ?? null;
      const institutionOk =
        pricingInstitutionTypes === null ||
        (resolvedClinicType !== null && pricingInstitutionTypes.includes(resolvedClinicType));
      if (!institutionOk) return true;

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
