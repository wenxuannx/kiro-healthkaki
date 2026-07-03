import { motion } from 'framer-motion'
import { Upload, WifiOff, FileX, AlertTriangle, RefreshCw, Phone, CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui'
import { useLang, T } from '../hooks/i18n'
import type { Screen, ErrorType } from '../types'

type FailedProcessingStage = 'uploading' | 'reading' | 'finding'

interface Props {
  onNavigate: (s: Screen) => void
  errorType?: ErrorType
  errorMessage?: string | null
  errorStage?: FailedProcessingStage
  timedOut?: boolean
  onRetry?: () => void
}

export default function ErrorScreen({ onNavigate, errorType = 'upload', errorMessage, errorStage, timedOut = false, onRetry }: Props) {
  const { language } = useLang()
  const t = T[language]

  const STAGE_LABELS: Record<FailedProcessingStage, string> = {
    uploading: t.err_stage_uploading,
    reading: t.err_stage_reading,
    finding: t.err_stage_finding,
  }

  const ERRORS: Record<ErrorType, {
    icon: React.ElementType; iconBg: string; iconColor: string
    title: string; body: string
    primary: { label: string; icon: React.ElementType; to: Screen }
    secondary: { label: string; to: Screen }
    retryCount?: number
  }> = {
    upload: {
      icon: FileX, iconBg: 'bg-danger-50', iconColor: 'text-danger-500',
      title: t.err_upload_title,
      body: t.err_upload_body,
      primary: { label: t.err_take_another_photo, icon: Upload, to: 'camera' },
      secondary: { label: t.err_see_photo_tips, to: 'help' },
    },
    processing: {
      icon: AlertTriangle, iconBg: 'bg-orange-50', iconColor: 'text-orange-500',
      title: t.err_processing_title,
      body: t.err_processing_body,
      primary: { label: t.err_try_again, icon: RefreshCw, to: 'confirm' },
      secondary: { label: t.get_help, to: 'help' },
      retryCount: 2,
    },
    no_subsidies: {
      icon: CheckCircle2, iconBg: 'bg-neutral-100', iconColor: 'text-neutral-400',
      title: t.err_no_subsidies_title,
      body: t.err_no_subsidies_body,
      primary: { label: t.scan_different, icon: Upload, to: 'camera' },
      secondary: { label: t.err_contact_moh, to: 'help' },
    },
    offline: {
      icon: WifiOff, iconBg: 'bg-neutral-100', iconColor: 'text-neutral-500',
      title: t.err_offline_title,
      body: t.err_offline_body,
      primary: { label: t.err_try_again, icon: RefreshCw, to: 'confirm' },
      secondary: { label: t.err_view_past_results, to: 'history' },
    },
    validation: {
      icon: AlertTriangle, iconBg: 'bg-orange-50', iconColor: 'text-orange-500',
      title: t.err_validation_title,
      body: t.err_validation_body,
      primary: { label: t.err_go_back_fix, icon: RefreshCw, to: 'confirm' },
      secondary: { label: t.get_help, to: 'help' },
    },
  }

  const e = ERRORS[errorType]
  const IconComponent = e.icon

  return (
    <div className="min-h-full bg-neutral-50 flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center w-full max-w-sm"
      >
        {/* Icon */}
        <motion.div
          className={`w-24 h-24 rounded-3xl ${e.iconBg} flex items-center justify-center mb-7`}
          initial={{ rotate: -6 }} animate={{ rotate: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <IconComponent className={`w-10 h-10 ${e.iconColor}`} />
        </motion.div>

        {/* Retry count badge */}
        {e.retryCount !== undefined && (
          <div className="bg-orange-50 border border-orange-200 rounded-full px-3 py-1 mb-4">
            <p className="text-sm text-orange-600 font-semibold">{t.err_attempt_of.replace('{n}', String(e.retryCount))}</p>
          </div>
        )}

        {errorStage && (
          <p className="text-sm font-semibold text-orange-600 mb-3">
            {t.err_error_during}: {STAGE_LABELS[errorStage]}
          </p>
        )}
        <h1 className="text-2xl font-bold text-neutral-900 mb-3 leading-snug">
          {timedOut ? t.err_processing_timed_out : e.title}
        </h1>
        <p className="text-base text-neutral-500 leading-relaxed mb-4">{errorMessage || e.body}</p>
        {errorMessage && errorMessage !== e.body && (
          <p className="text-sm text-neutral-400 leading-relaxed mb-9">{e.body}</p>
        )}
        {!errorMessage && <div className="mb-5" />}

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full">
          <Button variant="primary" size="lg" fullWidth onClick={onRetry ?? (() => onNavigate(e.primary.to))} className="gap-2">
            <e.primary.icon className="w-5 h-5" />
            {e.primary.label}
          </Button>
          <Button variant="secondary" size="md" fullWidth onClick={() => onNavigate(e.secondary.to)}>
            {e.secondary.label}
          </Button>
        </div>

        {/* Helpline */}
        <div className="mt-8 pt-6 border-t border-neutral-200 w-full">
          <p className="text-sm text-neutral-400 mb-2">{t.err_still_trouble}</p>
          <a href="tel:18006506060" className="inline-flex items-center gap-2 text-base font-semibold text-navy-500 hover:text-navy-600 transition-colors">
            <Phone className="w-4 h-4" />
            MOH SilverLine: 1800-650-6060
          </a>
          <p className="text-xs text-neutral-400 mt-1">Mon–Fri, 8am–8pm · Free call</p>
        </div>
      </motion.div>
    </div>
  )
}
