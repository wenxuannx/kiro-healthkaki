import { useEffect } from 'react'
import TTSButton from './TTSButton'
import VoiceWarning from './VoiceWarning'
import { useTTS } from '../hooks/useTTS'
import { T } from '../hooks/i18n'
import type { Language } from '../types'

interface Props {
  title: string
  subtitle: string
  text: string
  language: Language
}

/**
 * The single "listen to this" control used across the app — icon, title,
 * a Listen/Stop toggle button, and a reading-speed slider. Every screen with
 * a listen button should use this instead of a one-off button, so the
 * speed adjuster and Listen/Stop state are consistent everywhere.
 */
export default function TTSPanel({ title, subtitle, text, language }: Props) {
  const { toggle, prefetch, speaking, error, rate, setRate } = useTTS(language)
  const t = T[language]

  // Warm the TTS cache as soon as the text is known, so tapping "Listen"
  // later doesn't pay cold Cloud TTS synthesis latency.
  useEffect(() => {
    prefetch(text)
  }, [prefetch, text])

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-teal-500 grid place-items-center flex-shrink-0">
          <span className="text-2xl">🔊</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-neutral-900 truncate">{title}</p>
          <p className="text-xs text-neutral-400 truncate">{subtitle}</p>
        </div>
        <TTSButton text={text} speaking={speaking} onToggle={toggle} size="md" />
      </div>

      <VoiceWarning language={language} visible={error} className="mt-3" />

      <div className="flex items-center justify-between text-xs text-neutral-500 mt-3 mb-1.5">
        <span>{t.reading_speed}</span>
        <span className="font-semibold text-teal-700">{rate.toFixed(2)}×</span>
      </div>
      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.05"
        value={rate}
        onChange={(event) => setRate(Number(event.target.value))}
        className="w-full accent-teal-700"
        aria-label={t.reading_speed}
      />
    </div>
  )
}
