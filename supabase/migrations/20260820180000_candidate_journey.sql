-- The candidate journey: five visible steps, seven stored stages.
--
-- The stepper a candidate sees has five nodes:
--
--     Application -> Interview -> Physical Interview -> Form -> Onboarded
--
-- The database keeps more detail than that, deliberately. "Scheduled for an
-- interview" and "has been interviewed, awaiting a result" are the two halves
-- of the batching workflow — the 300 -> 50/50/25 slot split is meaningless if
-- you cannot ask who has been scheduled but not yet seen. Both map to the one
-- "Interview" node in the UI; only admin tooling sees them apart.
--
-- Selection is *not* a stage. Passing the interview is what moves a candidate
-- to PHYSICAL_INTERVIEW, so the transition already records it; `is_selected`
-- stores the decision explicitly so that "interviewed and rejected" stays
-- distinguishable from "rejected later", which the stage alone cannot express.
--
-- Two renames are all the enum needs. Positions and sort order are untouched,
-- so `order by stage` still orders by progress, and no column, default, or
-- index has to be rewritten:
--
--     ASSESSMENT   -> PHYSICAL_INTERVIEW   (it is an interview, not a test)
--     FORM_PENDING -> FORM                 (the node is a step, not a debt)

alter type public.application_stage rename value 'ASSESSMENT' to 'PHYSICAL_INTERVIEW';
alter type public.application_stage rename value 'FORM_PENDING' to 'FORM';

-- Tri-state on purpose. NULL means the interview has not been decided yet,
-- which is different from a recorded "no" — a two-state boolean would make
-- every un-interviewed candidate look rejected.
alter table public.applications
    add column if not exists is_selected boolean;

comment on column public.applications.is_selected is
    'Outcome of the Interview stage. NULL = not yet decided, true = through to '
    'the physical interview, false = not selected. Not a stage: the candidate '
    'stepper shows five nodes and selection is the condition for leaving the '
    'second one.';

comment on column public.applications.stage is
    'Seven stored stages behind five visible steps. INTERVIEW_SCHEDULED and '
    'INTERVIEWED both render as the single "Interview" node; REJECTED is '
    'terminal and sits outside the sequence.';

comment on column public.stage_transitions.created_at is
    'When this stage was reached. The candidate tracker reads these as the '
    'per-step timestamps ("12 Sept"), which is why no dated columns exist on '
    'applications itself.';
