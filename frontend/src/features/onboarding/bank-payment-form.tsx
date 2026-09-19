import { CheckCircle2, Send } from "lucide-react"
import * as React from "react"
import { PendingLabel } from '@/components/shared/pending-label'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildIban, bankCodeIn } from "@/features/onboarding/iban"
import { PAKISTANI_BANKS } from "@/features/onboarding/pakistan-banks"
import { useDraftAutosave } from "@/features/onboarding/use-draft-autosave"

/**
 * The 4th onboarding item. Unlike the other three, this is not a replica of
 * a paper form — it is simple structured data, so it is a plain native web
 * form: no print styling, no PDF, no `OnboardingToolbar` (whose Download
 * button would be meaningless here).
 *
 * Field names are snake_case to match what the backend validates
 * (onboarding_form_service.validate_bank_payment_data) and stores verbatim
 * as submitted_data — no camelCase/snake_case translation layer for a
 * 5-field object.
 */
export interface BankPaymentDraft {
  bank_name: string
  account_title: string
  iban: string
  wallet_provider: string
  wallet_number: string
}

const EMPTY_DRAFT: BankPaymentDraft = {
  bank_name: "",
  account_title: "",
  iban: "",
  wallet_provider: "",
  wallet_number: "",
}

const DRAFT_KEY = "sit.draft.bank-payment"

const INPUT_CLASS =
  "h-9 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"

export function BankPaymentForm({
  isAdultCandidate,
  initialData,
  readOnly = false,
  onSubmit,
  submitting = false,
}: {
  isAdultCandidate: boolean
  initialData?: Partial<BankPaymentDraft>
  readOnly?: boolean
  onSubmit?: (draft: BankPaymentDraft) => void
  submitting?: boolean
}) {
  const [draft, setDraft] = React.useState<BankPaymentDraft>(() => ({ ...EMPTY_DRAFT, ...initialData }))

  // The account number is the only thing the candidate actually types for
  // their IBAN — the bank code and check digits are derived, never entered.
  // Seeded from a stored IBAN so a draft restore or a reopened submission
  // shows the number back rather than an empty box next to a filled-in
  // bank. Only trusted when it actually starts with the selected bank's own
  // code: an IBAN saved under a different bank is not this field's number.
  const selectedBank = PAKISTANI_BANKS.find((bank) => bank.name === draft.bank_name)
  const [accountNumber, setAccountNumber] = React.useState(() => {
    if (!initialData?.iban || !selectedBank) return ''
    return bankCodeIn(initialData.iban) === selectedBank.code
      ? initialData.iban.replace(/\s+/g, '').slice(8).replace(/^0+(?=.)/, '')
      : ''
  })

  const { savedAt, clearDraft } = useDraftAutosave<BankPaymentDraft>({
    key: DRAFT_KEY,
    value: draft,
    onRestore: setDraft,
    disabled: readOnly,
  })

  const set = <K extends keyof BankPaymentDraft>(key: K, value: BankPaymentDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  function selectBank(bankName: string | null) {
    set('bank_name', bankName ?? '')
    const bank = PAKISTANI_BANKS.find((b) => b.name === bankName)
    set('iban', bank && accountNumber ? buildIban(bank.code, accountNumber) : '')
  }

  function setAccount(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 16)
    setAccountNumber(digits)
    set('iban', selectedBank && digits ? buildIban(selectedBank.code, digits) : '')
  }

  const missing = isAdultCandidate
    ? (["bank_name", "account_title", "iban"] as const).some((k) => !draft[k].trim())
    : (["wallet_provider", "wallet_number"] as const).some((k) => !draft[k].trim())

  const handleSubmit = () => {
    onSubmit?.(draft)
    clearDraft()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank &amp; Payment Details</CardTitle>
        <CardDescription>
          {isAdultCandidate
            ? "Where your salary will be paid — a bank account in your own name."
            : "As a minor, salary is paid via mobile wallet instead of a bank account."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <fieldset disabled={readOnly} className="flex flex-col gap-4">
          {isAdultCandidate ? (
            <>
              <Field id="bank_name" label="Bank Name" required>
                {readOnly ? (
                  <Input id="bank_name" value={draft.bank_name} disabled className={INPUT_CLASS} />
                ) : (
                  <Select value={draft.bank_name} onValueChange={selectBank}>
                    <SelectTrigger id="bank_name" className={INPUT_CLASS}>
                      <SelectValue placeholder="Select your bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAKISTANI_BANKS.map((bank) => (
                        <SelectItem key={bank.code} value={bank.name}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field id="account_title" label="Account Title" required>
                <Input
                  id="account_title"
                  value={draft.account_title}
                  onChange={(e) => set("account_title", e.target.value.toUpperCase())}
                  placeholder="Must match your CNIC name"
                  className={INPUT_CLASS}
                />
              </Field>
              {readOnly ? (
                <Field id="iban" label="IBAN" required>
                  <Input id="iban" value={draft.iban} disabled className={`${INPUT_CLASS} font-mono`} />
                </Field>
              ) : (
                <Field
                  id="account_number"
                  label="Account Number"
                  required
                  hint={!selectedBank ? 'Pick a bank first.' : undefined}
                >
                  <Input
                    id="account_number"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccount(e.target.value)}
                    disabled={!selectedBank}
                    placeholder="Your account number, digits only"
                    className={INPUT_CLASS}
                  />
                  {/* The IBAN itself — bank code and check digits included —
                      is derived, never typed. Shown so the candidate can see
                      and copy the real number they are submitting. */}
                  {draft.iban && (
                    <p className="mt-1.5 font-mono text-xs text-muted-foreground">{draft.iban}</p>
                  )}
                </Field>
              )}
            </>
          ) : (
            <>
              <Field id="wallet_provider" label="Wallet Provider" required>
                <Input
                  id="wallet_provider"
                  value={draft.wallet_provider}
                  onChange={(e) => set("wallet_provider", e.target.value)}
                  placeholder="Easypaisa or JazzCash"
                  className={INPUT_CLASS}
                />
              </Field>
              <Field id="wallet_number" label="Wallet Number" required>
                <Input
                  id="wallet_number"
                  value={draft.wallet_number}
                  onChange={(e) => set("wallet_number", e.target.value)}
                  placeholder="03XXXXXXXXX"
                  className={INPUT_CLASS}
                />
              </Field>
            </>
          )}
        </fieldset>

        {!readOnly && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              {savedAt !== null && (
                <span key={savedAt} className="flex items-center gap-1.5 animate-draft-saved">
                  <CheckCircle2 className="size-3.5 text-success" />
                  Draft saved
                </span>
              )}
            </span>
            {onSubmit && (
              <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting || missing}>
                <Send className="size-3.5" />
                <PendingLabel idle="Submit" pending="Submitting…" isPending={submitting} />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
