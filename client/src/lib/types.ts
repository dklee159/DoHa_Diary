export interface User {
  id: number
  username: string
  displayName: string
  coupleId: number | null
  trackingEnabled: boolean
  shareCycle: boolean
  cycleLenOverride: number | null
  periodLenOverride: number | null
  onboarded: boolean
}

export interface Period {
  id?: number
  start_date: string
  end_date: string | null
}

export type DayStatus =
  | 'period'
  | 'ovulation'
  | 'fertile'
  | 'pms'
  | 'predicted_period'
  | 'none'

export interface Prediction {
  cycleLen: number
  periodLen: number
  nextPeriodStart: string | null
  predictedPeriods: { start: string; end: string }[]
  fertileWindows: { start: string; end: string; ovulation: string }[]
  pmsWindows: { start: string; end: string }[]
}

export interface TodaySummary {
  status: DayStatus
  dDay: number | null
}

export interface PredictionsResponse {
  periods: Period[]
  prediction: Prediction
  today: TodaySummary
}

export interface PartnerCycle {
  periods: Period[]
  prediction: Prediction
  today: TodaySummary
}

export interface PartnerResponse {
  connected: boolean
  pending: boolean
  inviteCode?: string | null
  partner?: { displayName: string }
  cycle?: PartnerCycle | null
}

export type EventCategory = 'date' | 'anniversary' | 'trip' | 'etc'

export interface EventItem {
  id: number
  date: string
  title: string
  category: EventCategory
  isShared: boolean
  mine: boolean
}

export type Mood = 'great' | 'good' | 'soso' | 'bad' | 'awful'
export type Flow = 'light' | 'medium' | 'heavy'

export interface DailyLog {
  date: string
  mood: Mood | null
  symptoms: string[]
  flow: Flow | null
  memo: string
}
