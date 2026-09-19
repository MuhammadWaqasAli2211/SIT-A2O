/**
 * Pakistani IBAN construction and validation.
 *
 * `PK` + 2 check digits + 4-letter bank code + 16-character account number,
 * 24 characters total (confirmed against the IBAN registry, ISO 13616).
 *
 * The check digits are not arbitrary: ISO 7064 MOD 97-10 defines them from
 * the rest of the IBAN, so once a bank and an account number are known the
 * two check digits are a computation, not something to leave blank or guess
 * at — this is what lets the candidate never type or see them at all.
 */

/** ISO 7064 MOD 97-10 check digits for a BBAN under a given country code. */
function checkDigits(countryCode: string, bban: string): string {
  // Rearrange to bban + country + "00", convert each letter to its two-digit
  // ordinal (A=10 ... Z=35), then take the whole numeral string mod 97 —
  // the standard IBAN check-digit algorithm, applied backwards to solve for
  // the digits that make the real IBAN valid.
  const rearranged = `${bban}${countryCode}00`
  const numeric = [...rearranged]
    .map((char) => {
      const code = char.toUpperCase().charCodeAt(0)
      return code >= 65 && code <= 90 ? String(code - 55) : char
    })
    .join('')

  // mod 97 on a string this long: reduce in chunks rather than via BigInt,
  // since every environment this runs in supports plain numbers this way.
  let remainder = 0
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }
  return String(98 - remainder).padStart(2, '0')
}

/**
 * Builds a complete, check-digit-correct Pakistani IBAN from a bank code
 * and an account number. The account number is padded to 16 characters
 * (Pakistani BBANs are fixed-width), left-padded with zeros the way an
 * account number shorter than the field would be on a bank statement.
 */
export function buildIban(bankCode: string, accountNumber: string): string {
  const digits = accountNumber.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  const bban = `${bankCode}${digits.padStart(16, '0')}`.slice(0, 20)
  return `PK${checkDigits('PK', bban)}${bban}`
}

/** Structural validation only: length, prefix, and that the check digits
 *  are actually consistent with the rest of the string — not that the
 *  account itself exists. */
export function isValidPakistaniIban(iban: string): boolean {
  const cleaned = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^PK\d{2}[A-Z]{4}[0-9A-Z]{16}$/.test(cleaned)) return false
  const bban = cleaned.slice(4)
  return checkDigits('PK', bban) === cleaned.slice(2, 4)
}

/** The 4-letter bank-code segment embedded in an IBAN, for confirming it
 *  matches whichever bank the candidate selected. */
export function bankCodeIn(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase().slice(4, 8)
}
