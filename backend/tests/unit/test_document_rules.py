"""Upload validation and review invariants.

Uploads are the one place untrusted bytes enter the system, so the guards are
tested directly rather than only through the route.
"""

import uuid

import pytest

from app.core.config import settings
from app.core.exceptions import ConflictError
from app.models.application import Application
from app.models.document import Document
from app.models.enums import DocumentStatus, DocumentType, UserRole
from app.models.user import Profile
from app.schemas.document import DocumentReview
from app.services import document_service


class FakeSession:
    """Enough Session for the guards, which all fail before any DB write."""

    def __init__(self, existing=None):
        self._existing = existing
        self.added = []
        self.deleted = []

    def scalar(self, _stmt):
        return self._existing

    def add(self, obj):
        self.added.append(obj)

    def delete(self, obj):
        self.deleted.append(obj)

    def flush(self):
        pass


@pytest.fixture
def actor():
    return Profile(id=uuid.uuid4(), email="c@example.com", role=UserRole.CANDIDATE)


@pytest.fixture
def application():
    return Application(id=uuid.uuid4(), candidate_code="B07-001")


def upload(session, application, actor, **overrides):
    kwargs = {
        "doc_type": DocumentType.CNIC_FRONT,
        "file_name": "cnic.pdf",
        "content_type": "application/pdf",
        "content": b"%PDF-1.4 fake",
    }
    kwargs.update(overrides)
    return document_service.upload(
        session, application=application, actor=actor, **kwargs
    )


# ------------------------------------------------------------- validation --


@pytest.mark.parametrize(
    "content_type",
    ["application/x-msdownload", "text/html", "application/zip", "image/svg+xml"],
)
def test_disallowed_content_types_are_refused(content_type, application, actor):
    """An upload field that accepts anything eventually accepts an executable.

    SVG is in this list on purpose: it is an image that can carry script.
    """
    with pytest.raises(ConflictError, match="PDF, JPG, PNG"):
        upload(FakeSession(), application, actor, content_type=content_type)


@pytest.mark.parametrize(
    "content_type", ["application/pdf", "image/jpeg", "image/png", "image/webp"]
)
def test_allowed_content_types_pass_validation(content_type):
    assert content_type in document_service.ALLOWED_CONTENT_TYPES


def test_empty_file_is_refused(application, actor):
    with pytest.raises(ConflictError, match="empty"):
        upload(FakeSession(), application, actor, content=b"")


def test_oversized_file_is_refused(application, actor):
    too_big = b"x" * (settings.DOCUMENT_MAX_BYTES + 1)
    with pytest.raises(ConflictError, match="MB or smaller"):
        upload(FakeSession(), application, actor, content=too_big)


def test_a_file_exactly_on_the_limit_is_accepted(application, actor, monkeypatch):
    """Boundary: the limit is inclusive, so `>` and `>=` are not interchangeable."""
    written = {}
    monkeypatch.setattr(
        document_service.supabase_storage,
        "upload",
        lambda path, content, ct: written.update(path=path, size=len(content)),
    )

    upload(
        FakeSession(),
        application,
        actor,
        content=b"x" * settings.DOCUMENT_MAX_BYTES,
    )
    assert written["size"] == settings.DOCUMENT_MAX_BYTES


def test_replacing_an_accepted_document_is_refused(application, actor):
    accepted = Document(
        id=uuid.uuid4(),
        doc_type=DocumentType.CNIC_FRONT,
        status=DocumentStatus.ACCEPTED,
        storage_path="old/path.pdf",
    )
    with pytest.raises(ConflictError, match="already been accepted"):
        upload(FakeSession(existing=accepted), application, actor)


def test_nothing_reaches_storage_when_validation_fails(application, actor, monkeypatch):
    """A rejected file must never be written, or it is orphaned there."""
    calls = []
    monkeypatch.setattr(
        document_service.supabase_storage,
        "upload",
        lambda *a, **k: calls.append(a),
    )

    with pytest.raises(ConflictError):
        upload(FakeSession(), application, actor, content_type="text/html")

    assert calls == []


# ----------------------------------------------------------------- review --


def _document(status=DocumentStatus.PENDING):
    return Document(
        id=uuid.uuid4(),
        doc_type=DocumentType.CNIC_FRONT,
        status=status,
        storage_path="p.pdf",
    )


def test_rejection_requires_a_reason():
    """The candidate has to learn what to re-upload."""
    admin = Profile(id=uuid.uuid4(), email="a@example.com", role=UserRole.ADMIN)

    with pytest.raises(ConflictError, match="what is wrong"):
        document_service.review(
            FakeSession(),
            _document(),
            DocumentReview(status=DocumentStatus.REJECTED),
            admin,
            "B07-001",
        )


def test_rejection_with_a_reason_is_recorded():
    admin = Profile(id=uuid.uuid4(), email="a@example.com", role=UserRole.ADMIN)
    session = FakeSession()
    document = _document()

    document_service.review(
        session,
        document,
        DocumentReview(status=DocumentStatus.REJECTED, review_note="Blurred."),
        admin,
        "B07-001",
    )

    assert document.status == DocumentStatus.REJECTED
    assert document.review_note == "Blurred."
    assert document.reviewed_at is not None


def test_accepting_clears_a_previous_rejection_note():
    """A stale 'blurred' note on an accepted document would be nonsense."""
    admin = Profile(id=uuid.uuid4(), email="a@example.com", role=UserRole.ADMIN)
    document = _document(DocumentStatus.REJECTED)
    document.review_note = "Blurred."

    document_service.review(
        FakeSession(),
        document,
        DocumentReview(status=DocumentStatus.ACCEPTED),
        admin,
        "B07-001",
    )

    assert document.status == DocumentStatus.ACCEPTED
    assert document.review_note is None


def test_reviewing_to_the_same_status_is_refused():
    admin = Profile(id=uuid.uuid4(), email="a@example.com", role=UserRole.ADMIN)

    with pytest.raises(ConflictError, match="already"):
        document_service.review(
            FakeSession(),
            _document(DocumentStatus.ACCEPTED),
            DocumentReview(status=DocumentStatus.ACCEPTED),
            admin,
            "B07-001",
        )


def test_accepted_documents_cannot_be_deleted():
    actor = Profile(id=uuid.uuid4(), email="c@example.com", role=UserRole.CANDIDATE)

    with pytest.raises(ConflictError, match="cannot be removed"):
        document_service.delete(
            FakeSession(), _document(DocumentStatus.ACCEPTED), actor, "B07-001"
        )


# -------------------------------------------------------------- checklist --


def test_required_set_covers_the_onboarding_documents():
    types = {doc_type for doc_type, _, _ in document_service.REQUIRED_DOCUMENTS}
    assert DocumentType.CNIC_FRONT in types
    assert DocumentType.CNIC_BACK in types
    # OTHER is a catch-all an admin requests ad hoc, never part of the standard set.
    assert DocumentType.OTHER not in types
