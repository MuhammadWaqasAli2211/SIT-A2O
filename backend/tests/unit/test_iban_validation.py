"""Pakistani IBAN validation: structure and the MOD 97-10 checksum.

Two well-known real-world IBANs (not Pakistani ones — the check-digit
arithmetic is country-agnostic) pin the algorithm itself against published
correct values, so a mistake in the arithmetic is caught even though no
IBAN this project ever builds uses those countries.
"""

import pytest

from app.core.exceptions import ConflictError
from app.services.onboarding_form_service import _iban_check_digits_valid, _validate_iban


def _pk_iban(bank_code: str, account: str) -> str:
    bban = f"{bank_code}{account.rjust(16, '0')}"
    rearranged = f"{bban}PK00"
    numeric = "".join(str(ord(c) - 55) if c.isalpha() else c for c in rearranged)
    remainder = 0
    for digit in numeric:
        remainder = (remainder * 10 + int(digit)) % 97
    return f"PK{98 - remainder:02d}{bban}"


def test_the_checksum_matches_a_published_real_iban():
    """GB82 WEST 1234 5698 7654 32 is a standard published example — proof
    the arithmetic itself is the real ISO 7064 MOD 97-10 rule, not a
    plausible-looking approximation of it."""
    assert _iban_check_digits_valid("GB82WEST12345698765432") is True
    assert _iban_check_digits_valid("DE89370400440532013000") is True


def test_a_freshly_built_pakistani_iban_validates():
    iban = _pk_iban("HABB", "1234567890")
    _validate_iban(iban)  # must not raise


def test_a_hand_edited_iban_is_refused():
    iban = _pk_iban("HABB", "1234567890")
    tampered = iban[:-1] + ("1" if iban[-1] != "1" else "2")
    with pytest.raises(ConflictError, match="edited by hand"):
        _validate_iban(tampered)


@pytest.mark.parametrize(
    "bad",
    [
        "GB82WEST12345698765432",  # right shape, wrong country
        "PK00HABB0000000000000000",  # placeholder check digits
        "PK23HABB00000000000000",  # one character short
    ],
)
def test_malformed_or_wrong_shape_ibans_are_refused(bad):
    with pytest.raises(ConflictError):
        _validate_iban(bad)


def test_lowercase_input_is_normalised_not_rejected():
    """IBANs are case-insensitive by spec — a candidate pasting one in
    lowercase should not be told it's invalid for that reason alone."""
    iban = _pk_iban("HABB", "1234567890")
    _validate_iban(iban.lower())  # must not raise


def test_bank_payment_validation_checks_the_iban_for_adults_only():
    """A minor's row has no IBAN at all — validate_bank_payment_data must not
    apply bank-shaped rules to a wallet submission."""
    from app.services.onboarding_form_service import validate_bank_payment_data

    validate_bank_payment_data(
        {"wallet_provider": "Easypaisa", "wallet_number": "03001234567"}, is_adult=False
    )


def test_bank_payment_validation_refuses_a_bad_iban_for_an_adult():
    from app.services.onboarding_form_service import validate_bank_payment_data

    with pytest.raises(ConflictError):
        validate_bank_payment_data(
            {"bank_name": "HBL", "account_title": "A B", "iban": "PK00HABB0000000000000000"},
            is_adult=True,
        )
