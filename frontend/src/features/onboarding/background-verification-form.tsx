import { Upload } from "lucide-react"
import * as React from "react"

import saylaniLogo from "@/assets/saylani_full_logo.png"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  BilingualLabel,
  FieldCell,
  FieldRow,
  onboardingRadioClass,
  OnboardingToolbar,
  SectionBar,
  TEXT_INPUT_CLASS,
  TEXT_INPUT_UPPERCASE_CLASS,
  YesNoGroup,
} from "@/features/onboarding/form-primitives"
import { SegmentedDigitInput } from "@/features/onboarding/segmented-digit-input"
import { SignaturePad } from "@/features/onboarding/signature-pad"
import { useDraftAutosave } from "@/features/onboarding/use-draft-autosave"

type Sect = "Sunni" | "Shia" | "Others"

export interface BackgroundVerificationDraft {
  photo: string | null
  fullName: string
  cnic: string
  cnicExpiry: string
  fatherName: string
  fatherCnic: string
  fatherAlive: boolean | null
  motherName: string
  motherCnic: string
  motherAlive: boolean | null
  dateOfBirth: string
  sect: Sect | null
  bloodGroup: string
  motherTongue: string
  presentAddress: string
  postalAddress: string
  mobileNumber: string
  emergencyNumber: string
  chronicDisease: boolean | null
  policeCase: boolean | null
  anyAddiction: boolean | null
  orgProvince: string
  zone: string
  kabina: string
  division: string
  halqa: string
  nearestMasjid: string
  ackSignature: string | null
  ackDate: string
  imamName: string
  imamCnic: string
  imamMasjidName: string
  imamMobile: string
  imamSignature: string | null
  otherName: string
  otherCnic: string
  otherAddress: string
  otherMobile: string
  otherSignature: string | null
}

const EMPTY_DRAFT: BackgroundVerificationDraft = {
  photo: null,
  fullName: "",
  cnic: "",
  cnicExpiry: "",
  fatherName: "",
  fatherCnic: "",
  fatherAlive: null,
  motherName: "",
  motherCnic: "",
  motherAlive: null,
  dateOfBirth: "",
  sect: null,
  bloodGroup: "",
  motherTongue: "",
  presentAddress: "",
  postalAddress: "",
  mobileNumber: "",
  emergencyNumber: "",
  chronicDisease: null,
  policeCase: null,
  anyAddiction: null,
  orgProvince: "",
  zone: "",
  kabina: "",
  division: "",
  halqa: "",
  nearestMasjid: "",
  ackSignature: null,
  ackDate: "",
  imamName: "",
  imamCnic: "",
  imamMasjidName: "",
  imamMobile: "",
  imamSignature: null,
  otherName: "",
  otherCnic: "",
  otherAddress: "",
  otherMobile: "",
  otherSignature: null,
}

const DRAFT_KEY = "sit.draft.background-verification"

/**
 * Digital twin of Saylani's "Background Verification Form" (SWIT-IHR-FAF-11).
 * One page, matching the source: no wizard, no steps.
 *
 * Three modes, driven entirely by which props are passed: the admin preview
 * route uses none of them (blank, editable, unsubmittable — the original
 * behaviour, untouched); the candidate's first pass or a reopened correction
 * passes `initialData/onSubmit` (editable, seeded, submittable); an
 * already-submitted view passes `readOnly` too (nothing editable, PDF only).
 */
export function BackgroundVerificationForm({
  initialData,
  readOnly = false,
  onSubmit,
  submitting = false,
}: {
  initialData?: Partial<BackgroundVerificationDraft>
  readOnly?: boolean
  onSubmit?: (draft: BackgroundVerificationDraft) => void
  submitting?: boolean
} = {}) {
  const [draft, setDraft] = React.useState<BackgroundVerificationDraft>(() => ({ ...EMPTY_DRAFT, ...initialData }))

  const { savedAt, clearDraft } = useDraftAutosave<BackgroundVerificationDraft>({
    key: DRAFT_KEY,
    value: draft,
    onRestore: setDraft,
    disabled: readOnly,
  })

  const set = <K extends keyof BackgroundVerificationDraft>(key: K, value: BackgroundVerificationDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set("photo", reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleClear = () => {
    setDraft(EMPTY_DRAFT)
    clearDraft()
  }

  const handleSubmit = () => {
    onSubmit?.(draft)
    clearDraft()
  }

  return (
    <div className="flex flex-col gap-3">
      <OnboardingToolbar
        savedAt={savedAt}
        onClear={handleClear}
        onSubmit={onSubmit && handleSubmit}
        submitting={submitting}
        readOnly={readOnly}
      />

      <fieldset disabled={readOnly} className="contents">
      <div className="print-a4-bg-verification mx-auto w-full max-w-6xl border-2 border-black bg-white font-serif text-black print:max-w-none print:border-0">
        {/* ------------------------------------------------------- masthead -- */}
        <div className="flex items-center justify-between border-b-2 border-black px-3 py-1 text-[11px] text-neutral-600">
          <span>Ref: SWIT-IHR-FAF-11</span>
          <span>Rev.0, 09-06-2021</span>
        </div>

        <div className="flex flex-col items-center gap-1 border-b-2 border-black px-4 py-3">
          <img src={saylaniLogo} alt="Saylani Welfare International Trust" className="h-14 w-auto object-contain" />
          <h1 className="text-lg font-bold tracking-wide">BACKGROUND VERIFICATION FORM</h1>
          <p dir="rtl" lang="ur" className="font-urdu text-xl">
            تصدیق نامہ
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black px-4 py-3">
          <p className="flex flex-1 flex-wrap sm:flex-nowrap items-baseline gap-x-1.5 text-xs">
            <span className="font-semibold">Personal information should be in Capital Letters.</span>
            <span className="text-neutral-400">/</span>
            <span dir="rtl" lang="ur" className="font-urdu text-sm">
              ذاتی معلومات بڑے الفاظ میں تحریر فرمائیں۔
            </span>
          </p>

          {/* Photo upload — top-right, matching the source form's placeholder. */}
          <label className="flex h-28 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border border-black/70 text-center text-[10px] text-neutral-500 hover:bg-neutral-50 print:cursor-default">
            {draft.photo ? (
              <img src={draft.photo} alt="Candidate" className="h-full w-full object-cover" />
            ) : (
              <>
                <Upload className="size-4 print:hidden" />
                <span className="print:hidden">Photo</span>
                <span dir="rtl" lang="ur" className="font-urdu print:hidden">
                  تصویر
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              className="hidden print:hidden"
            />
          </label>
        </div>

        {/* -------------------------------------------------- personal info -- */}
        <SectionBar en="Personal Information" ur="ذاتی معلومات" />

        <FieldRow en="Name" ur="نام" htmlFor="fullName">
          <Input
            id="fullName"
            value={draft.fullName}
            onChange={(e) => set("fullName", e.target.value.toUpperCase())}
            placeholder="According to Matriculation Certificate"
            className={TEXT_INPUT_UPPERCASE_CLASS}
          />
        </FieldRow>

        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr]">
          <FieldCell className="flex-[2] flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="CNIC #" ur="شناختی کارڈ نمبر" />
            <SegmentedDigitInput
              groups={[5, 7, 1]}
              value={draft.cnic}
              onChange={(v) => set("cnic", v)}
              ariaLabel="Applicant CNIC number"
            />
          </FieldCell>
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="Expiry" ur="تاریخ تنسیخ" />
            <SegmentedDigitInput
              groups={[2, 2, 4]}
              value={draft.cnicExpiry}
              onChange={(v) => set("cnicExpiry", v)}
              ariaLabel="CNIC expiry date, day month year"
            />
          </FieldCell>
        </div>

        <FieldRow en="Father's Name" ur="والد کا نام" htmlFor="fatherName">
          <Input
            id="fatherName"
            value={draft.fatherName}
            onChange={(e) => set("fatherName", e.target.value.toUpperCase())}
            className={TEXT_INPUT_UPPERCASE_CLASS}
          />
        </FieldRow>

        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr]">
          <FieldCell className="flex-[2] flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="CNIC #" ur="شناختی کارڈ نمبر" />
            <SegmentedDigitInput
              groups={[5, 7, 1]}
              value={draft.fatherCnic}
              onChange={(v) => set("fatherCnic", v)}
              ariaLabel="Father's CNIC number"
            />
          </FieldCell>
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Alive" ur="حیات" />
            <YesNoGroup
              shape="square"
              ariaLabel="Is father alive"
              value={draft.fatherAlive}
              onChange={(v) => set("fatherAlive", v)}
            />
          </FieldCell>
        </div>

        <FieldRow en="Mother's Name" ur="والدہ کا نام" htmlFor="motherName">
          <Input
            id="motherName"
            value={draft.motherName}
            onChange={(e) => set("motherName", e.target.value.toUpperCase())}
            className={TEXT_INPUT_UPPERCASE_CLASS}
          />
        </FieldRow>

        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr]">
          <FieldCell className="flex-[2] flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="CNIC #" ur="شناختی کارڈ نمبر" />
            <SegmentedDigitInput
              groups={[5, 7, 1]}
              value={draft.motherCnic}
              onChange={(v) => set("motherCnic", v)}
              ariaLabel="Mother's CNIC number"
            />
          </FieldCell>
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Alive" ur="حیات" />
            <YesNoGroup
              shape="square"
              ariaLabel="Is mother alive"
              value={draft.motherAlive}
              onChange={(v) => set("motherAlive", v)}
            />
          </FieldCell>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr]">
          <FieldCell className="flex-[2] flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="Date of Birth" ur="تاریخ پیدائش" />
            <SegmentedDigitInput
              groups={[2, 2, 4]}
              value={draft.dateOfBirth}
              onChange={(v) => set("dateOfBirth", v)}
              ariaLabel="Date of birth, day month year"
            />
          </FieldCell>
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Sect" ur="مسلک" />
            <RadioGroup
              aria-label="Sect"
              value={draft.sect ?? undefined}
              onValueChange={(v) => set("sect", v as Sect)}
              className="flex-wrap gap-4"
            >
              {(["Sunni", "Shia", "Others"] as const).map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 text-sm select-none"
                >
                  <RadioGroupItem value={option} shape="square" className={onboardingRadioClass} />
                  {option}
                </label>
              ))}
            </RadioGroup>
          </FieldCell>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldRow en="Blood Group" ur="خون کا گروہ" htmlFor="bloodGroup" className="flex-1">
            <Input
              id="bloodGroup"
              value={draft.bloodGroup}
              onChange={(e) => set("bloodGroup", e.target.value.toUpperCase())}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow en="Mother Tongue" ur="مادری زبان" htmlFor="motherTongue" className="flex-1">
            <Input
              id="motherTongue"
              value={draft.motherTongue}
              onChange={(e) => set("motherTongue", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
        </div>

        <FieldRow en="Present Address" ur="موجودہ پتہ" htmlFor="presentAddress">
          <Input
            id="presentAddress"
            value={draft.presentAddress}
            onChange={(e) => set("presentAddress", e.target.value)}
            className={TEXT_INPUT_CLASS}
          />
        </FieldRow>

        <FieldRow en="Postal Address" ur="ڈاک کا پتہ" htmlFor="postalAddress">
          <Input
            id="postalAddress"
            value={draft.postalAddress}
            onChange={(e) => set("postalAddress", e.target.value)}
            className={TEXT_INPUT_CLASS}
          />
        </FieldRow>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="Mobile #" ur="موبائل نمبر" />
            <span className="text-[10px] text-neutral-400">(Personal Number)</span>
            <SegmentedDigitInput
              groups={[4, 7]}
              value={draft.mobileNumber}
              onChange={(v) => set("mobileNumber", v)}
              ariaLabel="Mobile number, personal"
            />
          </FieldCell>
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="Emergency #" ur="ہنگامی نمبر" />
            <span className="text-[10px] text-neutral-400">(Emergency Number)</span>
            <SegmentedDigitInput
              groups={[4, 7]}
              value={draft.emergencyNumber}
              onChange={(v) => set("emergencyNumber", v)}
              ariaLabel="Mobile number, emergency"
            />
          </FieldCell>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3">
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Chronic disease" ur="دائمی مرض" />
            <YesNoGroup
              ariaLabel="Any chronic disease"
              value={draft.chronicDisease}
              onChange={(v) => set("chronicDisease", v)}
            />
          </FieldCell>
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Police Case" ur="پولیس کیس" />
            <YesNoGroup
              ariaLabel="Any police case"
              value={draft.policeCase}
              onChange={(v) => set("policeCase", v)}
            />
          </FieldCell>
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Any Addiction" ur="کوئی نشہ وغیرہ" />
            <YesNoGroup
              ariaLabel="Any addiction"
              value={draft.anyAddiction}
              onChange={(v) => set("anyAddiction", v)}
            />
          </FieldCell>
        </div>

        {/* --------------------------------------------- organizational info -- */}
        <SectionBar en="Organizational Information" ur="تنظیمی معلومات" />

        <div className="grid grid-cols-1 sm:grid-cols-3">
          {(
            [
              ["orgProvince", "Organizational Province", "تنظیمی صوبہ"],
              ["zone", "Zone", "زون"],
              ["kabina", "Kabina", "کابینہ"],
            ] as const
          ).map(([key, en, ur]) => (
            <FieldRow key={key} en={en} ur={ur} htmlFor={key} className="flex-1">
              <Input
                id={key}
                value={draft[key]}
                onChange={(e) => set(key, e.target.value)}
                className={TEXT_INPUT_CLASS}
              />
            </FieldRow>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3">
          {(
            [
              ["division", "Division", "ڈویژن"],
              ["halqa", "Halqa", "حلقہ"],
              ["nearestMasjid", "Nearest Masjid", "قریبی مسجد"],
            ] as const
          ).map(([key, en, ur]) => (
            <FieldRow key={key} en={en} ur={ur} htmlFor={key} className="flex-1">
              <Input
                id={key}
                value={draft[key]}
                onChange={(e) => set(key, e.target.value)}
                className={TEXT_INPUT_CLASS}
              />
            </FieldRow>
          ))}
        </div>

        {/* ----------------------------------------------------- acknowledgment -- */}
        <SectionBar en="Acknowledgment" ur="اعتراف نامہ" />

        <div className="border-b border-black/70 px-3 py-2.5 text-center text-[13px] italic">
          <p>By signing below, I hereby admit that the information I have provided above, is accurate.</p>
          <p dir="rtl" lang="ur" className="font-urdu text-base not-italic">
            میں اس بات کا اقرار کرتا ہوں کہ اوپر دی گئی معلومات درست ہیں۔
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr]">
          <FieldCell className="flex-[2] flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Signature" ur="دستخط" />
            <SignaturePad
              ariaLabel="Applicant signature"
              value={draft.ackSignature}
              onChange={(v) => set("ackSignature", v)}
              disabled={readOnly}
            />
          </FieldCell>
          <FieldRow en="Date" ur="تاریخ" htmlFor="ackDate" className="flex-1">
            <Input
              id="ackDate"
              value={draft.ackDate}
              onChange={(e) => set("ackDate", e.target.value)}
              placeholder="DD-MM-YYYY"
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
        </div>

        {/* -------------------------------------------------------- references -- */}
        <SectionBar en="References" ur="معرفت" />

        <div className="grid grid-cols-1 sm:grid-cols-2">
          {/* Imam Masjid */}
          <div className="flex flex-col border-black/70 sm:border-r-2">
            <div className="border-b border-black/70 py-1.5 text-center text-[13px] font-semibold">
              Imam Masjid <span className="text-neutral-400">/</span>{" "}
              <span dir="rtl" lang="ur" className="font-urdu font-normal">
                امام مسجد
              </span>
            </div>
            <FieldRow en="Name" ur="نام" htmlFor="imamName">
              <Input
                id="imamName"
                value={draft.imamName}
                onChange={(e) => set("imamName", e.target.value.toUpperCase())}
                className={TEXT_INPUT_UPPERCASE_CLASS}
              />
            </FieldRow>
            <FieldCell className="flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
              <BilingualLabel en="CNIC #" ur="شناختی کارڈ نمبر" />
              <SegmentedDigitInput
                groups={[5, 7, 1]}
                value={draft.imamCnic}
                onChange={(v) => set("imamCnic", v)}
                ariaLabel="Imam Masjid CNIC number"
              />
            </FieldCell>
            <FieldRow en="Masjid Name" ur="مسجد کا نام" htmlFor="imamMasjidName">
              <Input
                id="imamMasjidName"
                value={draft.imamMasjidName}
                onChange={(e) => set("imamMasjidName", e.target.value)}
                className={TEXT_INPUT_CLASS}
              />
            </FieldRow>
            <FieldCell className="flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
              <BilingualLabel en="Mobile No." ur="موبائل نمبر" />
              <SegmentedDigitInput
                groups={[4, 7]}
                value={draft.imamMobile}
                onChange={(v) => set("imamMobile", v)}
                ariaLabel="Imam Masjid mobile number"
              />
            </FieldCell>
            <FieldCell className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
              <BilingualLabel en="Signature" ur="دستخط" />
              <SignaturePad
                ariaLabel="Imam Masjid signature"
                value={draft.imamSignature}
                onChange={(v) => set("imamSignature", v)}
                disabled={readOnly}
              />
            </FieldCell>
          </div>

          {/* Other than relatives */}
          <div className="flex flex-col border-t-2 border-black/70 sm:border-t-0">
            <div className="border-b border-black/70 py-1.5 text-center text-[13px] font-semibold">
              Other than relatives <span className="text-neutral-400">/</span>{" "}
              <span dir="rtl" lang="ur" className="font-urdu font-normal">
                علاوہ عزیز و اقارب
              </span>
            </div>
            <FieldRow en="Name" ur="نام" htmlFor="otherName">
              <Input
                id="otherName"
                value={draft.otherName}
                onChange={(e) => set("otherName", e.target.value.toUpperCase())}
                className={TEXT_INPUT_UPPERCASE_CLASS}
              />
            </FieldRow>
            <FieldCell className="flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
              <BilingualLabel en="CNIC #" ur="شناختی کارڈ نمبر" />
              <SegmentedDigitInput
                groups={[5, 7, 1]}
                value={draft.otherCnic}
                onChange={(v) => set("otherCnic", v)}
                ariaLabel="Other reference CNIC number"
              />
            </FieldCell>
            <FieldRow en="Address" ur="ایڈریس" htmlFor="otherAddress">
              <Input
                id="otherAddress"
                value={draft.otherAddress}
                onChange={(e) => set("otherAddress", e.target.value)}
                className={TEXT_INPUT_CLASS}
              />
            </FieldRow>
            <FieldCell className="flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
              <BilingualLabel en="Mobile No." ur="موبائل نمبر" />
              <SegmentedDigitInput
                groups={[4, 7]}
                value={draft.otherMobile}
                onChange={(v) => set("otherMobile", v)}
                ariaLabel="Other reference mobile number"
              />
            </FieldCell>
            <FieldCell className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
              <BilingualLabel en="Signature" ur="دستخط" />
              <SignaturePad
                ariaLabel="Other reference signature"
                value={draft.otherSignature}
                onChange={(v) => set("otherSignature", v)}
                disabled={readOnly}
              />
            </FieldCell>
          </div>
        </div>

        {/* ------------------------------------------------------------ footer -- */}
        <div className="border-t-2 border-black px-3 py-2 text-center text-[11px] italic">
          <span dir="rtl" lang="ur" className="font-urdu text-sm not-italic">
            نوٹ: حوالہ جات میں دونوں افراد کے شناختی کارڈ کی کاپی لازمی منسلک کریں۔
          </span>
        </div>
      </div>
      </fieldset>
    </div>
  )
}
