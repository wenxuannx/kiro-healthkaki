# HealthKaki

A mobile-first web app that helps Singaporeans — especially Pioneer and
Merdeka Generation seniors — understand their medical bills, prescriptions,
and referral letters. Scan or upload a document and HealthKaki extracts the
details, checks which subsidy schemes (CHAS, MediSave, Pioneer/Merdeka
Generation, MediShield Life, MediFund) apply, and explains the results in
plain language — with multi-language support and text-to-speech for
accessibility.

## Tech Stack

- **Next.js 16** — App Router, TypeScript
- **Tailwind CSS v4** — utility-first styling
- **Supabase** — auth (NRIC/FIN + date of birth) and profile storage
- **Google Gemini** — document OCR and data extraction
- **Google Cloud Text-to-Speech** — reads results aloud
- **DeepL** — translates dynamic, document-derived content (static UI copy is
  hand-translated in `src/hooks/i18n.tsx`)
- **Framer Motion** — screen transitions and UI animation

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → Project Settings → API → Project API keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → Project API keys → `service_role` (server-only, never expose to the browser) |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GOOGLE_TTS_CREDENTIALS_JSON` | A Google Cloud service account JSON key with Text-to-Speech access ([console](https://console.cloud.google.com/iam-admin/serviceaccounts)) |
| `DEEPL_KEY` | [DeepL API](https://www.deepl.com/pro-api) |

See the comments in `.env.example` for more detail on each key.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
src/
├── app/
│   ├── api/            # Route handlers (auth, document/medication processing, TTS, profile)
│   └── ...             # App Router pages and layout
├── screens/             # Top-level app screens (Login, Onboarding, Home, Camera, Results, ...)
├── components/          # Reusable UI pieces (cards, modals, TTS controls, etc.)
├── hooks/               # useLang/i18n, useTTS, and other shared hooks
├── lib/                 # Supabase clients, subsidy lookup logic, NRIC redaction, DeepL/Gemini helpers
└── types/               # Shared TypeScript types
```

## Supabase Usage

**In Client Components:**
```ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
```

**In Server Components / Route Handlers / Server Actions:**
```ts
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
```

## Other Scripts

```bash
npm run lint        # ESLint
npm run translate    # Regenerate/update translation strings (scripts/translate.ts)
```
