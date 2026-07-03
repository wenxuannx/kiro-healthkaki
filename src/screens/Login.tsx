import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../components/ui'
import { isValidNric } from '../lib/nric'
import { useLang, T } from '../hooks/i18n'
import type { Language } from '../types'

interface Props {
  onAuthenticated: (onboardingRequired: boolean) => void
}

const LANGUAGES: { code: Language; native: string }[] = [
  { code: 'en', native: 'English' },
  { code: 'zh', native: '中文' },
  { code: 'ms', native: 'Melayu' },
  { code: 'ta', native: 'தமிழ்' },
]

export default function Login({ onAuthenticated }: Props) {
  const { language, setLanguage } = useLang()
  const t = T[language]
  const [nric, setNric] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isValidNric(nric)) {
      setError(t.login_invalid_nric)
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/nric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nric, dateOfBirth }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error ?? t.login_generic_error)
      }

      onAuthenticated(Boolean(body.onboardingRequired))
    } catch (err) {
      setError(err instanceof Error ? err.message : t.login_generic_error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-white overflow-x-hidden">
      {/* Gradient hero */}
      <div
        className="relative flex-shrink-0 h-56 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #135555 0%, #1A7070 45%, #00897B 100%)' }}
      >
        <div
          className="absolute -top-10 -left-14 w-44 h-44 rounded-full"
          style={{ background: 'radial-gradient(circle at 30% 30%, #26C6DA, #00897B)', opacity: 0.5, filter: 'blur(2px)' }}
        />
        <div
          className="absolute -top-16 right-[-40px] w-52 h-52 rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 35%, #E0F7F5, #80DEDB)', opacity: 0.3 }}
        />
        <div
          className="absolute bottom-[-70px] left-1/3 w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 35%, #00B8A9, #135555)', opacity: 0.45 }}
        />

        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
          <img
            src="/healthkaki_logo.png"
            alt="HealthKaki"
            className="w-60 h-auto mb-1"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <p className="text-white text-base font-semibold">
            {t.login_subtitle}
          </p>
        </div>
      </div>

      {/* Form sheet */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 -mt-6 flex-1 bg-white rounded-t-[28px] flex flex-col items-center px-5 pt-8 pb-10"
      >
        <div className="w-full max-w-sm">
          <div
            role="radiogroup"
            aria-label="Select language"
            className="flex flex-wrap justify-center gap-1.5 mb-6"
          >
            {LANGUAGES.map((item) => (
              <button
                key={item.code}
                type="button"
                role="radio"
                aria-checked={language === item.code}
                onClick={() => setLanguage(item.code)}
                className={`min-h-[36px] px-2.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                  language === item.code
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-neutral-600 border-neutral-300'
                }`}
              >
                {item.native}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="login-nric" className="block text-sm font-medium text-neutral-900">
                {t.nric_fin_label}
              </label>
              <input
                id="login-nric"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                required
                maxLength={9}
                value={nric}
                onChange={(e) => setNric(e.target.value.toUpperCase().slice(0, 9))}
                placeholder="S1234567D"
                className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-dob" className="block text-sm font-medium text-neutral-900">
                {t.date_of_birth_label}
              </label>
              <input
                id="login-dob"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="block w-full max-w-full min-w-0 min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none box-border"
              />
            </div>

            {error && (
              <div role="alert" className="bg-danger-50 border border-danger-400/30 rounded-xl px-4 py-3">
                <p className="text-sm text-danger-500">{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={submitting}>
              {submitting ? t.login_checking : t.login_continue}
            </Button>
          </form>

          <div className="mt-5 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
            <p className="text-center text-s text-teal-700">
              {t.login_first_time}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
