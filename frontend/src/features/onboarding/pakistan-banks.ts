/**
 * Pakistani banks, and each one's 4-letter IBAN identifier.
 *
 * A Pakistani IBAN is fixed: `PK` + 2 check digits + this 4-letter bank
 * code + 16 characters of account number — 24 characters total, confirmed
 * against the IBAN registry (ISO 13616). See `iban.ts` for the check-digit
 * arithmetic that uses this table.
 *
 * ** The `code` column below has NOT been independently verified against an
 * authoritative source (State Bank of Pakistan's own publication, or each
 * bank's own documentation) — every attempt to fetch one during this build
 * either 404'd or returned an unrelated page. These are compiled from
 * general knowledge and are believable, not confirmed. Before this is relied
 * on for anything that reaches a real payslip, check each code against the
 * relevant bank's own IBAN documentation or SBP's published list and correct
 * this table — it is the only place any of them appear. **
 */
export interface PakistaniBank {
  name: string
  /** The bank's 4-letter segment inside a Pakistani IBAN. Unverified — see
   *  the module doc above. */
  code: string
}

export const PAKISTANI_BANKS: readonly PakistaniBank[] = [
  { name: 'Habib Bank Limited (HBL)', code: 'HABB' },
  { name: 'United Bank Limited (UBL)', code: 'UNIL' },
  { name: 'MCB Bank', code: 'MUCB' },
  { name: 'Allied Bank', code: 'ABPA' },
  { name: 'Bank Alfalah', code: 'ALFH' },
  { name: 'Meezan Bank', code: 'MEZN' },
  { name: 'National Bank of Pakistan', code: 'NBPA' },
  { name: 'Standard Chartered Bank (Pakistan)', code: 'SCBL' },
  { name: 'Faysal Bank', code: 'FAYS' },
  { name: 'Askari Bank', code: 'ASCM' },
  { name: 'Bank Al Habib', code: 'BAHL' },
  { name: 'Soneri Bank', code: 'SONE' },
  { name: 'JS Bank', code: 'JSBL' },
  { name: 'Summit Bank', code: 'SUMB' },
  { name: 'Silk Bank', code: 'SAUD' },
  { name: 'The Bank of Punjab', code: 'BPUN' },
  { name: 'The Bank of Khyber', code: 'KHYB' },
  { name: 'Habib Metropolitan Bank', code: 'MPBL' },
  { name: 'Al Baraka Bank (Pakistan)', code: 'ALBR' },
  { name: 'Dubai Islamic Bank Pakistan', code: 'DUIB' },
  { name: 'Sindh Bank', code: 'SIND' },
  { name: 'Samba Bank', code: 'SAMB' },
  { name: 'MCB Islamic Bank', code: 'MCIB' },
  { name: 'U Microfinance Bank', code: 'UMBL' },
  { name: 'Telenor Microfinance Bank (Easypaisa)', code: 'TMFB' },
] as const
