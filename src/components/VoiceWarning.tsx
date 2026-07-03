import { AlertTriangle } from 'lucide-react'
import type { Language } from '../types'

/**
 * Soft, localized note shown next to a "Read Aloud" control when an audio
 * attempt fails (e.g. the server TTS service is temporarily rate-limited, or a
 * language has no device voice and the fallback failed). Keeps the app from
 * failing silently or throwing a console error at the user.
 */

function message(language: Language): string {
  switch (language) {
    case 'zh':
      return '语音暂时无法播放，请稍后再试。'
    case 'ms':
      return 'Audio tidak tersedia buat masa ini. Sila cuba sebentar lagi.'
    case 'ta':
      return 'ஒலி தற்போது கிடைக்கவில்லை. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.'
    default:
      return 'Audio is temporarily unavailable. Please try again in a moment.'
  }
}

interface VoiceWarningProps {
  language: Language
  /** Whether the last audio attempt failed. */
  visible: boolean
  className?: string
}

export default function VoiceWarning({
  language,
  visible,
  className = '',
}: VoiceWarningProps) {
  if (!visible) return null

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
      <p className="leading-snug">{message(language)}</p>
    </div>
  )
}
