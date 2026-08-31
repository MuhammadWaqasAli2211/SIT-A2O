"""Sequencing, gating, and age-conditional validation for the 4-item
Onboarding Form.

The interesting behaviour is entirely in ordering and locking — whether a
form is reachable, and whether reopening one re-locks what follows — so
those are tested directly against the pure helpers rather than only through
`submit`/`reopen`.
"""

import uuid
from datetime import date

import pytest

from app.core.exceptions import ConflictError
from app.models.application import Application
from app.models.enums import ApplicationStage, OnboardingFormStatus, OnboardingFormType, UserRole
from app.models.onboarding import OnboardingFormSubmission
from app.models.user import CandidateProfile, Profile
from app.services import onboarding_form_service as svc

FT = OnboardingFormType


def row(form_type, status=OnboardingFormStatus.SUBMITTED):
    return OnboardingFormSubmission(id=uuid.uuid4(), form_type=form_type, status=status)


class FakeSession:
    """Enough Session for submit()/reopen(): one canned scalars() result and
    one canned get() result, plus no-op writes."""

    def __init__(self, rows=None, candidate_profile=None):
        self._rows = rows or []
        self._candidate_profile = candidate_profile
        self.added = []

    def scalars(self, _stmt):
        return list(self._rows)

    def get(self, _model, _pk):
        return self._candidate_profile

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass


def application(stage=ApplicationStage.FORM):
    return Application(
        id=uuid.uuid4(), candidate_code="B08-001", bootcamp_id=uuid.uuid4(),
        profile_id=uuid.uuid4(), stage=stage,
    )


def actor():
    return Profile(id=uuid.uuid4(), email="c@example.com", role=UserRole.CANDIDATE)


# -------------------------------------------------------------- ordering --


def test_the_first_form_is_never_blocked():
    svc.assert_in_order(FT.BACKGROUND_VERIFICATION, {})


def test_a_later_form_is_blocked_with_nothing_submitted_yet():
    with pytest.raises(ConflictError, match="Background Verification"):
        svc.assert_in_order(FT.EMPLOYMENT_APPLICATION, {})


def test_a_later_form_unblocks_once_its_predecessor_is_submitted():
    rows = {FT.BACKGROUND_VERIFICATION: row(FT.BACKGROUND_VERIFICATION)}
    svc.assert_in_order(FT.EMPLOYMENT_APPLICATION, rows)


def test_a_reopened_predecessor_still_blocks():
    """The whole point of reopening: it must behave like "not submitted" for
    everything downstream, not like a completed step."""
    rows = {FT.BACKGROUND_VERIFICATION: row(FT.BACKGROUND_VERIFICATION, OnboardingFormStatus.REOPENED)}
    with pytest.raises(ConflictError, match="Background Verification"):
        svc.assert_in_order(FT.EMPLOYMENT_APPLICATION, rows)


def test_the_last_form_requires_all_three_predecessors():
    rows = {
        FT.BACKGROUND_VERIFICATION: row(FT.BACKGROUND_VERIFICATION),
        FT.EMPLOYMENT_APPLICATION: row(FT.EMPLOYMENT_APPLICATION),
    }
    with pytest.raises(ConflictError, match="Half Nama"):
        svc.assert_in_order(FT.BANK_PAYMENT_DETAILS, rows)


# --------------------------------------------------------------- locking --


def test_unlocked_map_with_nothing_submitted_opens_only_the_first():
    unlocked = svc.unlocked_map({})
    assert unlocked[FT.BACKGROUND_VERIFICATION] is True
    assert unlocked[FT.EMPLOYMENT_APPLICATION] is False
    assert unlocked[FT.HALF_NAMA] is False
    assert unlocked[FT.BANK_PAYMENT_DETAILS] is False


def test_unlocked_map_advances_one_step_at_a_time():
    rows = {FT.BACKGROUND_VERIFICATION: row(FT.BACKGROUND_VERIFICATION)}
    unlocked = svc.unlocked_map(rows)
    assert unlocked[FT.EMPLOYMENT_APPLICATION] is True
    assert unlocked[FT.HALF_NAMA] is False


def test_reopening_an_earlier_form_relocks_everything_after_it():
    """Forms 1 and 3 were both submitted; form 2 gets sent back. Form 3
    should re-lock even though it was itself already submitted."""
    rows = {
        FT.BACKGROUND_VERIFICATION: row(FT.BACKGROUND_VERIFICATION),
        FT.EMPLOYMENT_APPLICATION: row(FT.EMPLOYMENT_APPLICATION, OnboardingFormStatus.REOPENED),
        FT.HALF_NAMA: row(FT.HALF_NAMA),
    }
    unlocked = svc.unlocked_map(rows)
    assert unlocked[FT.BACKGROUND_VERIFICATION] is True
    # The reopened form itself stays reachable, so the candidate can fix it.
    assert unlocked[FT.EMPLOYMENT_APPLICATION] is True
    assert unlocked[FT.HALF_NAMA] is False
    assert unlocked[FT.BANK_PAYMENT_DETAILS] is False


def test_hub_is_locked_until_all_four_are_submitted():
    rows = {ft: row(ft) for ft in list(FT)[:3]}
    assert svc.hub_unlocked(rows) is False


def test_hub_unlocks_once_all_four_are_submitted():
    rows = {ft: row(ft) for ft in FT}
    assert svc.hub_unlocked(rows) is True


def test_hub_relocks_if_any_submitted_form_is_reopened():
    rows = {ft: row(ft) for ft in FT}
    rows[FT.HALF_NAMA] = row(FT.HALF_NAMA, OnboardingFormStatus.REOPENED)
    assert svc.hub_unlocked(rows) is False


# --------------------------------------------------- bank/wallet fields --


def test_an_adult_without_an_iban_is_rejected():
    with pytest.raises(ConflictError, match="iban"):
        svc.validate_bank_payment_data(
            {"bank_name": "HBL", "account_title": "A B"}, is_adult=True
        )


def test_an_adult_with_all_bank_fields_passes():
    svc.validate_bank_payment_data(
        {"bank_name": "HBL", "account_title": "A B", "iban": "PK00HABB0000000000000000"},
        is_adult=True,
    )


def test_a_minor_without_a_wallet_number_is_rejected():
    with pytest.raises(ConflictError, match="wallet_number"):
        svc.validate_bank_payment_data({"wallet_provider": "Easypaisa"}, is_adult=False)


def test_a_minor_with_wallet_fields_passes():
    svc.validate_bank_payment_data(
        {"wallet_provider": "JazzCash", "wallet_number": "03001234567"}, is_adult=False
    )


def test_bank_fields_do_not_satisfy_a_minors_requirement():
    """A minor submitting bank fields instead of a wallet must still fail —
    the two field sets are exclusive, not interchangeable."""
    with pytest.raises(ConflictError):
        svc.validate_bank_payment_data(
            {"bank_name": "HBL", "account_title": "A B", "iban": "PK00"}, is_adult=False
        )


# -------------------------------------------------------------- gating --


@pytest.mark.parametrize(
    "stage",
    [ApplicationStage.APPLIED, ApplicationStage.INTERVIEW_SCHEDULED, ApplicationStage.AI_INTERVIEWED,
     ApplicationStage.PHYSICAL_INTERVIEW, ApplicationStage.REJECTED],
)
def test_onboarding_is_locked_before_the_form_stage(stage):
    with pytest.raises(ConflictError, match="not open yet"):
        svc.assert_onboarding_unlocked(application(stage=stage))


@pytest.mark.parametrize("stage", [ApplicationStage.FORM, ApplicationStage.ONBOARDED])
def test_onboarding_is_open_from_the_form_stage_onward(stage):
    svc.assert_onboarding_unlocked(application(stage=stage))


# ------------------------------------------------------------------ submit --


def test_submit_is_refused_before_onboarding_unlocks():
    with pytest.raises(ConflictError, match="not open yet"):
        svc.submit(
            FakeSession(),
            application=application(stage=ApplicationStage.PHYSICAL_INTERVIEW),
            form_type=FT.BACKGROUND_VERIFICATION,
            submitted_data={"a": 1},
            actor=actor(),
        )


def test_submit_is_refused_out_of_order():
    with pytest.raises(ConflictError, match="Background Verification"):
        svc.submit(
            FakeSession(rows=[]),
            application=application(),
            form_type=FT.EMPLOYMENT_APPLICATION,
            submitted_data={"a": 1},
            actor=actor(),
        )


def test_submit_is_refused_when_already_submitted():
    existing = row(FT.BACKGROUND_VERIFICATION)
    with pytest.raises(ConflictError, match="already been submitted"):
        svc.submit(
            FakeSession(rows=[existing]),
            application=application(),
            form_type=FT.BACKGROUND_VERIFICATION,
            submitted_data={"a": 1},
            actor=actor(),
        )


def test_submit_succeeds_for_the_first_form():
    submission = svc.submit(
        FakeSession(rows=[]),
        application=application(),
        form_type=FT.BACKGROUND_VERIFICATION,
        submitted_data={"a": 1},
        actor=actor(),
    )
    assert submission.status == OnboardingFormStatus.SUBMITTED
    assert submission.submitted_data == {"a": 1}


def test_resubmitting_a_reopened_form_flips_it_back_to_submitted():
    existing = row(FT.BACKGROUND_VERIFICATION, OnboardingFormStatus.REOPENED)
    submission = svc.submit(
        FakeSession(rows=[existing]),
        application=application(),
        form_type=FT.BACKGROUND_VERIFICATION,
        submitted_data={"a": 2},
        actor=actor(),
    )
    assert submission is existing
    assert submission.status == OnboardingFormStatus.SUBMITTED
    assert submission.submitted_data == {"a": 2}


def test_submitting_bank_details_without_required_fields_is_refused():
    rows = [row(ft) for ft in (FT.BACKGROUND_VERIFICATION, FT.EMPLOYMENT_APPLICATION, FT.HALF_NAMA)]
    candidate = CandidateProfile(profile_id=uuid.uuid4(), date_of_birth=date(2000, 1, 1))
    with pytest.raises(ConflictError, match="iban"):
        svc.submit(
            FakeSession(rows=rows, candidate_profile=candidate),
            application=application(),
            form_type=FT.BANK_PAYMENT_DETAILS,
            submitted_data={"bank_name": "HBL"},
            actor=actor(),
        )


# ------------------------------------------------------------------ reopen --


def test_reopening_a_submitted_form_records_the_note():
    submission = row(FT.BACKGROUND_VERIFICATION)
    admin = Profile(id=uuid.uuid4(), email="a@example.com", role=UserRole.ADMIN)

    svc.reopen(FakeSession(), submission, application(), note="Fix your CNIC number.", actor=admin)

    assert submission.status == OnboardingFormStatus.REOPENED
    assert submission.reopen_note == "Fix your CNIC number."
    assert submission.reopened_at is not None
    assert submission.reopened_by == admin.id


def test_reopening_an_already_reopened_form_is_refused():
    submission = row(FT.BACKGROUND_VERIFICATION, OnboardingFormStatus.REOPENED)
    admin = Profile(id=uuid.uuid4(), email="a@example.com", role=UserRole.ADMIN)

    with pytest.raises(ConflictError, match="already reopened"):
        svc.reopen(FakeSession(), submission, application(), note=None, actor=admin)
