import { useState } from 'react'
import { Bell, Globe, Info, LogOut, Shield, Type, User, Volume2 } from 'lucide-react'
import { Card, Button, Toggle, TopBar } from '../components/ui'
import { useLang, T } from '../hooks/i18n'
import { useTTS } from '../hooks/useTTS'
import TTSButton from '../components/TTSButton'
import VoiceWarning from '../components/VoiceWarning'
import { useTextSize, useHighContrast } from '../App'
import type { Language, Profile, Screen } from '../types'
import { CITIZENSHIP_OPTIONS, INCOME_OPTIONS, type CitizenshipStatus } from '../lib/profile-options'

interface Props {
  onNavigate: (s: Screen) => void
  onSignOut: () => void
  profile: Profile
  onProfileUpdate: (profile: Profile) => void
}

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zh', label: 'Chinese', native: '中文' },
  { code: 'ms', label: 'Malay', native: 'Melayu' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
]

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return <section><div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4 text-teal-700" /><h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{title}</h2></div><Card className="p-4">{children}</Card></section>
}

function AccountDetails({ profile, onProfileUpdate }: { profile: Profile; onProfileUpdate: (profile: Profile) => void }) {
  const { language } = useLang()
  const t = T[language]
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [citizenshipStatus, setCitizenshipStatus] = useState<CitizenshipStatus | ''>(profile.citizenship_status ?? '')
  const [citizenshipYear, setCitizenshipYear] = useState(profile.citizenship_year != null ? String(profile.citizenship_year) : '')
  const [householdIncome, setHouseholdIncome] = useState(profile.household_monthly_income != null ? String(profile.household_monthly_income) : '')
  const [householdSize, setHouseholdSize] = useState(profile.household_size != null ? String(profile.household_size) : '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const showCitizenshipYear = citizenshipStatus === 'citizen' || citizenshipStatus === 'pr'

  const startEditing = () => {
    setFullName(profile.full_name ?? '')
    setCitizenshipStatus(profile.citizenship_status ?? '')
    setCitizenshipYear(profile.citizenship_year != null ? String(profile.citizenship_year) : '')
    setHouseholdIncome(profile.household_monthly_income != null ? String(profile.household_monthly_income) : '')
    setHouseholdSize(profile.household_size != null ? String(profile.household_size) : '')
    setError(null)
    setEditing(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!citizenshipStatus) {
      setError(t.acc_select_citizenship_error)
      return
    }
    if (!householdIncome) {
      setError(t.acc_select_income_error)
      return
    }
    if (!householdSize) {
      setError(t.acc_enter_household_size_error)
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName || null,
          citizenship_status: citizenshipStatus,
          citizenship_year: citizenshipYear ? Number(citizenshipYear) : null,
          household_monthly_income: Number(householdIncome),
          household_size: Number(householdSize),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? t.acc_save_failed)
      }

      const { profile: updated } = (await res.json()) as { profile: Profile }
      onProfileUpdate(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.generic_error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!editing) {
    const incomeLabel = INCOME_OPTIONS.find((opt) => opt.value === profile.household_monthly_income)?.label
    const citizenshipLabel = CITIZENSHIP_OPTIONS.find((opt) => opt.value === profile.citizenship_status)?.label

    return (
      <div className="flex flex-col gap-3">
        <dl className="text-sm divide-y divide-neutral-100">
          <div className="flex justify-between py-2">
            <dt className="text-neutral-500">{t.nric_fin_label}</dt>
            <dd className="font-medium text-neutral-900">{profile.nric}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-neutral-500">{t.date_of_birth_label}</dt>
            <dd className="font-medium text-neutral-900">{profile.date_of_birth}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-neutral-500">{t.full_name_label}</dt>
            <dd className="font-medium text-neutral-900">{profile.full_name ?? t.not_set}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-neutral-500">{t.citizenship_status_label}</dt>
            <dd className="font-medium text-neutral-900">{citizenshipLabel ?? t.not_set}</dd>
          </div>
          {profile.citizenship_year != null && (
            <div className="flex justify-between py-2">
              <dt className="text-neutral-500">{t.citizenship_year_label}</dt>
              <dd className="font-medium text-neutral-900">{profile.citizenship_year}</dd>
            </div>
          )}
          <div className="flex justify-between py-2">
            <dt className="text-neutral-500">{t.household_income_label}</dt>
            <dd className="font-medium text-neutral-900">{incomeLabel ?? t.not_set}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-neutral-500">{t.household_size_label}</dt>
            <dd className="font-medium text-neutral-900">{profile.household_size ?? t.not_set}</dd>
          </div>
        </dl>
        <button
          onClick={startEditing}
          className="text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1.5 hover:bg-teal-100 active:scale-95 transition-all self-start"
        >
          {t.edit_label}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
      <div className="text-sm divide-y divide-neutral-100 mb-1">
        <div className="flex justify-between py-2">
          <span className="text-neutral-500">{t.nric_fin_label}</span>
          <span className="font-medium text-neutral-900">{profile.nric}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-neutral-500">{t.date_of_birth_label}</span>
          <span className="font-medium text-neutral-900">{profile.date_of_birth}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="acc-full-name" className="block text-sm font-medium text-neutral-900">
          {t.full_name_label}
        </label>
        <input
          id="acc-full-name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="acc-citizenship" className="block text-sm font-medium text-neutral-900">
          {t.citizenship_status_label} <span aria-hidden="true">*</span>
        </label>
        <select
          id="acc-citizenship"
          required
          value={citizenshipStatus}
          onChange={(e) => setCitizenshipStatus(e.target.value as CitizenshipStatus)}
          className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
        >
          <option value="" disabled>{t.select_one}</option>
          {CITIZENSHIP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {showCitizenshipYear && (
        <div className="space-y-1.5">
          <label htmlFor="acc-citizenship-year" className="block text-sm font-medium text-neutral-900">
            {citizenshipStatus === 'citizen' ? t.year_became_citizen : t.year_became_pr}
          </label>
          <input
            id="acc-citizenship-year"
            type="number"
            inputMode="numeric"
            min={1900}
            max={new Date().getFullYear()}
            value={citizenshipYear}
            onChange={(e) => setCitizenshipYear(e.target.value)}
            className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="acc-income" className="block text-sm font-medium text-neutral-900">
          {t.household_income_label_form} <span aria-hidden="true">*</span>
        </label>
        <select
          id="acc-income"
          required
          value={householdIncome}
          onChange={(e) => setHouseholdIncome(e.target.value)}
          className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
        >
          <option value="" disabled>{t.select_a_range}</option>
          {INCOME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="acc-household-size" className="block text-sm font-medium text-neutral-900">
          {t.household_size_label} <span aria-hidden="true">*</span>
        </label>
        <input
          id="acc-household-size"
          type="number"
          inputMode="numeric"
          required
          min={1}
          value={householdSize}
          onChange={(e) => setHouseholdSize(e.target.value)}
          className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger-500">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
          {submitting ? t.saving_label : t.save_label}
        </Button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError(null) }}
          disabled={submitting}
          className="text-sm font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200 rounded-full px-4 min-h-[44px] disabled:opacity-60"
        >
          {t.cancel_label}
        </button>
      </div>
    </form>
  )
}

export default function Settings({ onSignOut, profile, onProfileUpdate }: Props) {
  const { language, setLanguage } = useLang()
  const t = T[language]
  const { toggle, speaking, rate, setRate, supported, error: ttsError } = useTTS(language)
  const preview = language === 'zh' ? '您好，这是语音朗读测试。' : language === 'ms' ? 'Helo, ini adalah ujian bacaan suara.' : language === 'ta' ? 'வணக்கம், இது குரல் வாசிப்பு சோதனை.' : 'Hello, this is a text-to-speech test.'
  const { step: textStep, setStep: setTextStep } = useTextSize()
  const { highContrast, setHighContrast } = useHighContrast()

  const TEXT_LABELS = [t.size_xs, t.size_sm, t.size_default, t.size_lg, t.size_xl]
  const [healthReminders, setHealthReminders] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    onSignOut()
  }

  return (
    <div className="min-h-full bg-neutral-50 flex flex-col">
      <TopBar title={t.settings_title} subtitle={t.settings_sub} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        <Section icon={Globe} title={t.lang_section}>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map(item => <button key={item.code} onClick={() => setLanguage(item.code)} aria-pressed={language === item.code} className={`py-3 px-4 rounded-xl text-left border ${language === item.code ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-neutral-700 border-neutral-200'}`}><span className="block font-semibold">{item.native}</span><span className={`text-xs ${language === item.code ? 'text-teal-100' : 'text-neutral-400'}`}>{item.label}</span></button>)}
          </div>
        </Section>

        <Section icon={Volume2} title={t.tts_section}>
          {supported ? <><div className="flex justify-between text-sm text-neutral-500 mb-2"><span>{t.reading_speed}</span><span className="font-semibold text-teal-700">{rate.toFixed(2)}×</span></div><input type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={event => setRate(Number(event.target.value))} className="w-full accent-teal-700 mb-4" aria-label={t.reading_speed} /><TTSButton text={preview} speaking={speaking} onToggle={toggle} size="md" className="w-full justify-center" /><VoiceWarning language={language} visible={ttsError} className="mt-3" /></> : <p className="text-sm text-neutral-500">{t.tts_unsupported}</p>}
        </Section>

        <Section icon={Type} title={t.accessibility}>
          {/* Text size slider */}
          <div className="pb-5 mb-4 border-b border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-medium text-neutral-900">{t.text_size}</p>
              <span className="text-sm font-semibold text-teal-700">{TEXT_LABELS[textStep]}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-neutral-400 select-none w-4 text-center flex-shrink-0">A</span>
              <div className="relative flex-1 flex flex-col justify-center">
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  value={textStep}
                  onChange={e => setTextStep(Number(e.target.value))}
                  className="w-full accent-teal-700 h-1"
                  aria-label={t.text_size}
                />
                <div className="flex justify-between mt-2 px-0.5">
                  {[0,1,2,3,4].map(i => (
                    <button
                      key={i}
                      onClick={() => setTextStep(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === textStep ? 'bg-teal-700' : 'bg-neutral-300'}`}
                      aria-label={TEXT_LABELS[i]}
                    />
                  ))}
                </div>
              </div>
              <span className="text-xl font-bold text-neutral-600 select-none w-6 text-center flex-shrink-0">A</span>
            </div>
          </div>
          <Toggle id="high-contrast" label={t.high_contrast} sublabel={t.high_contrast_sub} checked={highContrast} onChange={setHighContrast} />
        </Section>


        <Section icon={User} title={t.acc_details_title}>
          <AccountDetails profile={profile} onProfileUpdate={onProfileUpdate} />
        </Section>

        <Section icon={Shield} title={t.privacy_section}>
          <p className="text-sm text-neutral-600 leading-relaxed">{t.privacy_full}</p>
        </Section>

        <Section icon={Info} title={t.about_section}>
          <div className="flex justify-between text-sm"><span className="text-neutral-600">{t.version_label}</span><span className="font-semibold text-neutral-900">0.1.0</span></div>
        </Section>

        <Section icon={LogOut} title="Account">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-sm font-semibold text-danger-600 bg-danger-50 border border-danger-400 rounded-full px-4 py-2.5 hover:bg-danger-50/70 active:scale-95 transition-all disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </Section>
      </div>
    </div>
  )
}
