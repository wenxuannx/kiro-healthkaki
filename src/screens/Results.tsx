import { motion } from 'framer-motion'
import { Share2, Printer, MessageCircle, BadgeCheck, ShieldCheck } from 'lucide-react'
import { Button, Card, Badge, TopBar, Divider } from '../components/ui'
import TTSButton from '../components/TTSButton'
import { useTTS, buildScanSummary } from '../hooks/useTTS'
import { useLang, T } from '../hooks/i18n'
import type { ProcessDocumentResponse, Screen } from '../types'

interface Props {
  onNavigate: (s: Screen) => void
  result: ProcessDocumentResponse | null
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }
const fadeUp  = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

const localName = (language: 'en' | 'zh' | 'ms' | 'ta', s: { chinese_name: string | null; malay_name: string | null; tamil_name: string | null }) =>
  language === 'zh' ? s.chinese_name : language === 'ms' ? s.malay_name : language === 'ta' ? s.tamil_name : null

export default function Results({ onNavigate, result }: Props) {
  const { language } = useLang()
  const { toggle, speaking } = useTTS(language)

  // Guard: shouldn't normally happen since Processing only navigates here on success,
  // but the results screen is also reachable via bottom-nav browser back navigation.
  if (!result) {
    return (
      <div className="min-h-full bg-neutral-50 flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-base text-neutral-500">No scan results yet. Scan a document to see your subsidy matches here.</p>
        <Button variant="primary" size="md" onClick={() => onNavigate('home')}>Back to home</Button>
      </div>
    )
  }

  const { extracted, subsidies, subsidiesMessage } = result
  const summary = buildScanSummary(language, extracted.institution, subsidies.map(s => s.name), subsidiesMessage)

  return (
    <div className="min-h-full bg-neutral-50 flex flex-col">
      <TopBar
        title={T[language].results_title}
        subtitle={[extracted.institution, extracted.visitDate].filter(Boolean).join(' · ') || undefined}
        onBack={() => onNavigate('confirm')}
        right={
          <Badge variant="success" className="gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5" />
            {subsidies.length} {subsidies.length === 1 ? 'match' : 'matches'}
          </Badge>
        }
      />

      <motion.div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
        variants={stagger} initial="hidden" animate="show">

        {/* Document summary card with TTS */}
        <motion.div variants={fadeUp}>
          <Card className="p-5 bg-gradient-to-b from-navy-50 to-white border-navy-100">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                  {language === 'zh' ? '文件摘要' : language === 'ms' ? 'Ringkasan dokumen' : language === 'ta' ? 'ஆவண சுருக்கம்' : 'Document summary'}
                </p>
                <p className="text-lg font-bold text-neutral-900">{extracted.institution ?? (language === 'zh' ? '未知机构' : language === 'ms' ? 'Institusi tidak diketahui' : language === 'ta' ? 'நிறுவனம் தெரியவில்லை' : 'Institution not identified')}</p>
                {extracted.visitDate && <p className="text-sm text-neutral-500 mt-0.5">{extracted.visitDate}</p>}
              </div>
              <TTSButton text={summary} speaking={speaking} onToggle={toggle} size="sm" />
            </div>

            {extracted.diagnoses.length > 0 && (
              <>
                <Divider className="my-3" />
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
                  {language === 'zh' ? '诊断' : language === 'ms' ? 'Diagnosis' : language === 'ta' ? 'நோய் கண்டறிதல்' : 'Diagnoses'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {extracted.diagnoses.map((d, i) => <Badge key={i} variant="navy">{d}</Badge>)}
                </div>
              </>
            )}
          </Card>
        </motion.div>

        {/* Subsidy matches */}
        <motion.div variants={fadeUp}>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">
            {language === 'zh' ? '适用津贴' : language === 'ms' ? 'Subsidi yang berkaitan' : language === 'ta' ? 'பொருந்தும் மானியங்கள்' : 'Matching subsidy schemes'}
          </p>

          {subsidies.length === 0 ? (
            <Card className="p-5 flex gap-3 items-start">
              <ShieldCheck className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />
              <p className="text-base text-neutral-600 leading-relaxed">
                {subsidiesMessage ?? (language === 'zh' ? '未找到匹配的津贴计划。' : language === 'ms' ? 'Tiada skim subsidi yang sepadan ditemui.' : language === 'ta' ? 'பொருந்தும் மானிய திட்டங்கள் எதுவும் இல்லை.' : 'No matching subsidy schemes were found.')}
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {subsidies.map((s) => {
                const local = localName(language, s)
                return (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-neutral-900 leading-snug">{s.name}</p>
                        {local && <p className="text-sm text-neutral-400 mt-0.5">{local}</p>}
                      </div>
                      {s.coverage_percentage !== null && (
                        <Badge variant="teal" className="flex-shrink-0">
                          {language === 'zh' ? `约${s.coverage_percentage}%覆盖` : language === 'ms' ? `~${s.coverage_percentage}% liputan` : language === 'ta' ? `~${s.coverage_percentage}% கவரேஜ்` : `~${s.coverage_percentage}% coverage`}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 leading-relaxed">{s.description}</p>
                  </Card>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div variants={fadeUp} className="flex flex-col gap-3 pt-1">
          <Button variant="secondary" size="md" fullWidth onClick={() => alert('Opens print dialog')} className="gap-2">
            <Printer className="w-5 h-5 text-neutral-500" />
            {language === 'zh' ? '打印结果' : language === 'ms' ? 'Cetak Keputusan' : language === 'ta' ? 'முடிவுகளை அச்சிடுங்கள்' : 'Print Results'}
          </Button>
          <Button variant="secondary" size="md" fullWidth onClick={() => alert('Opens share sheet')} className="gap-2">
            <Share2 className="w-5 h-5 text-neutral-500" />
            {language === 'zh' ? '与医生分享' : language === 'ms' ? 'Kongsi dengan Doktor' : language === 'ta' ? 'மருத்துவருடன் பகிரவும்' : 'Share with Doctor'}
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={() => onNavigate('help')} className="gap-2">
            <MessageCircle className="w-5 h-5" />
            {language === 'zh' ? '提问' : language === 'ms' ? 'Tanya Soalan' : language === 'ta' ? 'கேள்விகள் கேளுங்கள்' : 'Ask Questions'}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
