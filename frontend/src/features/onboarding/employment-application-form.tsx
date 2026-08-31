import { Upload } from "lucide-react"
import * as React from "react"

import saylaniLogo from "@/assets/saylani_full_logo.png"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  addTableRow,
  AddRowButton,
  BilingualLabel,
  FieldCell,
  FieldRow,
  onboardingRadioClass,
  OnboardingToolbar,
  RemoveRowButton,
  removeTableRow,
  SectionBar,
  TABLE_CELL_INPUT_CLASS,
  TEXT_INPUT_CLASS,
  TEXT_INPUT_UPPERCASE_CLASS,
  updateTableRow,
  YesNoGroup,
} from "@/features/onboarding/form-primitives"
import { SegmentedDigitInput } from "@/features/onboarding/segmented-digit-input"
import { SignaturePad } from "@/features/onboarding/signature-pad"
import { useDraftAutosave } from "@/features/onboarding/use-draft-autosave"

type MaritalStatus = "Married" | "Unmarried"
type Gender = "Male" | "Female"
type Cast = "Syed" | "Hashmi" | "Other"

interface AcademicRow {
  majorSubject: string
  institution: string
  grade: string
  passingYear: string
}
const EMPTY_ACADEMIC_ROW: AcademicRow = {
  majorSubject: "",
  institution: "",
  grade: "",
  passingYear: "",
}

interface CourseRow {
  course: string
  majorSubject: string
  duration: string
  issuingAuthority: string
  passingYear: string
}
const EMPTY_COURSE_ROW: CourseRow = {
  course: "",
  majorSubject: "",
  duration: "",
  issuingAuthority: "",
  passingYear: "",
}

interface JobRow {
  company: string
  designation: string
  periodFrom: string
  periodTo: string
  grossSalary: string
}
const EMPTY_JOB_ROW: JobRow = {
  company: "",
  designation: "",
  periodFrom: "",
  periodTo: "",
  grossSalary: "",
}

interface FamilyRow {
  name: string
  relation: string
  age: string
  education: string
  occupation: string
}
const EMPTY_FAMILY_ROW: FamilyRow = {
  name: "",
  relation: "",
  age: "",
  education: "",
  occupation: "",
}

interface ReferenceBlock {
  name: string
  designation: string
  organization: string
  mobile: string
  email: string
}
const EMPTY_REFERENCE: ReferenceBlock = {
  name: "",
  designation: "",
  organization: "",
  mobile: "",
  email: "",
}

export interface EmploymentApplicationDraft {
  photo: string | null
  positionAppliedFor: string
  fullName: string
  cnic: string
  cnicExpiry: string
  fatherName: string
  motherName: string
  nationality: string
  religion: string
  dateOfBirth: string
  maritalStatus: MaritalStatus | null
  gender: Gender | null
  motherTongue: string
  cast: Cast | null
  castOther: string
  bloodGroup: string
  chronicDisease: string
  presentAddress: string
  postalAddress: string
  mobileNumber: string
  passportNumber: string
  emergencyNumber: string
  email: string
  academicEducation: AcademicRow[]
  islamicEducation: AcademicRow[]
  professionalCourses: CourseRow[]

  totalExperienceYears: string
  employmentHistory: JobRow[]
  presentGrossSalary: string
  otherBenefits: string
  expectedGrossSalary: string
  noticePeriod: string
  familyDetails: FamilyRow[]
  reference1: ReferenceBlock
  reference2: ReferenceBlock
  relativeName: string
  relativeRelation: string
  relativeDesignation: string
  relativeDepartment: string
  relativeMobile: string
  relativeJobDuration: string
  isMureed: boolean | null
  mureedName: string
  hasOrgAssociation: boolean | null
  orgAssociationDetails: string
  knowsAboutSaylani: boolean | null
  whySaylani: string
  ackSignature: string | null
  ackDate: string
}

const ACADEMIC_LABELS = [
  { en: "Matric", ur: "میٹرک" },
  { en: "Intermediate", ur: "انٹرمیڈیٹ" },
  { en: "Graduation", ur: "گریجویشن" },
  { en: "Masters", ur: "ماسٹرز" },
  { en: "M.Phil", ur: "ایم فل" },
] as const

const ISLAMIC_LABELS = [
  { en: "Nazra Quran", ur: "ناظرہ قرآن" },
  { en: "Hifz Quran", ur: "حفظ قرآن" },
  { en: "Dars Nizami", ur: "درس نظامی" },
  { en: "Mufti Course", ur: "مفتی کورس / تخصص" },
] as const

const EMPTY_DRAFT: EmploymentApplicationDraft = {
  photo: null,
  positionAppliedFor: "",
  fullName: "",
  cnic: "",
  cnicExpiry: "",
  fatherName: "",
  motherName: "",
  nationality: "",
  religion: "",
  dateOfBirth: "",
  maritalStatus: null,
  gender: null,
  motherTongue: "",
  cast: null,
  castOther: "",
  bloodGroup: "",
  chronicDisease: "",
  presentAddress: "",
  postalAddress: "",
  mobileNumber: "",
  passportNumber: "",
  emergencyNumber: "",
  email: "",
  academicEducation: ACADEMIC_LABELS.map(() => ({ ...EMPTY_ACADEMIC_ROW })),
  islamicEducation: ISLAMIC_LABELS.map(() => ({ ...EMPTY_ACADEMIC_ROW })),
  professionalCourses: Array.from({ length: 4 }, () => ({ ...EMPTY_COURSE_ROW })),

  totalExperienceYears: "",
  employmentHistory: Array.from({ length: 3 }, () => ({ ...EMPTY_JOB_ROW })),
  presentGrossSalary: "",
  otherBenefits: "",
  expectedGrossSalary: "",
  noticePeriod: "",
  familyDetails: Array.from({ length: 5 }, () => ({ ...EMPTY_FAMILY_ROW })),
  reference1: { ...EMPTY_REFERENCE },
  reference2: { ...EMPTY_REFERENCE },
  relativeName: "",
  relativeRelation: "",
  relativeDesignation: "",
  relativeDepartment: "",
  relativeMobile: "",
  relativeJobDuration: "",
  isMureed: null,
  mureedName: "",
  hasOrgAssociation: null,
  orgAssociationDetails: "",
  knowsAboutSaylani: null,
  whySaylani: "",
  ackSignature: null,
  ackDate: "",
}

const DRAFT_KEY = "sit.draft.employment-application"

/** A fixed-row bilingual table: Academic Education and Islamic Education
 *  share this exact shape, only the row labels and data differ. */
function EducationTable({
  labels,
  rows,
  onChangeRow,
}: {
  labels: readonly { en: string; ur: string }[]
  rows: AcademicRow[]
  onChangeRow: (index: number, key: keyof AcademicRow, value: string) => void
}) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border border-black/70 bg-neutral-100">
          <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
            Degree<span className="text-neutral-400"> / </span>
            <span dir="rtl" lang="ur" className="font-urdu font-normal">
              سند
            </span>
          </th>
          <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
            Major Subject<span className="text-neutral-400"> / </span>
            <span dir="rtl" lang="ur" className="font-urdu font-normal">
              مضامین
            </span>
          </th>
          <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
            Institution / Board<span className="text-neutral-400"> / </span>
            <span dir="rtl" lang="ur" className="font-urdu font-normal">
              ادارہ یا بورڈ
            </span>
          </th>
          <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
            Grade / %age<span className="text-neutral-400"> / </span>
            <span dir="rtl" lang="ur" className="font-urdu font-normal">
              گریڈ
            </span>
          </th>
          <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
            Passing Year<span className="text-neutral-400"> / </span>
            <span dir="rtl" lang="ur" className="font-urdu font-normal">
              سال
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {labels.map((label, index) => {
          const row = rows[index] ?? EMPTY_ACADEMIC_ROW
          return (
            <tr key={label.en}>
              <td className="border border-black/70 px-2 py-1 font-medium whitespace-nowrap">
                {label.en}
                <span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu">
                  {label.ur}
                </span>
              </td>
              {(["majorSubject", "institution", "grade", "passingYear"] as const).map((key) => (
                <td key={key} className="border border-black/70 p-1">
                  <input
                    value={row[key]}
                    onChange={(e) => onChangeRow(index, key, e.target.value)}
                    className={TABLE_CELL_INPUT_CLASS}
                  />
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}

/**
 * Digital twin of Saylani's "Employment Application Form"
 * (SWIT-IHR-FAF-03), 2 pages. Reuses the Background Verification Form's
 * primitives throughout — see form-primitives.tsx for what's shared.
 *
 * Same three modes as BackgroundVerificationForm — see its doc comment.
 */
export function EmploymentApplicationForm({
  initialData,
  readOnly = false,
  onSubmit,
  submitting = false,
}: {
  initialData?: Partial<EmploymentApplicationDraft>
  readOnly?: boolean
  onSubmit?: (draft: EmploymentApplicationDraft) => void
  submitting?: boolean
} = {}) {
  const [draft, setDraft] = React.useState<EmploymentApplicationDraft>(() => ({ ...EMPTY_DRAFT, ...initialData }))

  const { savedAt, clearDraft } = useDraftAutosave<EmploymentApplicationDraft>({
    key: DRAFT_KEY,
    value: draft,
    onRestore: setDraft,
    disabled: readOnly,
  })

  const set = <K extends keyof EmploymentApplicationDraft>(key: K, value: EmploymentApplicationDraft[K]) =>
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

  const setReference = (which: "reference1" | "reference2", key: keyof ReferenceBlock, value: string) =>
    setDraft((prev) => ({ ...prev, [which]: { ...prev[which], [key]: value } }))

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
      {/* ============================================================ PAGE 1 == */}
      <div className="print-a4-employment mx-auto w-full max-w-6xl border-2 border-black bg-white font-serif text-black print:max-w-none print:break-after-page print:border-0">
        <div className="flex items-center justify-between border-b-2 border-black px-3 py-1 text-[11px] text-neutral-600">
          <span>Ref: SWIT-IHR-FAF-03</span>
          <span>Rev.1, 16-10-2021</span>
        </div>

        <div className="flex flex-col items-center gap-1 border-b-2 border-black px-4 py-3">
          <img
            src={saylaniLogo}
            alt="Saylani Welfare International Trust"
            className="h-14 w-auto object-contain"
          />
          <h1 className="text-lg font-bold tracking-wide">EMPLOYMENT APPLICATION FORM</h1>
          <p dir="rtl" lang="ur" className="font-urdu text-xl">
            درخواست برائے ملازمت
          </p>
        </div>

        {/* Position Applied For + intro note, one compound box with the photo
            box spanning both rows on the right — matching the source. */}
        <div className="flex border-b-2 border-black">
          <div className="flex flex-1 flex-col divide-y divide-black/70">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 px-4 py-2">
              <BilingualLabel en="Position Applied For" ur="منصب کے لیے درخواست" htmlFor="positionAppliedFor" />
              <Input
                id="positionAppliedFor"
                value={draft.positionAppliedFor}
                onChange={(e) => set("positionAppliedFor", e.target.value)}
                className={`${TEXT_INPUT_CLASS} flex-1`}
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap items-baseline gap-x-1.5 px-4 py-2.5 text-xs">
              <span className="font-semibold italic">Personal information should be in CAPITAL LETTERS.</span>
              <span className="text-neutral-400">/</span>
              <span dir="rtl" lang="ur" className="font-urdu text-sm">
                ذاتی معلومات بڑے الفاظ میں تحریر فرمائیں۔
              </span>
            </div>
          </div>

          <label className="flex h-auto w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border-l-2 border-black text-center text-[10px] text-neutral-500 hover:bg-neutral-50 print:cursor-default">
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
            <input type="file" accept="image/*" onChange={handlePhoto} className="hidden print:hidden" />
          </label>
        </div>

        {/* ------------------------------------------------- personal info -- */}
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

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldRow en="Father's Name" ur="والدیت" htmlFor="fatherName" className="flex-1">
            <Input
              id="fatherName"
              value={draft.fatherName}
              onChange={(e) => set("fatherName", e.target.value.toUpperCase())}
              className={TEXT_INPUT_UPPERCASE_CLASS}
            />
          </FieldRow>
          <FieldRow en="Mother's Name" ur="والدہ کا نام" htmlFor="motherName" className="flex-1">
            <Input
              id="motherName"
              value={draft.motherName}
              onChange={(e) => set("motherName", e.target.value.toUpperCase())}
              className={TEXT_INPUT_UPPERCASE_CLASS}
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldRow en="Nationality" ur="شہریت" htmlFor="nationality" className="flex-1">
            <Input
              id="nationality"
              value={draft.nationality}
              onChange={(e) => set("nationality", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow en="Religion" ur="مذہب" htmlFor="religion" className="flex-1">
            <Input
              id="religion"
              value={draft.religion}
              onChange={(e) => set("religion", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="Date of Birth" ur="تاریخ پیدائش" />
            <SegmentedDigitInput
              groups={[2, 2, 4]}
              value={draft.dateOfBirth}
              onChange={(v) => set("dateOfBirth", v)}
              ariaLabel="Date of birth, day month year"
            />
          </FieldCell>
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Marital Status" ur="ازدواجی حیثیت" />
            <RadioGroup
              aria-label="Marital status"
              value={draft.maritalStatus ?? undefined}
              onValueChange={(v) => set("maritalStatus", v as MaritalStatus)}
              className="flex-wrap gap-4"
            >
              {(["Married", "Unmarried"] as const).map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-2 text-sm select-none">
                  <RadioGroupItem value={option} shape="circle" className={onboardingRadioClass} />
                  {option}
                </label>
              ))}
            </RadioGroup>
          </FieldCell>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-3 gap-y-1">
            <BilingualLabel en="Gender" ur="جنس" />
            <RadioGroup
              aria-label="Gender"
              value={draft.gender ?? undefined}
              onValueChange={(v) => set("gender", v as Gender)}
              className="flex-wrap gap-4"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                <RadioGroupItem value="Male" shape="circle" className={onboardingRadioClass} />
                Male<span className="text-neutral-400">/</span>
                <span dir="rtl" lang="ur" className="font-urdu">
                  مرد
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                <RadioGroupItem value="Female" shape="circle" className={onboardingRadioClass} />
                Female<span className="text-neutral-400">/</span>
                <span dir="rtl" lang="ur" className="font-urdu">
                  عورت
                </span>
              </label>
            </RadioGroup>
          </FieldCell>
          <FieldRow en="Mother Tongue" ur="مادری زبان" htmlFor="motherTongue" className="flex-1">
            <Input
              id="motherTongue"
              value={draft.motherTongue}
              onChange={(e) => set("motherTongue", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
        </div>

        <FieldCell className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
          <BilingualLabel en="Cast" ur="حسب نسب" />
          <RadioGroup
            aria-label="Cast"
            value={draft.cast ?? undefined}
            onValueChange={(v) => set("cast", v as Cast)}
            className="flex-wrap gap-4"
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
              <RadioGroupItem value="Syed" shape="circle" className={onboardingRadioClass} />
              Syed<span className="text-neutral-400">/</span>
              <span dir="rtl" lang="ur" className="font-urdu">
                سید
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
              <RadioGroupItem value="Hashmi" shape="circle" className={onboardingRadioClass} />
              Hashmi<span className="text-neutral-400">/</span>
              <span dir="rtl" lang="ur" className="font-urdu">
                ہاشمی
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
              <RadioGroupItem value="Other" shape="circle" className={onboardingRadioClass} />
              Other<span className="text-neutral-400">/</span>
              <span dir="rtl" lang="ur" className="font-urdu">
                دیگر
              </span>
            </label>
          </RadioGroup>
          {draft.cast === "Other" && (
            <Input
              value={draft.castOther}
              onChange={(e) => set("castOther", e.target.value)}
              placeholder="Please specify"
              className={`${TEXT_INPUT_CLASS} max-w-52 flex-1`}
            />
          )}
        </FieldCell>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldRow en="Blood Group" ur="خون کا گروپ" htmlFor="bloodGroup" className="flex-1">
            <Input
              id="bloodGroup"
              value={draft.bloodGroup}
              onChange={(e) => set("bloodGroup", e.target.value.toUpperCase())}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
          {/* Unlike the Background Verification Form, this source draws
              Chronic Disease as a plain blank, not a Yes/No pair. */}
          <FieldRow en="Chronic Disease" ur="دائمی مرض" htmlFor="chronicDisease" className="flex-1">
            <Input
              id="chronicDisease"
              value={draft.chronicDisease}
              onChange={(e) => set("chronicDisease", e.target.value)}
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
          {/* Passport numbers mix a letter with digits (e.g. AB1234567) — kept
              as free text rather than forced into the digit-only segmented
              input the way phone numbers are. */}
          <FieldRow en="Passport #" ur="پاسپورٹ نمبر" htmlFor="passportNumber" className="flex-1">
            <Input
              id="passportNumber"
              value={draft.passportNumber}
              onChange={(e) => set("passportNumber", e.target.value.toUpperCase())}
              placeholder="Passport Number"
              className={TEXT_INPUT_UPPERCASE_CLASS}
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="Emergency #" ur="ایمرجنسی نمبر" />
            <span className="text-[10px] text-neutral-400">(Emergency Number)</span>
            <SegmentedDigitInput
              groups={[4, 7]}
              value={draft.emergencyNumber}
              onChange={(v) => set("emergencyNumber", v)}
              ariaLabel="Mobile number, emergency"
            />
          </FieldCell>
          <FieldRow en="Email" ur="ای میل" htmlFor="email" className="flex-1">
            <Input
              id="email"
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="Email I.D"
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
        </div>

        {/* ---------------------------------------------- academic background -- */}
        <SectionBar en="Academic Background" ur="تعلیمی پس منظر" />

        <div className="border-b border-black/70 bg-neutral-50 py-1.5 text-center text-[13px] font-semibold">
          Academic Education <span className="font-normal text-neutral-400">/</span>{" "}
          <span dir="rtl" lang="ur" className="font-urdu font-normal">
            دنیاوی تعلیم
          </span>
        </div>
        <EducationTable
          labels={ACADEMIC_LABELS}
          rows={draft.academicEducation}
          onChangeRow={(index, key, value) =>
            set("academicEducation", updateTableRow(draft.academicEducation, index, key, value))
          }
        />

        <div className="border-y border-black/70 bg-neutral-50 py-1.5 text-center text-[13px] font-semibold">
          Islamic Education <span className="font-normal text-neutral-400">/</span>{" "}
          <span dir="rtl" lang="ur" className="font-urdu font-normal">
            اسلامی تعلیم
          </span>
        </div>
        <EducationTable
          labels={ISLAMIC_LABELS}
          rows={draft.islamicEducation}
          onChangeRow={(index, key, value) =>
            set("islamicEducation", updateTableRow(draft.islamicEducation, index, key, value))
          }
        />

        {/* ------------------------------------------------ professional courses -- */}
        <SectionBar en="Professional Course / Certifications / Trainings etc." ur="دیگر پیشہ ورانہ کورسز اور تربیت" />
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border border-black/70 bg-neutral-100">
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">S. No.</th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
                Course / Diploma / Certificate<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  کورس / ڈپلومہ / سرٹیفیکیٹ
                </span>
              </th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
                Major Subject<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  مضامین
                </span>
              </th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
                Duration<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  دورانیہ
                </span>
              </th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
                Issuing Authority / Institute<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  ادارے کا نام
                </span>
              </th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">
                Passing Year<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  سال
                </span>
              </th>
              <th className="border border-black/70 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {draft.professionalCourses.map((row, index) => (
              <tr key={index}>
                <td className="border border-black/70 px-2 py-1 text-center">{index + 1}.</td>
                {(["course", "majorSubject", "duration", "issuingAuthority", "passingYear"] as const).map(
                  (key) => (
                    <td key={key} className="border border-black/70 p-1">
                      <input
                        value={row[key]}
                        onChange={(e) =>
                          set(
                            "professionalCourses",
                            updateTableRow(draft.professionalCourses, index, key, e.target.value)
                          )
                        }
                        className={TABLE_CELL_INPUT_CLASS}
                      />
                    </td>
                  )
                )}
                <td className="border border-black/70 print:hidden">
                  <RemoveRowButton
                    visible={draft.professionalCourses.length > 1}
                    onClick={() =>
                      set("professionalCourses", removeTableRow(draft.professionalCourses, index, 1))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <AddRowButton
          label="Add row"
          onClick={() => set("professionalCourses", addTableRow(draft.professionalCourses, EMPTY_COURSE_ROW))}
        />

        <div className="border-t-2 border-black py-1.5 text-center text-[10px] text-neutral-500">Page 1 of 2</div>
      </div>

      {/* ============================================================ PAGE 2 == */}
      <div className="print-a4-employment mx-auto w-full max-w-6xl border-2 border-black bg-white font-serif text-black print:max-w-none print:border-0">
        {/* ---------------------------------------------------- employment history -- */}
        <SectionBar en="Employment History" ur="ملازمت کی تفصیل" />

        <FieldRow en="Total Working Experience" ur="مجموعی مدتِ ملازمت" htmlFor="totalExperienceYears">
          <div className="flex items-center gap-2">
            <Input
              id="totalExperienceYears"
              value={draft.totalExperienceYears}
              onChange={(e) => set("totalExperienceYears", e.target.value)}
              className={`${TEXT_INPUT_CLASS} max-w-24`}
            />
            <span className="text-sm">Years</span>
          </div>
        </FieldRow>

        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border border-black/70 bg-neutral-100">
              <th rowSpan={2} className="border border-black/70 px-2 py-1.5 text-left font-semibold align-bottom">
                S. No.
              </th>
              <th rowSpan={2} className="border border-black/70 px-2 py-1.5 text-left font-semibold align-bottom">
                Company / Organization<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  کمپنی یا ادارے کا نام
                </span>
              </th>
              <th rowSpan={2} className="border border-black/70 px-2 py-1.5 text-left font-semibold align-bottom">
                Designation / Job Title<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  عہدہ یا منصب
                </span>
              </th>
              <th colSpan={2} className="border border-black/70 px-2 py-1 text-center font-semibold">
                Period<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  مدت (عرصہ)
                </span>
              </th>
              <th rowSpan={2} className="border border-black/70 px-2 py-1.5 text-left font-semibold align-bottom">
                Gross Salary<span className="text-neutral-400"> / </span>
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  مجموعی تنخواہ
                </span>
              </th>
              <th rowSpan={2} className="border border-black/70 print:hidden" />
            </tr>
            <tr className="border border-black/70 bg-neutral-100">
              <th className="border border-black/70 px-2 py-1 text-left font-semibold">From</th>
              <th className="border border-black/70 px-2 py-1 text-left font-semibold">To</th>
            </tr>
          </thead>
          <tbody>
            {draft.employmentHistory.map((row, index) => (
              <tr key={index}>
                <td className="border border-black/70 px-2 py-1 text-center">{index + 1}.</td>
                {(["company", "designation"] as const).map((key) => (
                  <td key={key} className="border border-black/70 p-1">
                    <input
                      value={row[key]}
                      onChange={(e) =>
                        set("employmentHistory", updateTableRow(draft.employmentHistory, index, key, e.target.value))
                      }
                      className={TABLE_CELL_INPUT_CLASS}
                    />
                  </td>
                ))}
                {(["periodFrom", "periodTo"] as const).map((key) => (
                  <td key={key} className="border border-black/70 p-1">
                    <input
                      value={row[key]}
                      onChange={(e) =>
                        set("employmentHistory", updateTableRow(draft.employmentHistory, index, key, e.target.value))
                      }
                      placeholder="MM-YYYY"
                      className={TABLE_CELL_INPUT_CLASS}
                    />
                  </td>
                ))}
                <td className="border border-black/70 p-1">
                  <input
                    value={row.grossSalary}
                    onChange={(e) =>
                      set(
                        "employmentHistory",
                        updateTableRow(draft.employmentHistory, index, "grossSalary", e.target.value)
                      )
                    }
                    className={TABLE_CELL_INPUT_CLASS}
                  />
                </td>
                <td className="border border-black/70 print:hidden">
                  <RemoveRowButton
                    visible={draft.employmentHistory.length > 1}
                    onClick={() => set("employmentHistory", removeTableRow(draft.employmentHistory, index, 1))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <AddRowButton
          label="Add row"
          onClick={() => set("employmentHistory", addTableRow(draft.employmentHistory, EMPTY_JOB_ROW))}
        />

        {/* ------------------------------------------- salary and benefits -- */}
        <div className="flex flex-col divide-y divide-white border-t-2 border-black bg-black text-center sm:flex-row sm:items-baseline sm:justify-center sm:divide-x sm:divide-y-0 sm:gap-2">
          <span className="px-3 py-1.5 text-sm font-bold tracking-wide text-white uppercase">
            Present Salary and Benefits <span className="font-normal text-neutral-400">/</span>{" "}
            <span dir="rtl" lang="ur" className="font-urdu font-normal normal-case">
              موجودہ تنخواہ و مراعات
            </span>
          </span>
          <span className="px-3 py-1.5 text-sm font-bold tracking-wide text-white uppercase">
            Expected Salary <span className="font-normal text-neutral-400">/</span>{" "}
            <span dir="rtl" lang="ur" className="font-urdu font-normal normal-case">
              متوقع تنخواہ
            </span>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="flex flex-col border-black/70 sm:border-r-2">
            <FieldRow en="Gross Salary" ur="مجموعی تنخواہ" htmlFor="presentGrossSalary">
              <Input
                id="presentGrossSalary"
                value={draft.presentGrossSalary}
                onChange={(e) => set("presentGrossSalary", e.target.value)}
                className={TEXT_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow en="Other Benefits" ur="دیگر مراعات" htmlFor="otherBenefits">
              <Input
                id="otherBenefits"
                value={draft.otherBenefits}
                onChange={(e) => set("otherBenefits", e.target.value)}
                className={TEXT_INPUT_CLASS}
              />
            </FieldRow>
          </div>
          <div className="flex flex-col border-t-2 border-black/70 sm:border-t-0">
            <FieldRow en="Gross Salary" ur="مجموعی تنخواہ" htmlFor="expectedGrossSalary">
              <Input
                id="expectedGrossSalary"
                value={draft.expectedGrossSalary}
                onChange={(e) => set("expectedGrossSalary", e.target.value)}
                className={TEXT_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow en="Notice Period" ur="نوٹس مدت" htmlFor="noticePeriod">
              <Input
                id="noticePeriod"
                value={draft.noticePeriod}
                onChange={(e) => set("noticePeriod", e.target.value)}
                className={TEXT_INPUT_CLASS}
              />
            </FieldRow>
          </div>
        </div>

        {/* ------------------------------------------------------ family details -- */}
        <SectionBar en="Family Details" ur="خاندان کی تفصیلات" />
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border border-black/70 bg-neutral-100">
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">S. No.</th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">Name</th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">Relation</th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">Age</th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">Education</th>
              <th className="border border-black/70 px-2 py-1.5 text-left font-semibold">Occupation</th>
              <th className="border border-black/70 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {draft.familyDetails.map((row, index) => (
              <tr key={index}>
                <td className="border border-black/70 px-2 py-1 text-center">{index + 1}.</td>
                {(["name", "relation", "age", "education", "occupation"] as const).map((key) => (
                  <td key={key} className="border border-black/70 p-1">
                    <input
                      value={row[key]}
                      onChange={(e) =>
                        set("familyDetails", updateTableRow(draft.familyDetails, index, key, e.target.value))
                      }
                      className={TABLE_CELL_INPUT_CLASS}
                    />
                  </td>
                ))}
                <td className="border border-black/70 print:hidden">
                  <RemoveRowButton
                    visible={draft.familyDetails.length > 1}
                    onClick={() => set("familyDetails", removeTableRow(draft.familyDetails, index, 1))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <AddRowButton
          label="Add row"
          onClick={() => set("familyDetails", addTableRow(draft.familyDetails, EMPTY_FAMILY_ROW))}
        />

        {/* ---------------------------------------------------------- references -- */}
        <SectionBar en="References (Other than relatives)" ur="معروفین (علاوہ عزیز و اقارب)" />
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {(["reference1", "reference2"] as const).map((which, i) => (
            <div
              key={which}
              className={`flex flex-col border-black/70 ${i === 0 ? "sm:border-r-2" : "border-t-2 sm:border-t-0"}`}
            >
              <div className="border-b border-black/70 py-1.5 text-center text-[13px] font-semibold">
                {`Reference — ${i + 1}`} <span className="font-normal text-neutral-400">/</span>{" "}
                <span dir="rtl" lang="ur" className="font-urdu font-normal">
                  معروفیت
                </span>
              </div>
              {(
                [
                  ["name", "Name", "نام"],
                  ["designation", "Designation", "منصب"],
                  ["organization", "Organization", "ادارہ"],
                  ["mobile", "Mobile No.", "موبائل نمبر"],
                ] as const
              ).map(([key, en, ur]) => (
                <FieldRow key={key} en={en} ur={ur} htmlFor={`${which}-${key}`}>
                  <Input
                    id={`${which}-${key}`}
                    value={draft[which][key]}
                    onChange={(e) => setReference(which, key, e.target.value)}
                    className={TEXT_INPUT_CLASS}
                  />
                </FieldRow>
              ))}
              <FieldRow en="E-mail" ur="ای میل" htmlFor={`${which}-email`}>
                <Input
                  id={`${which}-email`}
                  type="email"
                  value={draft[which].email}
                  onChange={(e) => setReference(which, "email", e.target.value)}
                  className={TEXT_INPUT_CLASS}
                />
              </FieldRow>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------- relative employee -- */}
        <SectionBar
          en="Employee Relative in the Saylani Welfare"
          ur="کوئی رشتہ دار جو سیلانی ویلفیئر میں ملازمت کرتا ہو"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldRow en="Name" ur="نام" htmlFor="relativeName" className="flex-1">
            <Input
              id="relativeName"
              value={draft.relativeName}
              onChange={(e) => set("relativeName", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow en="Relation" ur="رشتہ" htmlFor="relativeRelation" className="flex-1">
            <Input
              id="relativeRelation"
              value={draft.relativeRelation}
              onChange={(e) => set("relativeRelation", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldRow en="Designation" ur="منصب" htmlFor="relativeDesignation" className="flex-1">
            <Input
              id="relativeDesignation"
              value={draft.relativeDesignation}
              onChange={(e) => set("relativeDesignation", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow en="Department" ur="شعبہ" htmlFor="relativeDepartment" className="flex-1">
            <Input
              id="relativeDepartment"
              value={draft.relativeDepartment}
              onChange={(e) => set("relativeDepartment", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <FieldCell className="flex-1 flex-col sm:flex-row sm:flex-wrap items-center gap-x-2 gap-y-1">
            <BilingualLabel en="Mobile No." ur="موبائل نمبر" />
            <SegmentedDigitInput
              groups={[4, 7]}
              value={draft.relativeMobile}
              onChange={(v) => set("relativeMobile", v)}
              ariaLabel="Relative's mobile number"
            />
          </FieldCell>
          <FieldRow en="Job Duration" ur="مدتِ ملازمت" htmlFor="relativeJobDuration" className="flex-1">
            <Input
              id="relativeJobDuration"
              value={draft.relativeJobDuration}
              onChange={(e) => set("relativeJobDuration", e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </FieldRow>
        </div>

        {/* --------------------------------------------------- declarations -- */}
        <SectionBar en="Saylani Welfare International Trust" ur="سیلانی ویلفیئر انٹرنیشنل ٹرسٹ" />

        <div className="flex flex-col divide-y divide-black/70 border-b border-black/70">
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <p className="flex-1 text-[13px]">
              <span className="font-semibold">1. Are you Mureed? If yes, name please.</span>
              <br />
              <span dir="rtl" lang="ur" className="font-urdu text-sm">
                کیا آپ مرید ہیں؟ اگر مرید ہیں تو پیر صاحب کا نام کیا ہے؟
              </span>
            </p>
            <YesNoGroup
              ariaLabel="Are you Mureed"
              value={draft.isMureed}
              onChange={(v) => set("isMureed", v)}
            />
            {draft.isMureed && (
              <Input
                value={draft.mureedName}
                onChange={(e) => set("mureedName", e.target.value)}
                placeholder="Name"
                className={`${TEXT_INPUT_CLASS} max-w-56`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <p className="flex-1 text-[13px]">
              <span className="font-semibold">
                2. Directly or in-directly association with any other religious / political / social
                Organization? If &lsquo;Yes&rsquo;, mention name and duration please.
              </span>
              <br />
              <span dir="rtl" lang="ur" className="font-urdu text-sm">
                کسی مذہبی / سیاسی / سماجی تنظیم سے بالواسطہ یا بلاواسطہ کوئی تعلق؟ اگر ہے تو تنظیم کا نام
                اور رکنیت کی مدت بتائیں۔
              </span>
            </p>
            <YesNoGroup
              ariaLabel="Association with another organization"
              value={draft.hasOrgAssociation}
              onChange={(v) => set("hasOrgAssociation", v)}
            />
            {draft.hasOrgAssociation && (
              <Input
                value={draft.orgAssociationDetails}
                onChange={(e) => set("orgAssociationDetails", e.target.value)}
                placeholder="Name and duration"
                className={`${TEXT_INPUT_CLASS} max-w-56`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <p className="flex-1 text-[13px]">
              <span className="font-semibold">3. What do you know about &lsquo;Saylani&rsquo;?</span>
              <br />
              <span dir="rtl" lang="ur" className="font-urdu text-sm">
                آپ ”سیلانی“ کے بارے میں کیا جانتے ہیں؟
              </span>
            </p>
            {/* Printed with a Yes/No column in the source even though the
                question itself is open-ended — replicated as printed rather
                than corrected. */}
            <YesNoGroup
              ariaLabel="What do you know about Saylani"
              value={draft.knowsAboutSaylani}
              onChange={(v) => set("knowsAboutSaylani", v)}
            />
          </div>

          <div className="flex flex-wrap items-start gap-3 px-4 py-2.5">
            <p className="flex-1 text-[13px]">
              <span className="font-semibold">
                4. Briefly explain why do you want to pursue your career in &lsquo;Saylani&rsquo;?
              </span>
              <br />
              <span dir="rtl" lang="ur" className="font-urdu text-sm">
                مختصراً بتائیں کہ آپ ”سیلانی“ میں ملازمت کیوں کرنا چاہتے ہیں؟
              </span>
            </p>
            <textarea
              value={draft.whySaylani}
              onChange={(e) => set("whySaylani", e.target.value)}
              rows={2}
              className={`${TEXT_INPUT_CLASS} h-auto max-w-md flex-1 resize-none py-1.5`}
            />
          </div>
        </div>

        {/* ---------------------------------------------------- acknowledgment -- */}
        <SectionBar en="Acknowledgment" ur="اعتراف" />
        <div className="border-b border-black/70 px-3 py-2.5 text-center text-[13px] italic">
          <p>
            By signing below, I hereby admit that the information I have provided above, is accurate to
            the best of my knowledge.
          </p>
          <p dir="rtl" lang="ur" className="font-urdu text-base not-italic">
            میں اعتراف کرتا/کرتی ہوں کہ میری جانب سے فراہم کی گئی درج بالا تمام معلومات میرے علم کے
            مطابق درست ہیں۔
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

        <div className="border-t-2 border-black py-1.5 text-center text-[10px] text-neutral-500">Page 2 of 2</div>
      </div>
      </fieldset>
    </div>
  )
}
