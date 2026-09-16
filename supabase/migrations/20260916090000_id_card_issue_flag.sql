-- Per-intake switch for candidate ID cards.
--
-- Mirrors how the AI interview announcement is stored (a nullable timestamp
-- plus the admin who set it, cleared again to reverse) but deliberately not
-- what that toggle *does*: announcing results moves stages and notifies
-- candidates, and cannot truly be undone. Issuing ID cards only decides
-- whether a download button is shown, so turning it off is a real undo.
--
-- It sits on bootcamps rather than on a phase row because an ID card is not
-- tied to any phase window: an admin may issue cards at any point after the
-- physical interview, at their own discretion.
alter table bootcamps
  add column id_cards_issued_at timestamptz,
  add column id_cards_issued_by uuid references profiles(id);

comment on column bootcamps.id_cards_issued_at is
  'When an admin switched ID cards on for this intake. Null means off. '
  'Eligibility is per candidate on top of this: the latest physical '
  'interview invite must have result = SELECTED.';
