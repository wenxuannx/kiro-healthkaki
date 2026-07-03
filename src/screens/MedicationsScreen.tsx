import { AlertTriangle, Clock, Package, Pill } from 'lucide-react'
import { Card, TopBar } from '../components/ui'
import TTSPanel from '../components/TTSPanel'
import { useLang, T } from '../hooks/i18n'
import type { ExtractedPrescription, Language, Screen, SupportedLanguage } from '../types'

interface Props { onNavigate: (screen: Screen) => void; prescriptions: ExtractedPrescription[] }

const LANG_TO_SUPPORTED: Record<Language, SupportedLanguage> = {
  en: 'en-SG', zh: 'cmn-Hans-CN', ms: 'ms-MY', ta: 'ta-IN',
}

/** Rewrites OCR ALL-CAPS instruction text into readable sentence case. */
function toSentenceCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) => match.toUpperCase())
    .replace(/\bi\b/g, 'I')
}

/** Resolves a prescription's frequency/instructions/purpose in the selected language, falling back to English. */
function localized(item: ExtractedPrescription, language: Language) {
  const t = item.translations?.[LANG_TO_SUPPORTED[language]]
  return {
    frequency: t?.frequency ?? item.frequency,
    instructions: t?.instructions ?? item.instructions,
    purpose: t?.purpose ?? item.purpose,
  }
}

const summary = (item: ExtractedPrescription, language: Language) => {
  const l = localized(item, language)
  // Medication name + dosage stay as printed; frequency/instructions/purpose are localized.
  return [item.medicationName, item.dosage, l.purpose, l.frequency, l.instructions].filter(Boolean).join('. ')
}

export function OcrBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 h-11 flex-shrink-0">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="text-sm text-amber-800 truncate">{text}</p>
    </div>
  )
}

export function MedicationCard({ item }: { item: ExtractedPrescription }) {
  const { language } = useLang()
  const t = T[language]
  const l = localized(item, language)
  const instructions = l.instructions ? toSentenceCase(l.instructions) : null

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 grid place-items-center flex-shrink-0">
          <Pill className="w-6 h-6 text-teal-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold text-neutral-900">{item.medicationName}</p>
          {l.purpose && <p className="text-[14px] text-teal-600 mt-0.5">{l.purpose}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        {item.dosage && (
          <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-500 text-[13px] font-bold px-3 h-9 rounded-full">
            <Package className="w-3.5 h-3.5" />{item.dosage}
          </span>
        )}
        {l.frequency && (
          <span className="inline-flex items-center gap-1.5 bg-navy-50 text-navy-500 text-[13px] font-bold px-3 h-9 rounded-full">
            <Clock className="w-3.5 h-3.5" />{l.frequency}
          </span>
        )}
      </div>

      {instructions && (
        <>
          <div className="flex items-center gap-2 mt-4 mb-2">
            <div className="flex-1 h-px bg-neutral-100" />
            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">{t.how_to_take}</p>
            <div className="flex-1 h-px bg-neutral-100" />
          </div>
          <p className="text-[15px] text-neutral-700 leading-relaxed">{instructions}</p>
        </>
      )}
    </Card>
  )
}

/**
 * Full medications content — OCR banner, "listen to all" bar, and medication
 * cards. Shared between the standalone Medications screen and the Results
 * screen (which inlines this directly for prescription-only documents,
 * rather than linking out to a duplicate screen).
 */
export function MedicationsPanel({ prescriptions }: { prescriptions: ExtractedPrescription[] }) {
  const { language } = useLang()
  const t = T[language]
  const allText = prescriptions.map((p) => summary(p, language)).join('. ')

  if (prescriptions.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Pill className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <h2 className="font-bold text-neutral-900">{t.no_medications}</h2>
      </Card>
    )
  }

  return (
    <>
      <OcrBanner text={t.ocr_disclaimer_meds} />

      <TTSPanel title={t.listen_all_meds} subtitle={t.listen_all_sub} text={allText} language={language} />

      <div className="flex flex-col gap-3">
        {prescriptions.map((item, index) => (
          <MedicationCard key={`${item.medicationName}-${index}`} item={item} />
        ))}
      </div>
    </>
  )
}

export default function MedicationsScreen({ onNavigate, prescriptions }: Props) {
  const { language } = useLang()
  const t = T[language]
  const countLabel = `${prescriptions.length} ${prescriptions.length === 1 ? t.meds_found_label : t.meds_found_label_plural}`

  return (
    <div className="min-h-full bg-neutral-50 flex flex-col">
      <TopBar title={t.meds_title} subtitle={countLabel} onBack={() => onNavigate('results')} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        <MedicationsPanel prescriptions={prescriptions} />
      </div>
    </div>
  )
}
