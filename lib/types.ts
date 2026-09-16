export type UserRole = 'user' | 'admin' | 'mentor'
export type VideoSection = 'core' | 'bonus'
export type VideoStatus = 'not_started' | 'in_progress' | 'completed'
export type BookingStatus = 'booked' | 'cancelled'
export type Locale = 'nl' | 'en'
export type AccountInstroom = 'vermogenstest' | 'discovery'

export interface DemoUser {
  id: string
  email: string
  name: string
  role: UserRole
  locale: Locale
  whatsapp_opt_in: boolean
  created_at: string
  activated_at: string | null
  trial_started_at: string | null
  trial_expires_at: string | null
  last_activity_at: string | null
  instroom?: AccountInstroom | null
  hubspot_owner_id?: string | null
  owner_name?: string | null
  // Live afgeleide call-status — samengevoegd in /api/me, staat niet in de users-tabel.
  call_opened_at?: string | null
  call_clicked_at?: string | null
  call_booked?: boolean
  call_booked_at?: string | null
  opvolging_actief?: boolean
  call_start_at?: string | null
  call_end_at?: string | null
  call_timezone?: string | null
}

export interface DemoVideo {
  id: string
  order_no: number
  section: VideoSection
  title: string
  description: string
  duration_seconds: number
  video_url: string | null
  thumbnail_url: string | null
  content_type: 'video' | 'pdf'
}

export interface DemoVideoProgress {
  id: string
  user_id: string
  video_id: string
  status: VideoStatus
  progress_pct: number
  started_at: string | null
  completed_at: string | null
  last_activity_at: string | null
  updated_at: string
}

export interface DemoUserFunnel {
  id: string
  user_id: string
  videos_completed_count: number
  all_completed_at: string | null
  event_booked: boolean
  event_booked_at: string | null
  invest_avond_geclaimd: boolean
  invest_avond_verschenen: boolean
}

export interface DemoEvent {
  id: string
  title: string
  starts_at: string
  location: string
  capacity: number
  spots_left: number
  price_eur?: number | null
  description?: string | null
}

export interface DemoEventBooking {
  id: string
  user_id: string
  event_id: string
  booked_at: string
  status: BookingStatus
}

export interface DemoWebhookLog {
  id: string
  user_id: string
  event_type: string
  payload_json: Record<string, unknown>
  created_at: string
  response_status: string | null
}

// ── Workflow engine ──────────────────────────────────────────

export type TriggerStatus = 'verstuurd' | 'onderdrukt' | 'gefaald' | 'no_endpoint'

export interface DemoTriggerSent {
  id: string
  created_at: string
  user_id: string
  workflow_naam: string
}

export interface DemoTriggerLog {
  id: string
  created_at: string
  user_id: string
  contact_email: string
  workflow_nummer: number
  workflow_naam: string
  status: TriggerStatus
  reden: string | null
  payload_json: Record<string, unknown>
  response_status: string | null
}

export interface DemoWebhookConfig {
  trigger_naam: string
  label: string
  webhook_url: string
  actief: boolean
}

export interface DemoConfig {
  sleutel: string
  waarde: string
}

// ── Quiz ─────────────────────────────────────────────────────

export interface DemoQuizAnswer {
  question_no: number
  chosen: 'A' | 'B' | 'C' | 'D'
  correct: boolean
}

export interface DemoQuizSubmission {
  id: string
  user_id: string
  submitted_at: string
  score: number
  answers: DemoQuizAnswer[]
}

// ── Account-aanmaken webhook logs ────────────────────────────

export type AccountWebhookOutcome = 'created' | 'reused' | 'error'

export interface AccountWebhookLog {
  id: string
  created_at: string
  email: string | null
  payload_json: Record<string, unknown>
  outcome: AccountWebhookOutcome
  reden: string | null
  activatielink: string | null
  http_status: number
  instroom: 'vermogenstest' | 'discovery' | null
}

export interface LatestAccountWebhooks {
  discovery: AccountWebhookLog | null
  vermogenstest: AccountWebhookLog | null
}
