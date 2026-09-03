-- AI Interview results: announced in bulk, not revealed the moment a
-- candidate finishes.
--
-- Until an admin announces, a candidate sees only "completed" — no score, no
-- pass/fail. Announcing reveals every completed candidate's result at once
-- and moves their applications on (passed -> PHYSICAL_INTERVIEW, everyone
-- else -> REJECTED), through the existing advance_stage path.
--
-- A deliberate departure from the read-time derivation used elsewhere in
-- this feature (invite expiry, physical-interview "missed"): announcement is
-- an *event an admin causes*, not a fact about the clock, so there is
-- nothing to derive it from. It has to be stored.

-- ------------------------------------------------------ where it is stored --
-- On the phase row rather than on `bootcamps`: the INTERVIEW phase is what
-- already gates AI interview invites and holds the deadline the announce
-- action is gated behind, so the gate and the flag are read in one query.
--
-- Two nullable columns rather than a boolean, matching this table's own
-- closed_by/closed_at pair: null means "not announced", and a timestamp
-- records when without needing a second column to ask. Hiding sets both back
-- to null — the audit trail, not this row, is the history of who did what.
alter table public.bootcamp_phases
    add column if not exists results_announced_at timestamptz,
    add column if not exists results_announced_by uuid
        references public.profiles (id) on delete set null;

comment on column public.bootcamp_phases.results_announced_at is
    'When this phase''s results were made visible to candidates. Null means '
    'hidden. Only meaningful for the INTERVIEW phase today.';

-- --------------------------------------------------- the one-time popup --
-- The reveal popup fires once per candidate, not on every dashboard visit.
-- Stamped the first time they load their own revealed result.
--
-- Beside admin_notified_at on the same table, which is the identical shape of
-- thing: a nullable timestamp marking a one-time event on the per-candidate
-- AI-interview row.
alter table public.interview_invites
    add column if not exists result_seen_at timestamptz;

comment on column public.interview_invites.result_seen_at is
    'When the candidate first saw their announced AI interview result. Gates '
    'the one-time reveal popup; null means they have not seen it yet.';
