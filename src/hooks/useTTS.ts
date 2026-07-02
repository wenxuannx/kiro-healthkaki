import { useCallback, useEffect, useRef, useState } from 'react'
import type { Language } from '../types'

const LANG_CODES: Record<Language, string> = {
  en: 'en-SG',
  zh: 'zh-CN',
  ms: 'ms-MY',
  ta: 'ta-IN',
}

/**
 * Languages forced to the server TTS path regardless of what the browser
 * reports. Some devices/browsers register a "voice" for these locales that is
 * broken in practice — observed on this project as Malay being read with an
 * English accent (unusable pronunciation) and Tamil producing complete
 * silence while `speechSynthesis` still reports itself as speaking. Trusting
 * `getVoices()` for these two languages produces false positives, so we
 * always route them server-side instead of probing for a local voice.
 */
const FORCE_SERVER_LANGUAGES = new Set<Language>(['ms', 'ta'])

/**
 * Picks the best installed browser voice for a locale (exact locale, then base
 * language). Returns null when the device has no voice for that language.
 */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: string,
): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const norm = (s: string) => s.toLowerCase().replace(/_/g, '-')
  const target = norm(locale)
  const base = target.split('-')[0]
  return (
    voices.find((v) => norm(v.lang) === target) ??
    voices.find((v) => norm(v.lang).split('-')[0] === base) ??
    null
  )
}

/**
 * Hybrid text-to-speech:
 *   - If the device has a voice for the language (English, Chinese on most
 *     machines), use the free, instant, reliable Web Speech API.
 *   - Otherwise (Malay, Tamil on most devices) fall back to the server
 *     `/api/tts` route (Google Cloud TTS).
 *
 * This keeps the common case fast and free, only spending Cloud TTS quota
 * on languages the device can't handle. Failures are surfaced via the
 * `error` flag (soft, no thrown errors) so the UI can show a gentle note.
 */
export function useTTS(language: Language = 'en') {
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(false)
  const [rate, setRate]         = useState(0.85)
  const [supported]             = useState(() => typeof window !== 'undefined')
  const [voices, setVoices]     = useState<SpeechSynthesisVoice[]>([])
  const audioRef                = useRef<HTMLAudioElement | null>(null)
  const cacheRef                = useRef<Map<string, string>>(new Map())
  const requestIdRef            = useRef(0)
  const keepAliveRef            = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasSpeechSynthesis =
    typeof window !== 'undefined' && 'speechSynthesis' in window

  // Load browser voices (populated asynchronously).
  useEffect(() => {
    if (!hasSpeechSynthesis) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () =>
      window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [hasSpeechSynthesis])

  const clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  // Cancel everything on unmount.
  useEffect(() => {
    return () => {
      clearKeepAlive()
      audioRef.current?.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [clearKeepAlive])

  const stop = useCallback(() => {
    requestIdRef.current += 1
    clearKeepAlive()
    if (hasSpeechSynthesis) window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setSpeaking(false)
    setLoading(false)
  }, [hasSpeechSynthesis, clearKeepAlive])

  const speak = useCallback(
    async (text: string) => {
      if (!supported || !text?.trim()) return
      setError(false)

      const requestId = ++requestIdRef.current
      // Stop anything currently playing.
      if (hasSpeechSynthesis) window.speechSynthesis.cancel()
      audioRef.current?.pause()

      const locale = LANG_CODES[language]
      const voice =
        hasSpeechSynthesis && !FORCE_SERVER_LANGUAGES.has(language)
          ? pickVoice(window.speechSynthesis.getVoices(), locale)
          : null

      // Path 1: device has a matching voice → Web Speech API (free, instant).
      if (voice) {
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = locale
        utter.voice = voice
        utter.rate = rate
        utter.pitch = 1.0
        utter.volume = 1.0
        utter.onstart = () => {
          setSpeaking(true)
          // Chrome/Edge silently stop producing audio ~15s into an utterance
          // (a long-standing Web Speech API bug) without firing onend — the
          // app is left thinking it's still "speaking" while nothing plays.
          // A periodic pause()/resume() nudge keeps the engine alive.
          clearKeepAlive()
          keepAliveRef.current = setInterval(() => {
            if (!window.speechSynthesis.speaking) return
            window.speechSynthesis.pause()
            window.speechSynthesis.resume()
          }, 10_000)
        }
        utter.onend = () => { clearKeepAlive(); setSpeaking(false) }
        utter.onerror = () => { clearKeepAlive(); setSpeaking(false) }
        window.speechSynthesis.speak(utter)
        return
      }

      // Path 2: no device voice → server TTS (Google Cloud TTS) for Malay/Tamil.
      setLoading(true)
      setSpeaking(true)
      try {
        const slow = rate < 0.9
        const cacheKey = `${slow ? 'slow' : 'norm'}::${text}`
        let url = cacheRef.current.get(cacheKey)

        if (!url) {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, slow, language }),
          })
          if (!res.ok) throw new Error(`TTS request failed: ${res.status}`)
          const blob = await res.blob()
          url = URL.createObjectURL(blob)
          cacheRef.current.set(cacheKey, url)
        }

        if (requestId !== requestIdRef.current) return // superseded

        const audio = new Audio(url)
        audioRef.current = audio
        audio.onplaying = () => setLoading(false)
        audio.onended = () => { setSpeaking(false); setLoading(false) }
        audio.onerror = () => { setSpeaking(false); setLoading(false); setError(true) }
        await audio.play()
      } catch (err) {
        // Soft-fail: surface via `error` flag, no thrown/red console error.
        console.warn('[useTTS] server TTS unavailable:', err)
        if (requestId === requestIdRef.current) {
          setSpeaking(false)
          setLoading(false)
          setError(true)
        }
      }
    },
    [supported, hasSpeechSynthesis, language, rate],
  )

  const toggle = useCallback(
    (text: string) => {
      if (speaking) stop()
      else void speak(text)
    },
    [speaking, speak, stop],
  )

  return { speak, stop, toggle, speaking, loading, error, supported, rate, setRate }
}
