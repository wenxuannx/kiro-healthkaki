import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ChevronDown, Clock, Pill } from 'lucide-react'
import { Card, TopBar } from '../components/ui'
import TTSButton from '../components/TTSButton'
import VoiceWarning from '../components/VoiceWarning'
import { useTTS } from '../hooks/useTTS'
import { useLang } from '../hooks/i18n'
import type { ExtractedPrescription, Language, Screen, SupportedLanguage } from '../types'

interface Props { onNavigate: (screen: Screen) => void; prescriptions: ExtractedPrescription[] }

const LANG_TO_SUPPORTED: Record<Language, SupportedLanguage> = {
  en: 'en-SG', zh: 'cmn-Hans-CN', ms: 'ms-MY', ta: 'ta-IN',
}

/** Resolves a prescription's frequency/instructions in the selected language, falling back to English. */
function localized(item: ExtractedPrescription, language: Language) {
  const t = item.translations?.[LANG_TO_SUPPORTED[language]]
  return {
    frequency: t?.frequency ?? item.frequency,
    instructions: t?.instructions ?? item.instructions,
  }
}

const summary = (item: ExtractedPrescription, language: Language) => {
  const l = localized(item, language)
  // Medication name + dosage stay as printed; frequency + instructions are localized.
  return [item.medicationName, item.dosage, l.frequency, l.instructions].filter(Boolean).join('. ')
}

function PrescriptionCard({ item, open, onToggle }: { item: ExtractedPrescription; open: boolean; onToggle: () => void }) {
  const { language } = useLang()
  const { toggle, prefetch, speaking } = useTTS(language)
  const l = localized(item, language)
  const text = summary(item, language)

  // Warm the TTS cache as soon as this card's text is known, so tapping the
  // speaker later doesn't pay cold Cloud TTS synthesis latency.
  useEffect(() => {
    prefetch(text)
  }, [prefetch, text])

  return <Card className="overflow-hidden">
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 grid place-items-center flex-shrink-0"><Pill className="w-6 h-6 text-teal-500" /></div>
        <div className="flex-1 min-w-0"><p className="text-base font-bold text-neutral-900">{item.medicationName}</p>{item.dosage && <span className="mt-2 inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full">💊 {item.dosage}</span>}</div>
        <TTSButton text={text} speaking={speaking} onToggle={toggle} size="sm" variant="icon" />
      </div>
      {l.frequency && <span className="mt-3 inline-flex items-center gap-1.5 bg-navy-50 border border-navy-100 text-navy-500 text-xs font-semibold px-2.5 py-1 rounded-full"><Clock className="w-3 h-3" />{l.frequency}</span>}
      <button onClick={onToggle} className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 py-1" aria-expanded={open}>{open ? 'Less detail' : 'More detail'}<motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="w-4 h-4" /></motion.span></button>
    </div>
    <AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="border-t border-neutral-100 px-4 py-4 flex gap-3"><div className="w-8 h-8 rounded-lg bg-amber-50 grid place-items-center flex-shrink-0"><AlertTriangle className="w-4 h-4 text-amber-500" /></div><div><p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Printed instructions</p><p className="text-sm text-neutral-700 leading-relaxed">{l.instructions ?? 'No additional instructions were extracted.'}</p></div></div></motion.div>}</AnimatePresence>
  </Card>
}

export default function MedicationsScreen({ onNavigate, prescriptions }: Props) {
  const { language } = useLang()
  const { toggle, prefetch, speaking, error: ttsError } = useTTS(language)
  const [openIndex, setOpenIndex] = useState<number | null>(prescriptions.length ? 0 : null)
  const allText = prescriptions.map((p) => summary(p, language)).join('. ')

  // Warm the TTS cache as soon as the combined text is known, so tapping
  // "Listen to all" later doesn't pay cold Cloud TTS synthesis latency.
  useEffect(() => {
    prefetch(allText)
  }, [prefetch, allText])
  return <div className="min-h-full bg-neutral-50 flex flex-col">
    <TopBar title="Your Medications" subtitle={`${prescriptions.length} extracted from your document`} onBack={() => onNavigate('results')} right={allText ? <TTSButton text={allText} speaking={speaking} onToggle={toggle} size="sm" variant="icon" /> : undefined} />
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
      {prescriptions.length > 0 && <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-teal-500 grid place-items-center"><span className="text-2xl">🔊</span></div><div className="flex-1"><p className="text-sm font-bold text-teal-700">Listen to all medication instructions</p><p className="text-xs text-teal-500">Read clearly and slowly</p></div><TTSButton text={allText} speaking={speaking} onToggle={toggle} size="md" /></div>}
      {prescriptions.length > 0 && <VoiceWarning language={language} visible={ttsError} />}
      {prescriptions.length === 0 ? <Card className="p-6 text-center"><Pill className="w-10 h-10 text-neutral-300 mx-auto mb-3" /><h2 className="font-bold text-neutral-900">No medications extracted</h2></Card> : <div className="flex flex-col gap-3">{prescriptions.map((item, index) => <PrescriptionCard key={`${item.medicationName}-${index}`} item={item} open={openIndex === index} onToggle={() => setOpenIndex(current => current === index ? null : index)} />)}</div>}
      {prescriptions.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3"><AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" /><p className="text-sm text-amber-700">OCR can make mistakes. Verify the original label and ask a pharmacist or doctor before taking medication.</p></div>}
    </div>
  </div>
}
