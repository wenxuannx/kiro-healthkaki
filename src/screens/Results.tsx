import { motion } from 'framer-motion'
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  ChevronRight,
  FileText,
  Phone,
  Pill,
  Search,
  Stethoscope,
  Zap,
} from 'lucide-react'

import { Badge, Button, Card, Divider, TopBar } from '../components/ui'
import TTSPanel from '../components/TTSPanel'
import { MedicationsPanel, OcrBanner } from './MedicationsScreen'
import { useLang, T } from '../hooks/i18n'
import { getSubsidyDetail } from '../lib/subsidy-details'
import { SchemeIcon } from '../lib/icons'
import type {
  DocumentTypeId,
  Language,
  ProcessDocumentResponse,
  Screen,
  SubsidyCard,
  SubsidyResult,
  SupportedLanguage,
} from '../types'

interface Props {
  onNavigate: (screen: Screen) => void
  onSelectSubsidy: (subsidy: SubsidyCard) => void
  apiResult?: ProcessDocumentResponse | null
  // Used to personalize Pioneer/Merdeka Generation detail (their MediShield
  // Life premium subsidy and MediSave top-up both scale with age).
  birthYear?: number | null
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
}

const SUBSIDY_STYLES = [
  ['pioneer', 'award', 'orange'],
  ['merdeka', 'medal', 'gray'],
  ['chas', 'tag', 'navy'],
  ['medisave', 'credit-card', 'teal'],
  ['cdmp', 'hospital', 'teal'],
  ['medishield', 'shield', 'teal'],
  ['medifund', 'wallet', 'orange'],
] as const

function toSubsidyCard(
  result: SubsidyResult,
  index: number,
  language: Language,
  birthYear: number | undefined,
): SubsidyCard {
  const lowerName = result.schemeName.toLowerCase()
  const style = SUBSIDY_STYLES.find(([key]) => lowerName.includes(key))
  const translation = language !== 'en' ? result.translations?.[LANG_TO_SUPPORTED[language]] : null
  // Only show a secondary translated name when the UI is actually in that
  // language — showing Chinese under an English name regardless of the
  // selected language was a leftover from an earlier hardcoded version.
  const translatedName = translation?.schemeName ?? ''
  const translatedDescription = translation?.coverageDescription ?? result.coverageDescription
  const translatedEligibility = translation?.eligibilityConditions ?? result.eligibilityConditions

  const detail = getSubsidyDetail(result.schemeId, birthYear, language)

  return {
    id: `subsidy-${index}`,
    schemeId: result.schemeId,
    name: result.schemeName,
    chineseName: translatedName !== result.schemeName ? translatedName : '',
    // Every scheme returned by the API has already passed all eligibility
    // filters (income/citizenship/age/etc) — being in this list IS eligibility.
    eligible: true,
    saves: result.estimatedCoveragePercent,
    outOfPocket: Math.max(0, 100 - result.estimatedCoveragePercent),
    amount: result.estimatedAmount,
    amountPeriod: result.estimatedAmountPeriod,
    coverageNote: result.coverageNoteTranslations?.[language] ?? result.coverageNote,
    icon: style?.[1] ?? 'file',
    badgeColor: style?.[2] ?? 'teal',
    description: translatedDescription,
    // Prefer the hand-written benefits/instructions for known schemes (English
    // only — no translated equivalent exists for this curated content yet);
    // fall back to the translated DB description/eligibility text for any
    // scheme without curated content.
    benefits: detail?.benefits ?? translatedEligibility.split(/[.;]\s*/).filter(Boolean),
    howToUse: detail?.howToUse ?? translatedDescription,
  }
}

function badgeVariant(color: SubsidyCard['badgeColor']) {
  if (color === 'orange') return 'orange' as const
  if (color === 'navy') return 'navy' as const
  if (color === 'gray') return 'gray' as const
  return 'teal' as const
}

function formatMoney(currency: string, value: number | null) {
  if (value === null) return '—'

  const upperCurrency = currency.toUpperCase()
  const currencyCode = /^[A-Z]{3}$/.test(upperCurrency)
    ? upperCurrency
    : 'SGD'

  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value)
}

const LANG_TO_SUPPORTED: Record<Language, SupportedLanguage> = {
  en: 'en-SG',
  zh: 'cmn-Hans-CN',
  ms: 'ms-MY',
  ta: 'ta-IN',
}

/**
 * Builds the "Read Aloud" text for the results screen in the user's selected
 * language, using the translated scheme names and descriptions returned by the
 * API. Falls back to the English source per-field when a translation is missing.
 */
function buildResultsSpeech(
  language: Language,
  subsidies: SubsidyResult[],
  institution: string | null,
  diagnoses: string[] = [],
  billTotal: number | null = null,
  currency: string = 'SGD',
  totalCoverage: number | null = null,
  savedAmount: number | null = null,
  payableAmount: number | null = null,
): string {
  const supported = LANG_TO_SUPPORTED[language]
  const clinic = institution ?? ''

  const diagnosisSentence =
    diagnoses.length > 0
      ? {
          en: `Diagnosis or reason for referral: ${diagnoses.join(', ')}.`,
          zh: `转诊诊断或原因：${diagnoses.join('、')}。`,
          ms: `Diagnosis atau sebab rujukan: ${diagnoses.join(', ')}.`,
          ta: `பரிந்துரைக்கான நோய் கண்டறிதல் அல்லது காரணம்: ${diagnoses.join(', ')}.`,
        }[language]
      : ''

  if (subsidies.length === 0) {
    const none: Record<Language, string> = {
      en: `Results for ${clinic}. No matching subsidy schemes were found.`,
      zh: `${clinic}的结果。未找到符合条件的补贴计划。`,
      ms: `Keputusan untuk ${clinic}. Tiada skim subsidi yang sepadan ditemui.`,
      ta: `${clinic} முடிவுகள். பொருந்தும் மானியத் திட்டங்கள் எதுவும் இல்லை.`,
    }
    return [none[language].trim(), diagnosisSentence].filter(Boolean).join(' ')
  }

  const intro: Record<Language, string> = {
    en: `Results for ${clinic}. Found ${subsidies.length} subsidy ${subsidies.length === 1 ? 'scheme' : 'schemes'} for you.`,
    zh: `${clinic}的结果。为您找到 ${subsidies.length} 项补贴。`,
    ms: `Keputusan untuk ${clinic}. Menemui ${subsidies.length} skim subsidi untuk anda.`,
    ta: `${clinic} முடிவுகள். உங்களுக்காக ${subsidies.length} மானியத் திட்டங்கள் கண்டறியப்பட்டன.`,
  }

  const billSentence = billTotal === null
    ? ''
    : payableAmount !== null && savedAmount !== null && totalCoverage !== null
      ? {
          en: `Your original bill is ${formatMoney(currency, billTotal)}. After subsidies, you pay up to ${100 - totalCoverage} percent, about ${formatMoney(currency, payableAmount)}, saving you about ${formatMoney(currency, savedAmount)}. The final payable amount requires provider confirmation.`,
          zh: `您的原始账单为${formatMoney(currency, billTotal)}。补贴后，您最多需支付${100 - totalCoverage}%，约${formatMoney(currency, payableAmount)}，为您节省约${formatMoney(currency, savedAmount)}。最终应付款项需经服务提供商确认。`,
          ms: `Bil asal anda ialah ${formatMoney(currency, billTotal)}. Selepas subsidi, anda membayar sehingga ${100 - totalCoverage} peratus, iaitu kira-kira ${formatMoney(currency, payableAmount)}, menjimatkan kira-kira ${formatMoney(currency, savedAmount)}. Jumlah akhir yang perlu dibayar memerlukan pengesahan penyedia.`,
          ta: `உங்கள் அசல் மசோதா ${formatMoney(currency, billTotal)}. மானியங்களுக்குப் பிறகு, நீங்கள் ${100 - totalCoverage} சதவீதம் வரை, சுமார் ${formatMoney(currency, payableAmount)} செலுத்த வேண்டும், இது சுமார் ${formatMoney(currency, savedAmount)} சேமிக்கிறது. கடைசி செலுத்த வேண்டிய தொகைக்கு வழங்குநரின் உறுதிப்படுத்தல் தேவை.`,
        }[language]
      : {
          en: `Your original bill is ${formatMoney(currency, billTotal)}.`,
          zh: `您的原始账单为${formatMoney(currency, billTotal)}。`,
          ms: `Bil asal anda ialah ${formatMoney(currency, billTotal)}.`,
          ta: `உங்கள் அசல் மசோதா ${formatMoney(currency, billTotal)}.`,
        }[language]

  const periodWord: Record<'visit' | 'year', Record<Language, string>> = {
    visit: { en: 'per visit', zh: '每次就诊', ms: 'setiap lawatan', ta: 'ஒரு வருகைக்கு' },
    year: { en: 'a year', zh: '每年', ms: 'setahun', ta: 'ஆண்டுக்கு' },
  }

  const perScheme = subsidies.map((s) => {
    const translation = s.translations[supported]
    const name = translation?.schemeName ?? s.schemeName
    const desc = translation?.coverageDescription ?? s.coverageDescription
    const pct = s.estimatedCoveragePercent

    // Mirrors the card display logic: a coverageNote alongside a real,
    // non-zero percentage (e.g. Merdeka Generation's 25% bonus, MediShield
    // Life's 5%/10% age bonus) should still be read out as a percentage —
    // "coverage varies" is only correct when there's truly no computed
    // percentage or dollar amount (e.g. MediFund's case-by-case review).
    if (s.estimatedAmount !== null) {
      const amountText = formatMoney('SGD', s.estimatedAmount)
      const period = periodWord[s.estimatedAmountPeriod === 'year' ? 'year' : 'visit'][language]
      return {
        en: `${name}, up to ${amountText} ${period}. ${desc}`,
        zh: `${name}，最高${amountText}${period}。${desc}`,
        ms: `${name}, sehingga ${amountText} ${period}. ${desc}`,
        ta: `${name}, ${amountText} ${period} வரை. ${desc}`,
      }[language]
    }

    if (pct > 0) {
      return {
        en: `${name}, up to ${pct} percent coverage. ${desc}`,
        zh: `${name}，最高覆盖百分之 ${pct}。${desc}`,
        ms: `${name}, perlindungan sehingga ${pct} peratus. ${desc}`,
        ta: `${name}, ${pct} சதவீதம் வரை. ${desc}`,
      }[language]
    }

    return {
      en: `${name}, coverage varies. ${desc}`,
      zh: `${name}，覆盖比例视情况而定。${desc}`,
      ms: `${name}, perlindungan berbeza-beza. ${desc}`,
      ta: `${name}, பாதுகாப்பு மாறுபடும். ${desc}`,
    }[language]
  })

  return [intro[language].trim(), diagnosisSentence, billSentence, ...perScheme].filter(Boolean).join(' ')
}

/**
 * Builds the spoken summary for a referral letter — reads back only what was
 * extracted from the document (destination, diagnosis, referral type,
 * appointment details). Referrals happen before any subsidy is claimed, so
 * subsidy schemes/percentages are intentionally never mentioned here.
 */
// Inserts spaces between digits so TTS engines read a phone number digit by
// digit ("six two two seven...") instead of as one large integer.
function spellOutDigits(value: string): string {
  return value.replace(/\d/g, (digit) => `${digit} `).trim()
}

function buildReferralSpeech(
  language: Language,
  institution: string | null,
  diagnoses: string[],
  referralType: string | null,
  appointmentDateTime: string | null,
  appointmentCenterTel: string | null,
): string {
  const clinic = institution ?? ''

  const intro: Record<Language, string> = {
    en: `Referral details${clinic ? ` for ${clinic}` : ''}.`,
    zh: `转诊详情${clinic ? `：${clinic}` : ''}。`,
    ms: `Butiran rujukan${clinic ? ` untuk ${clinic}` : ''}.`,
    ta: `பரிந்துரை விவரங்கள்${clinic ? ` ${clinic}` : ''}.`,
  }

  const diagnosisSentence = diagnoses.length > 0
    ? {
        en: `Diagnosis or reason for referral: ${diagnoses.join(', ')}.`,
        zh: `转诊诊断或原因：${diagnoses.join('、')}。`,
        ms: `Diagnosis atau sebab rujukan: ${diagnoses.join(', ')}.`,
        ta: `பரிந்துரைக்கான நோய் கண்டறிதல் அல்லது காரணம்: ${diagnoses.join(', ')}.`,
      }[language]
    : ''

  const referralTypeSentence = referralType
    ? {
        en: `Referral type: ${referralType}.`,
        zh: `转诊类型：${referralType}。`,
        ms: `Jenis rujukan: ${referralType}.`,
        ta: `பரிந்துரை வகை: ${referralType}.`,
      }[language]
    : ''

  const appointmentSentence = appointmentDateTime
    ? {
        en: `Appointment date and time: ${appointmentDateTime}.`,
        zh: `预约日期和时间：${appointmentDateTime}。`,
        ms: `Tarikh dan masa temu janji: ${appointmentDateTime}.`,
        ta: `சந்திப்பு தேதி மற்றும் நேரம்: ${appointmentDateTime}.`,
      }[language]
    : ''

  const telSpelled = appointmentCenterTel ? spellOutDigits(appointmentCenterTel) : ''
  const telSentence = appointmentCenterTel
    ? {
        en: `Appointment centre telephone: ${telSpelled}.`,
        zh: `预约中心电话：${telSpelled}。`,
        ms: `Telefon pusat temu janji: ${telSpelled}.`,
        ta: `சந்திப்பு மைய தொலைபேசி: ${telSpelled}.`,
      }[language]
    : ''

  return [
    intro[language].trim(),
    diagnosisSentence,
    referralTypeSentence,
    appointmentSentence,
    telSentence,
  ].filter(Boolean).join(' ')
}

// Which sections a document type surfaces on the results screen. Prescription
// slips never had a bill to explain, and referral letters are captured
// before a bill exists.
// `meds` is offered for any document type whenever prescriptions were
// actually extracted — a clinic bill can itemise dispensed medications too.
function sectionsFor(documentType: DocumentTypeId | null) {
  switch (documentType) {
    case 'prescription':
      return { hero: false, bill: false, subsidies: false, meds: true, title: 'meds' as const }
    case 'invoice':
      return { hero: true, bill: true, subsidies: true, meds: true, title: 'results' as const }
    case 'referral':
      return { hero: false, bill: false, subsidies: false, meds: true, title: 'preview' as const }
    default:
      return { hero: true, bill: true, subsidies: true, meds: true, title: 'results' as const }
  }
}

function EmptyResults({ onNavigate, t }: Pick<Props, 'onNavigate'> & { t: Record<string, string> }) {
  return (
    <div className="min-h-full bg-neutral-50 flex flex-col">
      <TopBar title={t.results_title} onBack={() => onNavigate('home')} />
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 grid place-items-center">
          <Search className="w-7 h-7 text-neutral-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-neutral-900 mb-1.5">{t.empty_state_title}</p>
          <p className="text-sm text-neutral-500 max-w-xs">{t.empty_state_body}</p>
        </div>
        <OcrBanner text={t.estimate_banner} />
        <div className="w-full max-w-xs flex flex-col gap-3 mt-1">
          <Button variant="teal" size="lg" fullWidth onClick={() => onNavigate('home')}>
            {t.scan_different}
          </Button>
          <Button variant="secondary" size="md" fullWidth onClick={() => onNavigate('help')}>
            {t.get_help}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Results({
  onNavigate,
  onSelectSubsidy,
  apiResult,
  birthYear,
}: Props) {
  const { language } = useLang()
  const t = T[language]

  if (!apiResult) {
    return <EmptyResults onNavigate={onNavigate} t={t} />
  }

  const { extracted, subsidies, message } = apiResult
  const subsidyCards = [...subsidies]
    .sort(
      (first, second) =>
        second.estimatedCoveragePercent - first.estimatedCoveragePercent,
    )
    .map((result, index) => toSubsidyCard(result, index, language, birthYear ?? undefined))
  const billTotal = extracted.bill?.totalAmount ?? null
  const currency = extracted.bill?.currency ?? 'SGD'
  const hasAppliedSubsidy = subsidyCards.some((card) => card.eligible)

  const sections = sectionsFor(extracted.documentType)

  const nothingDetected =
    !extracted.bill &&
    extracted.prescriptions.length === 0 &&
    subsidyCards.length === 0

  if (nothingDetected) {
    return <EmptyResults onNavigate={onNavigate} t={t} />
  }

  const visitDate = extracted.visitDate
    ? new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(
        new Date(`${extracted.visitDate}T00:00:00`),
      )
    : 'Date not identified'

  const screenTitle =
    sections.title === 'meds'
      ? t.meds_title
      : sections.title === 'preview'
        ? t.referral_preview_title
        : t.results_title

  // The exact payable amount is only computable when no subsidy matched (so
  // the bill total stands as-is). When a subsidy did match, the backend gives
  // a coverage percentage rather than a dollar deduction — showing "$—" as
  // the headline in that case would present a placeholder as if it were data,
  // so the headline becomes the coverage percentage instead.
  // A coverageNote usually means no real percentage (saves is a placeholder 0
  // from the DB's null coverage_percentage) — exclude those so they can't drag
  // the headline down to a misleading "Up to 0%". But a note can also be
  // purely explanatory on top of a real bonus percentage (e.g. Merdeka
  // Generation's 25% bonus, MediShield Life's 5%/10% age bonus) — saves > 0
  // is the actual signal for "this card has real coverage data".
  const cardsWithKnownCoverage = subsidyCards.filter((card) => card.saves > 0 || !card.coverageNote)
  // Multiple schemes can apply to the same bill and stack (e.g. Merdeka
  // Generation's 25% bonus plus MediShield Life's 5% age bonus) — sum their
  // coverage rather than taking the single highest one, capped at 100% since
  // coverage can't exceed the full bill.
  const totalCoverage = cardsWithKnownCoverage.length > 0
    ? Math.min(100, cardsWithKnownCoverage.reduce((sum, card) => sum + card.saves, 0))
    : null

  // Prefer computing the deduction from the app's own matched subsidies over
  // the OCR-extracted "Patient Total" printed on the bill, since that figure
  // can disagree with what the schemes actually cover (e.g. missing a flat
  // CHAS deduction). Same-bill flat amounts (e.g. Merdeka Generation's $23.50
  // per visit) are summed first; annual-pool amounts (e.g. Flexi-MediSave's
  // $400/yr MediSave withdrawal allowance) are a separate reimbursement pool,
  // not a discount on this bill, so they're excluded. Any remaining
  // percentage-based coverage (from cards without a same-bill dollar amount)
  // is then applied to what's left after the flat deduction.
  const flatDeduction = cardsWithKnownCoverage
    .filter((card) => card.amount !== null && card.amountPeriod !== 'year')
    .reduce((sum, card) => sum + (card.amount ?? 0), 0)
  const remainingPercentCoverage = Math.min(
    100,
    cardsWithKnownCoverage
      .filter((card) => card.amount === null || card.amountPeriod === 'year')
      .reduce((sum, card) => sum + card.saves, 0),
  )
  const computedSavedAmount =
    billTotal !== null && (flatDeduction > 0 || remainingPercentCoverage > 0)
      ? Math.min(
          billTotal,
          flatDeduction + (billTotal - flatDeduction) * (remainingPercentCoverage / 100),
        )
      : null
  const computedPayableAmount =
    computedSavedAmount !== null && billTotal !== null ? billTotal - computedSavedAmount : null

  // Only fall back to the OCR-printed "Patient Total" (or the untouched bill
  // total when no subsidy applied) when we couldn't compute a deduction from
  // the matched subsidies ourselves.
  const billPayable = extracted.bill?.payableAmount ?? null
  const displayPayableAmount =
    computedPayableAmount ??
    (billPayable !== null ? billPayable : hasAppliedSubsidy ? null : billTotal)
  const displaySavedAmount =
    computedSavedAmount ??
    (billPayable !== null && billTotal !== null
      ? Math.max(0, billTotal - billPayable)
      : !hasAppliedSubsidy && billTotal !== null
        ? 0
        : null)

  // The headline is what the patient pays, i.e. the complement of total
  // coverage — not the coverage percentage itself.
  const heroHeadline =
    displayPayableAmount !== null
      ? formatMoney(currency, displayPayableAmount)
      : totalCoverage !== null
        ? `Up to ${100 - totalCoverage}%`
        : null

  // Built from the same computed cards/totals rendered above, so what's
  // spoken always matches what's shown on screen.
  const spokenText =
    extracted.documentType === 'referral'
      ? buildReferralSpeech(
          language,
          extracted.institution,
          extracted.diagnoses,
          extracted.referralType,
          extracted.appointmentDateTime,
          extracted.appointmentCenterTel,
        )
      : buildResultsSpeech(
          language,
          subsidies,
          extracted.institution,
          extracted.diagnoses,
          billTotal,
          currency,
          totalCoverage,
          displaySavedAmount,
          displayPayableAmount,
        )

  const GRID_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }
  const summaryItems = [
    billTotal !== null && { label: t.original_bill, value: formatMoney(currency, billTotal), color: 'text-neutral-700' },
    displaySavedAmount !== null && { label: t.total_saved, value: formatMoney(currency, displaySavedAmount), color: 'text-success-500' },
    displayPayableAmount !== null && { label: t.before_medisave, value: formatMoney(currency, displayPayableAmount), color: 'text-teal-700' },
  ].filter((item): item is { label: string; value: string; color: string } => Boolean(item))

  return (
    <div className="min-h-full bg-neutral-50 flex flex-col">
      <TopBar
        title={screenTitle}
        subtitle={`${extracted.institution ?? 'Healthcare provider'} · ${visitDate}`}
        onBack={() => onNavigate('confirm')}
        right={
          <Badge variant="success" className="gap-1">
            <BadgeCheck className="w-3.5 h-3.5" />
            {t.processed}
          </Badge>
        }
      />

      <motion.div
        className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {sections.title !== 'meds' && sections.title !== 'preview' && (
          <motion.div variants={fadeUp}>
            <OcrBanner text={t.estimate_banner} />
          </motion.div>
        )}

        {sections.title === 'preview' && (
          extracted.institution ||
          extracted.diagnoses.length > 0 ||
          extracted.referralType ||
          extracted.appointmentDateTime ||
          extracted.appointmentCenterTel
        ) && (
          <motion.div variants={fadeUp}>
            <Card className="p-5">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">
                {t.referral_details_title}
              </p>
              <div className="flex flex-col gap-3">
                {extracted.institution && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-neutral-400">{t.referred_to_label}</p>
                      <p className="text-sm font-semibold text-neutral-900">{extracted.institution}</p>
                    </div>
                  </div>
                )}
                {extracted.diagnoses.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Stethoscope className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-neutral-400">{t.diagnosis_reason_label}</p>
                      <p className="text-sm font-semibold text-neutral-900">{extracted.diagnoses.join(', ')}</p>
                    </div>
                  </div>
                )}
                {extracted.referralType && (
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-neutral-400">{t.referral_type_label}</p>
                      <p className="text-sm font-semibold text-neutral-900">{extracted.referralType}</p>
                    </div>
                  </div>
                )}
                {extracted.appointmentDateTime && (
                  <div className="flex items-start gap-3">
                    <CalendarClock className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-neutral-400">{t.appointment_datetime_label}</p>
                      <p className="text-sm font-semibold text-neutral-900">{extracted.appointmentDateTime}</p>
                    </div>
                  </div>
                )}
                {extracted.appointmentCenterTel && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-neutral-400">{t.appointment_tel_label}</p>
                      <p className="text-sm font-semibold text-neutral-900">{extracted.appointmentCenterTel}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {(sections.hero || sections.title === 'preview') && (
          <motion.div variants={fadeUp}>
            <TTSPanel title={t.listen_results_title} subtitle={t.listen_all_sub} text={spokenText} language={language} />
          </motion.div>
        )}

        {sections.hero && (
          <motion.div variants={fadeUp}>
            <Card className="p-5 text-center bg-gradient-to-b from-navy-50 to-white border-navy-100">
              {heroHeadline !== null ? (
                <>
                  <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    {t.you_pay}
                  </p>
                  <p className="text-[52px] font-bold text-teal-700 leading-none mb-2">
                    {heroHeadline}
                  </p>
                  {(displayPayableAmount === null || !hasAppliedSubsidy) && (
                    <p className="text-sm text-neutral-500 mb-4">
                      {displayPayableAmount === null ? t.requires_confirmation : t.no_matching}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-neutral-500 py-2">{t.no_bill_data}</p>
              )}

              {summaryItems.length > 0 && (
                <>
                  <Divider className="mb-4" />
                  <div className={`grid gap-1 text-center ${GRID_COLS[summaryItems.length]}`}>
                    {summaryItems.map((item) => (
                      <div key={item.label}>
                        <p className={`text-xl font-bold ${item.color}`}>
                          {item.value}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        )}

        {(sections.bill || (sections.meds && sections.title !== 'meds')) && (
          <motion.div
            variants={fadeUp}
            className={sections.bill && sections.meds && extracted.prescriptions.length > 0 ? 'grid grid-cols-2 gap-3' : ''}
          >
            {sections.bill && (
              <button
                onClick={() => extracted.bill && onNavigate('bill')}
                disabled={!extracted.bill}
                className="w-full bg-teal-50 border border-teal-200 rounded-2xl p-4 text-left hover:bg-teal-100 active:scale-[0.97] transition-all shadow-card disabled:opacity-55"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-700 grid place-items-center mb-3">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-bold text-teal-700">
                  {t.bill_title}
                </p>
                <p className="text-xs text-teal-500 mt-0.5">
                  {extracted.bill ? t.every_charge : t.no_bill_data}
                </p>
              </button>
            )}

            {sections.meds && sections.title !== 'meds' && extracted.prescriptions.length > 0 && (
              <button
                onClick={() => onNavigate('medications')}
                className="w-full bg-teal-50 border border-teal-200 rounded-2xl p-4 text-left hover:bg-teal-100 active:scale-[0.97] transition-all shadow-card"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500 grid place-items-center mb-3">
                  <Pill className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-bold text-teal-700">
                  {t.meds_title}
                </p>
                <p className="text-xs text-teal-500 mt-0.5">
                  {t.med_instructions}
                </p>
              </button>
            )}
          </motion.div>
        )}

        {sections.title === 'meds' && (
          <motion.div variants={fadeUp} className="flex flex-col gap-4">
            <MedicationsPanel prescriptions={extracted.prescriptions} />
          </motion.div>
        )}

        {sections.subsidies && (
          <motion.div variants={fadeUp}>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">
              {t.applied_subsidies}
            </p>

            <div className="flex flex-col gap-3">
              {subsidyCards.map((card) => (
                <Card
                  key={card.id}
                  className="p-4"
                  onClick={() => {
                    onSelectSubsidy(card)
                    onNavigate('details')
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-teal-50 grid place-items-center">
                      <SchemeIcon name={card.icon} className="w-5 h-5 text-teal-700" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-neutral-900">
                        {card.name}
                      </p>
                      {card.chineseName && (
                        <p className="text-sm text-neutral-400 mb-2">
                          {card.chineseName}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeVariant(card.badgeColor)}>
                          {t.matched}
                        </Badge>
                        <span className="text-sm font-semibold text-success-500">
                          {card.amount !== null
                            ? card.amountPeriod === 'year'
                              ? t.up_to_year.replace('{amount}', formatMoney('SGD', card.amount))
                              : t.off_label.replace('{amount}', formatMoney('SGD', card.amount))
                            : card.saves > 0 || !card.coverageNote
                              ? t.up_to_percent_coverage.replace('{pct}', String(card.saves)).replace('{coverage}', t.coverage)
                              : t.case_by_case}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={card.amount === null && card.saves === 0 && card.coverageNote ? 'text-sm font-bold text-teal-700 max-w-[7rem]' : 'text-xl font-bold text-teal-700'}>
                        {card.amount !== null
                          ? formatMoney('SGD', card.amount)
                          : card.saves > 0 || !card.coverageNote
                            ? `${card.saves}%`
                            : t.varies_label}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {card.amount !== null
                          ? card.amountPeriod === 'year'
                            ? t.per_year
                            : t.per_visit
                          : card.saves > 0 || !card.coverageNote
                            ? t.coverage
                            : ''}
                      </p>
                      <ChevronRight className="w-4 h-4 text-neutral-300 ml-auto mt-1" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {sections.subsidies && message && (
          <motion.div
            variants={fadeUp}
            className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-sm text-teal-700"
          >
            {message}
          </motion.div>
        )}

      </motion.div>
    </div>
  )
}
