import { useEffect, useMemo, useState } from 'react'
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

const LOCALE_MAP: Record<Language, string> = {
  en: 'en-SG',
  zh: 'zh-CN',
  ms: 'ms-MY',
  ta: 'ta-IN',
}

const CURRENT_YEAR = new Date().getFullYear()
// Oldest-first so the default scroll position in the native picker lands
// near the birth decades of this app's Pioneer/Merdeka Generation audience,
// instead of at today's date like a native <input type="date"> would.
const YEARS = Array.from({ length: 101 }, (_, i) => CURRENT_YEAR - 100 + i)

function daysInMonth(month: number | null, year: number | null): number {
  if (month == null) return 31
  return new Date(year ?? 2000, month + 1, 0).getDate()
}

const selectClass =
  'w-full min-h-[44px] px-3 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none'

export default function Login({ onAuthenticated }: Props) {
  const { language, setLanguage } = useLang()
  const t = T[language]
  const [nric, setNric] = useState('')
  const [nricMasked, setNricMasked] = useState(true)
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: new Intl.DateTimeFormat(LOCALE_MAP[language], { month: 'long' }).format(new Date(2000, i, 1)),
      })),
    [language]
  )

  const maxDay = daysInMonth(month === '' ? null : Number(month), year === '' ? null : Number(year))
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)

  useEffect(() => {
    if (day !== '' && Number(day) > maxDay) setDay('')
  }, [maxDay, day])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isValidNric(nric)) {
      setError(t.login_invalid_nric)
      return
    }

    if (day === '' || month === '' || year === '' || Number(day) > maxDay) {
      setError(t.login_invalid_dob)
      return
    }

    const dateOfBirth = `${year}-${String(Number(month) + 1).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
    if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
      setError(t.login_invalid_dob)
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
              <div className="relative">
                <input
                  id="login-nric"
                  type={nricMasked ? 'password' : 'text'}
                  autoComplete="off"
                  autoCapitalize="characters"
                  inputMode="text"
                  required
                  maxLength={9}
                  value={nric}
                  onChange={(e) => setNric(e.target.value.toUpperCase().slice(0, 9))}
                  placeholder="e.g S1234567D"
                  className="w-full min-h-[44px] px-4 py-2.5 pr-12 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none uppercase"
                />
                <button
                  type="button"
                  aria-label={nricMasked ? 'Show NRIC' : 'Hide NRIC'}
                  onClick={() => setNricMasked((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-neutral-700"
                >
                  {nricMasked ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.19-3.593M9.88 9.88a3 3 0 104.243 4.243M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-dob-day" className="block text-sm font-medium text-neutral-900">
                {t.date_of_birth_label}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  id="login-dob-day"
                  aria-label={t.dob_day_placeholder}
                  required
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t.dob_day_placeholder}</option>
                  {days.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  aria-label={t.dob_month_placeholder}
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t.dob_month_placeholder}</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select
                  aria-label={t.dob_year_placeholder}
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t.dob_year_placeholder}</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
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
