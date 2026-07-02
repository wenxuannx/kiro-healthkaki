import {
  Activity,
  Award,
  CreditCard,
  FileText,
  Heart,
  Hospital,
  Medal,
  Pill,
  ShieldCheck,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

// Maps the small set of icon keys stored on SubsidyCard/Medication (both real
// API data and mock data in utils.ts) to a concrete Lucide component. Kept as
// a string key on the data itself (rather than a component reference) so the
// data stays plain/serializable the way it already was as an emoji string.
export const ICON_MAP: Record<string, LucideIcon> = {
  award: Award,
  medal: Medal,
  tag: Tag,
  'credit-card': CreditCard,
  hospital: Hospital,
  shield: ShieldCheck,
  wallet: Wallet,
  file: FileText,
  pill: Pill,
  heart: Heart,
  activity: Activity,
}

export function SchemeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? FileText
  return <Icon className={className} />
}
