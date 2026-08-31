/**
 * Safe readers for InterviewerAI's records.
 *
 * Their API publishes no response schemas, so every field here is a guess
 * that has to survive being wrong. These helpers take the field names a value
 * might plausibly live under and return the first one that is actually
 * present, rather than letting `undefined` reach the DOM as "undefined".
 */

import type { ExternalRecord } from '@/lib/types'

/** First of `keys` present as a non-empty string. */
export function text(record: ExternalRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}

/** First of `keys` present as a finite number. Booleans are not numbers here. */
export function num(record: ExternalRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

/** A nested object, when their payload nests instead of flattening. */
export function nested(record: ExternalRecord, key: string): ExternalRecord | null {
  const value = record[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ExternalRecord)
    : null
}

export function list(record: ExternalRecord, ...keys: string[]): ExternalRecord[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value as ExternalRecord[]
  }
  return []
}

/** The record's own id, under whichever key carries it. */
export function recordId(record: ExternalRecord): number | null {
  return num(record, 'id', 'interview_id', 'request_id')
}

/**
 * What *we* know about this candidate, joined server-side from our own invite
 * and application rows (`local` on the payload).
 *
 * This is the authoritative source for anything about a person. Their API's
 * own fields are undocumented and may carry no name at all, which is what
 * used to surface as "Unknown candidate" — a real record rendering as an
 * absence because we were reading the wrong half of it.
 */
export function local(record: ExternalRecord): ExternalRecord | null {
  return nested(record, 'local')
}

/** Display name for whoever the record is about. */
export function candidateName(record: ExternalRecord): string {
  const ours = local(record)
  if (ours) {
    const known = text(ours, 'candidate_name')
    if (known) return known
  }

  const inner = nested(record, 'candidate') ?? nested(record, 'user')
  return (
    text(record, 'candidate_name', 'name', 'full_name') ??
    (inner ? text(inner, 'name', 'full_name', 'email') : null) ??
    // Reached only when neither we nor they hold a name — a record for
    // somebody this intake never invited. Naming that plainly beats
    // "Unknown candidate", which read like a loading failure.
    candidateEmail(record) ??
    'Not in this intake'
  )
}

/** Our candidate code for them, when the record belongs to someone we invited. */
export function candidateCode(record: ExternalRecord): string | null {
  const ours = local(record)
  return ours ? text(ours, 'candidate_code') : null
}

/** The program/track they applied to, when the record belongs to an
 * applicant (manual invite rows have no application, so no track). */
export function programTitle(record: ExternalRecord): string | null {
  const ours = local(record)
  return ours ? text(ours, 'program_title') : null
}

/** Which of our bootcamps invited them — only meaningful on a platform-wide
 * view; a bootcamp-scoped one already knows the answer. */
export function bootcampName(record: ExternalRecord): string | null {
  const ours = local(record)
  return ours ? text(ours, 'bootcamp_name')?.trim() || null : null
}

/** One application's id, live stage and status — present only when the
 * record belongs to a real applicant (a manual/Instructor invite has none). */
export interface LocalApplication {
  id: string
  stage: string | null
  status: string | null
}

export function applicationInfo(record: ExternalRecord): LocalApplication | null {
  const ours = local(record)
  const id = ours ? text(ours, 'application_id') : null
  if (!id) return null
  return {
    id,
    stage: ours ? text(ours, 'application_stage') : null,
    status: ours ? text(ours, 'application_status') : null,
  }
}

const _PAST_INTERVIEW_STAGES = new Set(['PHYSICAL_INTERVIEW', 'FORM', 'ONBOARDED'])

/** Whether the "Advance to Physical Interview" / "Reject" actions make sense
 * for this record: a real, still-ACTIVE application that has not already
 * moved past the interview stage. A manual/Instructor invite (no
 * application) or a stage already decided gets neither. */
export function canDecideStage(record: ExternalRecord): boolean {
  const app = applicationInfo(record)
  if (!app || app.status !== 'ACTIVE') return false
  return !(app.stage && _PAST_INTERVIEW_STAGES.has(app.stage))
}

/** Mirrors PASS_THRESHOLD in backend/app/services/ai_interview_service.py —
 * decided 2026-08-30: 50/100. Keep both in sync if this ever changes. */
export const AI_PASS_THRESHOLD = 50

/** null when there is no score to judge yet. A fact about the number, not an
 * automated verdict — see PASS_THRESHOLD's own comment. */
export function hasPassed(record: ExternalRecord): boolean | null {
  const value = score(record)
  return value === null ? null : value >= AI_PASS_THRESHOLD
}

export function candidateEmail(record: ExternalRecord): string | null {
  const ours = local(record)
  if (ours) {
    const known = text(ours, 'email')
    if (known) return known
  }
  const inner = nested(record, 'candidate') ?? nested(record, 'user')
  return text(record, 'candidate_email', 'email') ?? (inner ? text(inner, 'email') : null)
}

/**
 * The headline score. Mirrors `_SCORE_KEYS` in
 * backend/app/services/ai_interview_service.py — both sides look in the same
 * places, so a score visible to an admin is the same one the candidate sees.
 */
export function score(record: ExternalRecord): number | null {
  const direct = num(record, 'overall_score', 'final_score', 'total_score', 'score', 'percentage')
  if (direct !== null) return direct

  for (const container of ['scoring', 'report', 'result', 'summary', 'evaluation']) {
    const inner = nested(record, container)
    if (inner) {
      const found = num(inner, 'overall_score', 'final_score', 'total_score', 'score', 'percentage')
      if (found !== null) return found
    }
  }
  return null
}

export function status(record: ExternalRecord): string | null {
  return text(record, 'status', 'state', 'interview_status')
}

/** A media URL their payload points at, for snapshots and recordings. */
export function mediaUrl(record: ExternalRecord): string | null {
  return text(record, 'url', 'signed_url', 'video_url', 'image_url', 'snapshot_url', 'download_url')
}

export function timestamp(record: ExternalRecord): string | null {
  return text(record, 'completed_at', 'created_at', 'updated_at', 'captured_at', 'taken_at')
}

export function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}
