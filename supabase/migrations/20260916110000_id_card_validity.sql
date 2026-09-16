-- The validity period printed on a candidate's ID card.
--
-- Set once per activation, alongside id_cards_issued_at, and cleared with it
-- so that switching cards off and on again genuinely asks again rather than
-- silently reusing last term's dates.
--
-- Cards already downloaded are unaffected by a later change: a PDF in a
-- candidate's hands is a static file. Only downloads taken after a new
-- activation carry the new dates.
alter table bootcamps
  add column id_cards_valid_from date,
  add column id_cards_valid_to   date;

alter table bootcamps
  add constraint bootcamps_id_card_validity_ordered check (
    id_cards_valid_from is null
    or id_cards_valid_to is null
    or id_cards_valid_to >= id_cards_valid_from
  );

-- Any activation made before validity dates existed has none, and cannot be
-- given one honestly — nobody chose those dates. Switching those intakes off
-- puts them through the new flow, where an admin sets the period explicitly.
-- Nothing is lost: the switch only controls whether a download is offered.
update bootcamps
   set id_cards_issued_at = null,
       id_cards_issued_by = null
 where id_cards_issued_at is not null
   and (id_cards_valid_from is null or id_cards_valid_to is null);

-- Issued means dated: the two are set in the same action, so a card can never
-- be downloadable with a blank validity line printed on the back.
alter table bootcamps
  add constraint bootcamps_id_cards_dated_when_issued check (
    id_cards_issued_at is null
    or (id_cards_valid_from is not null and id_cards_valid_to is not null)
  );
