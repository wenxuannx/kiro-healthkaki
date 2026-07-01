export type Screen =
  | 'home'
  | 'camera'
  | 'confirm'
  | 'processing'
  | 'results'
  | 'details'
  | 'bill'
  | 'medications'
  | 'history'
  | 'help'
  | 'settings'
  | 'error'

export type ErrorType = 'upload' | 'processing' | 'no_subsidies' | 'offline' | 'validation'

export type Language = 'en' | 'zh' | 'ms' | 'ta'

export interface SubsidyCard {
  id: string
  name: string
  chineseName: string
  eligible: boolean
  saves: number
  outOfPocket: number
  icon: string
  badgeColor: 'orange' | 'teal' | 'navy' | 'gray'
  description: string
  benefits: string[]
  howToUse: string
}

export interface Medication {
  id: string
  name: string
  genericName: string
  purpose: string
  dosage: string
  frequency: string
  timing: string
  specialNotes: string
  icon: string
  translations: {
    zh: { purpose: string; frequency: string; timing: string; specialNotes: string }
    ms: { purpose: string; frequency: string; timing: string; specialNotes: string }
    ta: { purpose: string; frequency: string; timing: string; specialNotes: string }
  }
}

export interface BillLine {
  item: string
  amount: number
  subsidised: boolean
  coveredBy?: string
}

export interface ScanResult {
  id: string
  date: string
  time: string
  documentType: string
  clinicName: string
  totalBill: number
  totalSaved: number
  outOfPocket: number
  canUseMediSave: boolean
  mediSaveBalance: number
  finalCost: number
  confidence: number
  subsidies: SubsidyCard[]
  medications?: Medication[]
  billLines?: BillLine[]
}

export interface SubsidyScheme {
  id: string
  name: string
  chinese_name: string | null
  malay_name: string | null
  tamil_name: string | null
  description: string
  institution_types: string[]
  coverage_percentage: number | null
  applicable_codes: string[]
  applicable_diagnoses: string[]
  min_birth_year: number | null
  max_birth_year: number | null
}

export type DocumentTypeId = 'invoice' | 'referral' | 'diagnosis' | 'prescription' | 'followup' | 'specialist'

export interface ExtractedDocument {
  medicalCodes: string[]
  diagnoses: string[]
  visitDate: string | null
  institution: string | null
  documentType: DocumentTypeId | null
  rawText: string
}

export interface ProcessDocumentResponse {
  submission: { id: string; storage_path: string; created_at: string }
  extracted: ExtractedDocument
  subsidies: SubsidyScheme[]
  subsidiesMessage: string | null
}

export interface HistoryItem {
  id: string
  date: string
  time: string
  clinicName: string
  outOfPocket: number
  totalSaved: number
  documentType: string
}
