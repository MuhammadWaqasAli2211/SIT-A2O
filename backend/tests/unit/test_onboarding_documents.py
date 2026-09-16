"""Documents Hub: age-conditional required set and multi-file uploads.

The multi-file behaviour is the one real difference from document_service's
established rules — EDUCATIONAL_CERT and EXPERIENCE_LETTER must accumulate
files rather than replace them, so that split is what gets exercised here
alongside the reused validation and gating.
"""

import uuid
from datetime import UTC, datetime

import pytest

from app.core.exceptions import ConflictError
from app.models.application import Application
from app.models.bootcamp import BootcampPhase
from app.models.enums import DocumentStatus, OnboardingDocumentType, PhaseType, UserRole
from app.models.onboarding import OnboardingDocument
from app.models.user import Profile
from app.services import onboarding_document_service as svc
from app.services.bootcamp_service import PhaseClosedError

DT = OnboardingDocumentType


def form_phase(**kwargs) -> BootcampPhase:
    """The FORM phase as `create` leaves it — flag false, never touched, and
    so not a gate. See `phase_closure`."""
    defaults = {
        "phase": PhaseType.FORM,
        "is_open": False,
        "opens_at": None,
        "deadline_at": None,
        "closed_at": None,
    }
    return BootcampPhase(**{**defaults, **kwargs})


class FakeSession:
    def __init__(self, existing=None, phase=None, count=None):
        self._existing = existing
        self._count = count
        self._phase = phase if phase is not None else form_phase()
        self.added = []
        self.deleted = []

    def scalar(self, stmt):
        # `get_phase`, the multi-file count, and upload()'s own supersede
        # lookup all land here, so tell them apart by what the statement
        # selects rather than by order.
        entity = stmt.column_descriptions[0]["entity"]
        if entity is BootcampPhase:
            return self._phase
        # A count selects a function, not an entity, so it has none. One
        # stored document stands for one file of that type.
        if entity is None:
            if self._count is not None:
                return self._count
            return 1 if self._existing is not None else 0
        return self._existing

    def scalars(self, _stmt):
        # Only ever consulted by assert_hub_unlocked's rows_for_application
        # lookup here; hub_unlocked itself is monkeypatched per-test.
        return []

    def add(self, obj):
        self.added.append(obj)

    def delete(self, obj):
        self.deleted.append(obj)

    def flush(self):
        pass


def application():
    return Application(id=uuid.uuid4(), candidate_code="B08-001")


def actor():
    return Profile(id=uuid.uuid4(), email="c@example.com", role=UserRole.CANDIDATE)


def upload(session, **overrides):
    kwargs = {
        "application": application(),
        "doc_type": DT.CV,
        "file_name": "cv.pdf",
        "content_type": "application/pdf",
        "content": b"%PDF-1.4 fake",
        "actor": actor(),
    }
    kwargs.update(overrides)
    return svc.upload(session, **kwargs)


# --------------------------------------------------- required document set --


def test_an_adult_is_asked_for_a_cnic_and_bank_proof():
    required = svc.required_documents(is_adult_candidate=True)
    types = {doc_type for doc_type, *_ in required}
    assert DT.PERSONAL_ID_CNIC in types
    assert DT.BANK_PROOF in types
    assert DT.PERSONAL_ID_BFORM not in types
    assert DT.EASYPAISA_PROOF not in types


def test_a_minor_is_asked_for_a_bform_and_easypaisa_proof():
    required = svc.required_documents(is_adult_candidate=False)
    types = {doc_type for doc_type, *_ in required}
    assert DT.PERSONAL_ID_BFORM in types
    assert DT.EASYPAISA_PROOF in types
    assert DT.PERSONAL_ID_CNIC not in types
    assert DT.BANK_PROOF not in types


def test_educational_documents_and_experience_letters_are_flagged_multi():
    required = {doc_type: multi for doc_type, _label, _required, multi in svc.required_documents(is_adult_candidate=True)}
    assert required[DT.EDUCATIONAL_CERT] is True
    assert required[DT.EXPERIENCE_LETTER] is True


def test_every_other_type_is_single_file():
    required = {doc_type: multi for doc_type, _label, _required, multi in svc.required_documents(is_adult_candidate=True)}
    for doc_type in (DT.PERSONAL_ID_CNIC, DT.FATHER_CNIC, DT.MOTHER_CNIC, DT.CV, DT.BANK_PROOF):
        assert required[doc_type] is False


def test_experience_letters_are_the_only_optional_row():
    required = {doc_type: is_required for doc_type, _label, is_required, _multi in svc.required_documents(is_adult_candidate=True)}
    assert required[DT.EXPERIENCE_LETTER] is False
    assert all(is_required for dt, is_required in required.items() if dt != DT.EXPERIENCE_LETTER)


# ------------------------------------------------------------------ upload --


@pytest.mark.parametrize("content_type", ["application/x-msdownload", "text/html", "image/svg+xml"])
def test_disallowed_content_types_are_refused(content_type, monkeypatch):
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    with pytest.raises(ConflictError, match="PDF, JPG, PNG"):
        upload(FakeSession(), content_type=content_type)


def test_a_second_educational_certificate_does_not_replace_the_first(monkeypatch):
    """The one real behavioural difference from document_service: multi-file
    types must never delete an existing row on a fresh upload."""
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    monkeypatch.setattr(svc.supabase_storage, "upload", lambda *a, **k: None)

    existing = OnboardingDocument(
        id=uuid.uuid4(), doc_type=DT.EDUCATIONAL_CERT, status=DocumentStatus.PENDING,
        storage_path="onboarding/x/old.pdf",
    )
    session = FakeSession(existing=existing)
    upload(session, doc_type=DT.EDUCATIONAL_CERT)

    assert session.deleted == []


def test_an_eleventh_file_of_one_type_is_refused(monkeypatch):
    """The cap is the server's, not the "+ Add" button's.

    A candidate who never sees the frontend — or who keeps a stale tab open
    after deleting nothing — still cannot put an unbounded number of files
    behind one tab, which is what bounds the size of a bulk export.
    """
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    reached_storage = []
    monkeypatch.setattr(svc.supabase_storage, "upload", lambda *a, **k: reached_storage.append(a))

    session = FakeSession(count=svc.MAX_FILES_PER_TYPE)
    with pytest.raises(ConflictError, match=f"at most {svc.MAX_FILES_PER_TYPE} files"):
        upload(session, doc_type=DT.EDUCATIONAL_CERT)

    # Refused before the bytes go anywhere, so a rejected upload costs no
    # storage and leaves nothing to clean up.
    assert reached_storage == []
    assert [o for o in session.added if isinstance(o, OnboardingDocument)] == []


def test_the_cap_leaves_the_last_slot_usable(monkeypatch):
    """One below the cap must still work, or the check is off by one."""
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    monkeypatch.setattr(svc.supabase_storage, "upload", lambda *a, **k: None)

    session = FakeSession(count=svc.MAX_FILES_PER_TYPE - 1)
    upload(session, doc_type=DT.EDUCATIONAL_CERT)

    stored = [o for o in session.added if isinstance(o, OnboardingDocument)]
    assert len(stored) == 1


def test_single_file_types_are_not_subject_to_the_cap(monkeypatch):
    """The count query only runs for multi-file types; a single-slot type is
    governed by supersede-on-reupload instead."""
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    monkeypatch.setattr(svc.supabase_storage, "upload", lambda *a, **k: None)

    session = FakeSession(count=svc.MAX_FILES_PER_TYPE)
    upload(session, doc_type=DT.CV)

    stored = [o for o in session.added if isinstance(o, OnboardingDocument)]
    assert len(stored) == 1


def test_a_second_cv_upload_supersedes_the_first(monkeypatch):
    """Single-file types keep document_service's replace-on-reupload rule."""
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    monkeypatch.setattr(svc.supabase_storage, "upload", lambda *a, **k: None)
    monkeypatch.setattr(svc.supabase_storage, "delete", lambda *a, **k: None)

    existing = OnboardingDocument(
        id=uuid.uuid4(), doc_type=DT.CV, status=DocumentStatus.PENDING,
        storage_path="onboarding/x/old.pdf",
    )
    session = FakeSession(existing=existing)
    upload(session, doc_type=DT.CV)

    assert existing in session.deleted


def test_upload_is_refused_once_an_admin_closes_the_form_phase(monkeypatch):
    """The Documents Hub is the back half of the Student's Folder, so the same
    close that stops form submissions stops uploads — leaving one half live
    was the state this gate replaced."""
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    closed = form_phase(closed_at=datetime(2026, 9, 1, tzinfo=UTC))
    with pytest.raises(PhaseClosedError, match="has been closed"):
        upload(FakeSession(phase=closed), doc_type=DT.CV)


def test_upload_is_refused_once_the_deadline_has_passed(monkeypatch):
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    lapsed = form_phase(is_open=True, deadline_at=datetime(2020, 1, 1, tzinfo=UTC))
    with pytest.raises(PhaseClosedError, match="deadline"):
        upload(FakeSession(phase=lapsed), doc_type=DT.CV)


def test_replacing_an_accepted_single_file_document_is_refused(monkeypatch):
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: True)
    accepted = OnboardingDocument(
        id=uuid.uuid4(), doc_type=DT.CV, status=DocumentStatus.ACCEPTED, storage_path="p.pdf"
    )
    with pytest.raises(ConflictError, match="already been accepted"):
        upload(FakeSession(existing=accepted), doc_type=DT.CV)


def test_upload_is_refused_before_the_hub_unlocks(monkeypatch):
    monkeypatch.setattr(svc.onboarding_form_service, "hub_unlocked", lambda rows: False)
    with pytest.raises(ConflictError, match="Complete all 4"):
        upload(FakeSession())


# ------------------------------------------------------------------ review --


def test_rejecting_a_document_requires_a_reason():
    document = OnboardingDocument(
        id=uuid.uuid4(), doc_type=DT.CV, status=DocumentStatus.PENDING, storage_path="p.pdf"
    )
    admin = Profile(id=uuid.uuid4(), email="a@example.com", role=UserRole.ADMIN)

    with pytest.raises(ConflictError, match="what is wrong"):
        svc.review(
            FakeSession(), document, status=DocumentStatus.REJECTED, review_note=None,
            actor=admin, candidate_code="B08-001",
        )


def test_accepted_documents_cannot_be_deleted():
    document = OnboardingDocument(
        id=uuid.uuid4(), doc_type=DT.CV, status=DocumentStatus.ACCEPTED, storage_path="p.pdf"
    )
    with pytest.raises(ConflictError, match="cannot be removed"):
        svc.delete(FakeSession(), document, actor(), "B08-001")
