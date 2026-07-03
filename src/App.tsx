import { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home as HomeIcon, HelpCircle, Settings as SettingsIcon } from 'lucide-react'

import { LangProvider, useLang, T } from './hooks/i18n'
import { birthYearFromIsoDate } from './lib/birthdate-cookie'
import { createClient } from './services/supabase/client'
import Login from './screens/Login'
import Onboarding from './screens/Onboarding'
import Splash from './screens/Splash'

// ── Text size context ─────────────────────────────────────────
// Steps 0–4 map to root font sizes: 13 14 16 18 20 px
const TEXT_SIZE_PX = [13, 14, 16, 18, 20]
const TextSizeContext = createContext<{ step: number; setStep: (v: number) => void }>({
  step: 2,
  setStep: () => {},
})
export const useTextSize = () => useContext(TextSizeContext)
/** @deprecated use useTextSize */
export const useLargeText = () => {
  const { step, setStep } = useContext(TextSizeContext)
  return { largeText: step > 2, setLargeText: (v: boolean) => setStep(v ? 3 : 2) }
}

// ── High contrast context ─────────────────────────────────────
const HighContrastContext = createContext<{ highContrast: boolean; setHighContrast: (v: boolean) => void }>({
  highContrast: false,
  setHighContrast: () => {},
})
export const useHighContrast = () => useContext(HighContrastContext)

import HomeScreen        from './screens/Home'
import CameraScreen      from './screens/Camera'
import ConfirmScreen     from './screens/Confirm'
import ProcessingScreen  from './screens/Processing'
import ResultsScreen     from './screens/Results'
import DetailsScreen     from './screens/Details'
import BillScreen        from './screens/BillScreen'
import MedicationsScreen from './screens/MedicationsScreen'
import HelpScreen        from './screens/Help'
import SettingsScreen    from './screens/Settings'
import ErrorScreen       from './screens/ErrorScreen'

import type { DocumentTypeId, Screen, SubsidyCard, ProcessDocumentResponse, Profile } from './types'

const SHOW_NAV: Screen[] = ['home', 'help', 'settings', 'results']

const SCREEN_ORDER: Screen[] = [
  'home', 'camera', 'confirm', 'processing', 'results', 'bill', 'medications', 'details',
  'help', 'settings', 'error',
]

const ease = [0.25, 0.1, 0.25, 1] as [number, number, number, number]

const pageVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 32 : -32 }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease } },
  exit:    (dir: number) => ({ opacity: 0, x: dir >= 0 ? -32 : 32, transition: { duration: 0.25, ease } }),
}

type FailedProcessingStage = 'uploading' | 'reading' | 'finding'

interface ProcessingFailure {
  message: string
  stage: FailedProcessingStage
  timedOut: boolean
}

const DOCUMENT_TIMEOUT_MS = 30_000

function AppInner({ profile, onSignOut, onProfileUpdate }: { profile: Profile; onSignOut: () => void; onProfileUpdate: (profile: Profile) => void }) {
  const [screen, setScreen]           = useState<Screen>('home')
  const [prevScreen, setPrev]         = useState<Screen>('home')
  const [file, setFile]               = useState<File | null>(null)
  const [selectedSubsidy, setSubsidy] = useState<SubsidyCard | null>(null)
  const [apiResult, setApiResult]     = useState<ProcessDocumentResponse | null>(null)
  const [processingError, setProcessingError] = useState<ProcessingFailure | null>(null)
  // Category picked via a Home-screen chip (e.g. "Prescription Slip"), carried
  // through to Confirm as the pre-selected document category so users don't
  // have to wait for auto-detect when they already told us what it is.
  const [pickedCategory, setPickedCategory] = useState<DocumentTypeId | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const requestSequence = useRef(0)
  const { language } = useLang()
  const t = T[language]

  const navigate = useCallback((next: Screen) => {
    setPrev(screen)
    setScreen(next)
  }, [screen])

  const dir = SCREEN_ORDER.indexOf(screen) >= SCREEN_ORDER.indexOf(prevScreen) ? 1 : -1
  const showNav = SHOW_NAV.includes(screen)

  const NAV_ITEMS = [
    { id: 'home'     as Screen, label: t.nav_home,     Icon: HomeIcon },
    { id: 'help'     as Screen, label: t.nav_help,     Icon: HelpCircle },
    { id: 'settings' as Screen, label: t.nav_settings, Icon: SettingsIcon },
  ]

  // Kicks off the Gemini extraction + subsidy lookup as soon as a file is picked,
  // so the auto-detected document type is ready by the time the user reaches Confirm.
  useEffect(() => () => activeRequest.current?.abort(), [])

  const runFetch = useCallback((selected: File) => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    const requestId = ++requestSequence.current
    activeRequest.current = controller

    const formData = new FormData()
    formData.append('file', selected)
    formData.append('birthYear', String(birthYearFromIsoDate(profile.date_of_birth)))
    if (profile.citizenship_status) {
      formData.append('citizenshipStatus', profile.citizenship_status)
    }
    if (profile.citizenship_year != null) {
      formData.append('citizenshipYear', String(profile.citizenship_year))
    }
    if (profile.household_monthly_income != null && profile.household_size) {
      formData.append(
        'incomePerCapita',
        String(profile.household_monthly_income / profile.household_size)
      )
    }

    const timeout = window.setTimeout(() => controller.abort(), DOCUMENT_TIMEOUT_MS)

    fetch('/api/process-document', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const error = new Error(body.error ?? 'Processing failed') as Error & {
            stage?: FailedProcessingStage
          }
          error.stage = res.status === 400 ? 'uploading' : 'reading'
          throw error
        }
        return res.json() as Promise<ProcessDocumentResponse>
      })
      .then(result => {
        if (requestId !== requestSequence.current) return

        if (result.message && /subsidy lookup.*unavailable/i.test(result.message)) {
          setProcessingError({
            message: `${result.message} Please try again.`,
            stage: 'finding',
            timedOut: false,
          })
          return
        }

        setApiResult(result)
      })
      .catch((error: unknown) => {
        if (requestId !== requestSequence.current) return

        const timedOut = controller.signal.aborted
        const failedStage =
          error instanceof Error && 'stage' in error
            ? (error as Error & { stage: FailedProcessingStage }).stage
            : timedOut
              ? 'reading'
              : 'uploading'

        setProcessingError({
          message: timedOut
            ? 'Processing timed out after 30 seconds. Please try again.'
            : error instanceof Error
              ? error.message
              : 'Processing failed. Please try again.',
          stage: failedStage,
          timedOut,
        })
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (requestId === requestSequence.current) activeRequest.current = null
      })
  }, [profile])

  // Entry point used by Home/Camera/Confirm on file selection. Resets
  // in-flight state immediately (so Confirm's preview updates right away).
  // If a birthdate is already on file (returning session), the fetch kicks
  // off right away so auto-detect is ready by the time Confirm renders —
  // otherwise it waits for the inline birthdate field on Confirm to fire it.
  // Prescription slips are the one document type that never surfaces
  // age-gated subsidy schemes, so a chip-picked prescription scan can start
  // processing without a birthdate at all.
  const processFile = useCallback((selected: File) => {
    activeRequest.current?.abort()
    setFile(selected)
    setApiResult(null)
    setProcessingError(null)
    setSubsidy(null)

    runFetch(selected)
  }, [runFetch])

  const retryProcessing = useCallback(() => {
    if (!file) {
      navigate('camera')
      return
    }

    processFile(file)
    navigate('processing')
  }, [file, navigate, processFile])

  const renderScreen = () => {
    switch (screen) {
      case 'home':        return <HomeScreen onNavigate={navigate} onFileReady={processFile} onSelectCategory={setPickedCategory} />
      case 'camera':      return <CameraScreen onNavigate={navigate} onFileReady={processFile} />
      case 'confirm':     return <ConfirmScreen onNavigate={navigate} file={file} onFileReady={processFile} result={apiResult} scanError={processingError !== null} pickedCategory={pickedCategory} />
      case 'processing':  return <ProcessingScreen onNavigate={navigate} result={apiResult} scanError={processingError !== null} />
      case 'results':     return <ResultsScreen onNavigate={navigate} onSelectSubsidy={setSubsidy} apiResult={apiResult} birthYear={birthYearFromIsoDate(profile.date_of_birth)} />
      case 'bill':        return <BillScreen onNavigate={navigate} bill={apiResult?.extracted.bill ?? null} institution={apiResult?.extracted.institution ?? null} visitDate={apiResult?.extracted.visitDate ?? null} />
      case 'medications': return <MedicationsScreen onNavigate={navigate} prescriptions={apiResult?.extracted.prescriptions ?? []} />
      case 'details':     return <DetailsScreen onNavigate={navigate} subsidy={selectedSubsidy} />
      case 'help':        return <HelpScreen onNavigate={navigate} />
      case 'settings':    return <SettingsScreen onNavigate={navigate} onSignOut={onSignOut} profile={profile} onProfileUpdate={onProfileUpdate} />
      case 'error':       return <ErrorScreen onNavigate={navigate} errorType="processing" errorMessage={processingError?.message} errorStage={processingError?.stage} timedOut={processingError?.timedOut} onRetry={retryProcessing} />
      default:            return <HomeScreen onNavigate={navigate} onFileReady={processFile} />
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8F9FA' }}>
      {/* Screen content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence custom={dir} mode="wait">
          <motion.div
            key={screen}
            custom={dir}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 overflow-y-auto no-scrollbar"
          >
            <div className="min-h-full max-w-2xl mx-auto w-full md:shadow-[1px_0_0_0_#e5e7eb,-1px_0_0_0_#e5e7eb]">
              {renderScreen()}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <AnimatePresence>
        {showNav && (
          <motion.nav
            key="bottom-nav"
            initial={{ y: 72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 72, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="flex-shrink-0 bg-white border-t border-neutral-200 max-w-2xl mx-auto w-full md:shadow-[1px_0_0_0_#e5e7eb,-1px_0_0_0_#e5e7eb]"
            aria-label="Main navigation"
          >
            <div className="flex items-center justify-around px-2 pt-2 pb-6">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = screen === id
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    aria-current={active ? 'page' : undefined}
                    aria-label={label}
                    className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[60px] transition-colors"
                    style={{ minHeight: 56 }}
                  >
                    <motion.div animate={{ scale: active ? 1.12 : 1 }} transition={{ type: 'spring', stiffness: 420, damping: 22 }}>
                      <Icon className={`w-6 h-6 transition-colors ${active ? 'text-teal-700' : 'text-neutral-400'}`} strokeWidth={active ? 2.5 : 1.8} />
                    </motion.div>
                    <span className={`text-xs font-semibold transition-colors ${active ? 'text-teal-700' : 'text-neutral-400'}`}>
                      {label}
                    </span>
                    {active && (
                      <motion.div layoutId="tab-dot" className="absolute bottom-1 w-1 h-1 rounded-full bg-teal-700" transition={{ type: 'spring', stiffness: 420, damping: 30 }} />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  )
}

type AuthStatus = 'loading' | 'signedOut' | 'onboarding' | 'ready'

const SPLASH_MIN_MS = 1200

function AuthGate() {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [splashElapsed, setSplashElapsed] = useState(false)

  const loadProfile = useCallback(async () => {
    const res = await fetch('/api/profile')
    if (!res.ok) {
      setStatus('signedOut')
      return
    }
    const { profile: loaded } = (await res.json()) as { profile: Profile | null }
    if (loaded?.citizenship_status) {
      setProfile(loaded)
      setStatus('ready')
    } else if (loaded) {
      setProfile(loaded)
      setStatus('onboarding')
    } else {
      setStatus('signedOut')
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadProfile()
      } else {
        setStatus('signedOut')
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadProfile()
      } else {
        setProfile(null)
        setStatus('signedOut')
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [loadProfile])

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashElapsed(true), SPLASH_MIN_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }, [])

  if (status === 'loading' || !splashElapsed) {
    return (
      <AnimatePresence>
        <Splash key="splash" />
      </AnimatePresence>
    )
  }

  if (status === 'signedOut') {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <div className="min-h-full max-w-2xl mx-auto w-full md:shadow-[1px_0_0_0_#e5e7eb,-1px_0_0_0_#e5e7eb] flex-1">
          <Login onAuthenticated={loadProfile} />
        </div>
      </div>
    )
  }

  if (status === 'onboarding') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F8F9FA' }}>
        <div className="min-h-full max-w-2xl mx-auto w-full md:shadow-[1px_0_0_0_#e5e7eb,-1px_0_0_0_#e5e7eb] flex-1">
          <Onboarding onComplete={(p) => { setProfile(p); setStatus('ready') }} />
        </div>
      </div>
    )
  }

  return <AppInner profile={profile!} onSignOut={handleSignOut} onProfileUpdate={setProfile} />
}

export default function App() {
  const [step, setStepState] = useState(2)
  const setStep = (v: number) => {
    setStepState(v)
    document.documentElement.style.fontSize = TEXT_SIZE_PX[v] + 'px'
  }

  const [highContrast, setHighContrastState] = useState(false)
  const setHighContrast = (v: boolean) => {
    setHighContrastState(v)
    document.documentElement.classList.toggle('high-contrast', v)
  }

  return (
    <LangProvider>
      <TextSizeContext.Provider value={{ step, setStep }}>
      <HighContrastContext.Provider value={{ highContrast, setHighContrast }}>
        <AuthGate />
      </HighContrastContext.Provider>
      </TextSizeContext.Provider>
    </LangProvider>
  )
}
