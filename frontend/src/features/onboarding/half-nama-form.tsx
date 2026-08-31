import * as React from "react"

import saylaniLogo from "@/assets/saylani_full_logo.png"
import {
  InlineBlank,
  OnboardingToolbar,
} from "@/features/onboarding/form-primitives"
import { SignaturePad } from "@/features/onboarding/signature-pad"
import { useDraftAutosave } from "@/features/onboarding/use-draft-autosave"

export interface HalfNamaDraft {
  page1Name: string
  page1FatherName: string
  page1Date: string
  page1Signature: string | null

  page2Name: string
  page2FatherName: string
  page2CodeNumber: string
  page2Department: string
  page2Designation: string
  page2Signature: string | null
}

const EMPTY_DRAFT: HalfNamaDraft = {
  page1Name: "",
  page1FatherName: "",
  page1Date: "",
  page1Signature: null,

  page2Name: "",
  page2FatherName: "",
  page2CodeNumber: "",
  page2Department: "",
  page2Designation: "",
  page2Signature: null,
}

const DRAFT_KEY = "sit.draft.half-nama"

// Transcribed directly from the source PDF's own text layer, which — unlike
// the previous two forms — extracts cleanly in correct reading order rather
// than scrambled. Minor punctuation/spacing normalised; content unchanged.
const POLICY_ROWS = [
  "اصول وضوابط کی پالیسی",
  "ضابطہ اخلاق کی پالیسی",
  'کارڈ "نظم وضبط" کی پالیسی',
  "ادارے کے اندر کسی قسم کی لڑائی جھگڑے اور گالی گلوچ سے پرہیز کریں۔",
  "ڈیوٹی پر آنے کے لئے دیئے گئے شیڈول کے مطابق 15 منٹ پہلے پہنچنا اور جب صبح کی ڈیوٹی ہو تو دعا میں لازمی شرکت کرنا۔",
  "اپنے ٹارگٹ، ڈیوٹی شیڈول اور دیگر معلومات کے لئے اپنے سپروائزر/ہیڈ سے رابطہ کرنا۔",
  "اگر کسی بھی وجہ یا وجوہات کی بنا پر ملازمت چھوڑنی ہو تو ہیومین ریسورس ڈیپارٹمنٹ میں تحریری اطلاع دینا ضروری ہوگا، بصورت دیگر واجبات ادا نہیں کیے جائیں گے۔",
  "اگر کسی ایمرجنسی صورتحال میں چھٹی مطلوب ہو تو ہیومین ریسورس ڈیپارٹمنٹ کو ٹیلی فون کر کے بتائیں۔",
  "ادارے میں ہر قسم کی صفائی ستھرائی کا مکمل خیال رکھنا۔",
  "اپنے سینئرز کے تمام احکامات پر پوری طرح عمل کروں گا۔",
]

/**
 * Reserved layout space only — not functional. The source PDF draws two
 * thumbprint boxes ("سیدھے ہاتھ کا انگوٹھا" / right hand, "الٹے ہاتھ کا
 * انگوٹھا" / left hand) beside the signature. How a thumbprint is captured
 * digitally — a checkbox acknowledgment, an upload, something else — is
 * explicitly undecided pending the Saylani team's own call, so this
 * deliberately does nothing: no input, no state, no click handler.
 */
function ThumbprintPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex size-20 items-center justify-center border border-dashed border-neutral-400 bg-neutral-50" />
      <span className="font-urdu text-xs text-neutral-600">{label}</span>
    </div>
  )
}

/**
 * Digital twin of Saylani's "Half Nama" oath form. Pure Urdu, right-to-left
 * throughout — unlike the previous two forms, this one is almost entirely
 * flowing prose with inline blanks, not a grid of labelled fields, so it
 * does not reuse FieldRow/FieldCell/BilingualLabel at all.
 *
 * Same three modes as BackgroundVerificationForm — see its doc comment.
 */
export function HalfNamaForm({
  initialData,
  readOnly = false,
  onSubmit,
  submitting = false,
}: {
  initialData?: Partial<HalfNamaDraft>
  readOnly?: boolean
  onSubmit?: (draft: HalfNamaDraft) => void
  submitting?: boolean
} = {}) {
  const [draft, setDraft] = React.useState<HalfNamaDraft>(() => ({ ...EMPTY_DRAFT, ...initialData }))

  const { savedAt, clearDraft } = useDraftAutosave<HalfNamaDraft>({
    key: DRAFT_KEY,
    value: draft,
    onRestore: setDraft,
    disabled: readOnly,
  })

  const set = <K extends keyof HalfNamaDraft>(key: K, value: HalfNamaDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

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
      {/* ============================================================ PAGE 1 == */}
      <div
        dir="rtl"
        lang="ur"
        className="print-a4-half-nama mx-auto w-full max-w-4xl border-2 border-black bg-white font-urdu text-black print:max-w-none print:break-after-page print:border-0"
      >
        <div className="flex flex-col items-center gap-2 border-b-2 border-black px-6 py-4">
          <img
            src={saylaniLogo}
            alt="سیلانی ویلفیئر انٹرنیشنل ٹرسٹ"
            className="h-14 w-auto object-contain"
          />
          <h1 className="text-xl font-bold">سیلانی ویلفیئر انٹرنیشنل ٹرسٹ</h1>
          <p className="text-lg">☆ سیلانی ویلفیئر کے ساتھ وفاداری کا عہد نامہ ☆</p>

          <div className="mt-1 border border-black/70 bg-neutral-50 px-5 py-2 text-center">
            <p className="text-base">﴾ اس کا کوئی دین نہیں ، جس کا کوئی عہد نہیں ﴿</p>
            <p className="text-sm text-neutral-600">- [ الحدیث ]</p>
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="text-justify text-[17px] leading-[2.6]">
            میں{" "}
            <InlineBlank
              value={draft.page1Name}
              onChange={(v) => set("page1Name", v)}
              ariaLabel="نام"
              width="9rem"
            />{" "}
            بن{" "}
            <InlineBlank
              value={draft.page1FatherName}
              onChange={(v) => set("page1FatherName", v)}
              ariaLabel="والد کا نام"
              width="9rem"
            />{" "}
            یہ عہد کرتا ہوں کہ میں سیلانی ویلفیئر انٹرنیشنل ٹرسٹ کا ہمیشہ وفادار رہوں گا۔ اور اس ادارے
            میں خدمات کو صرف نوکری نہیں بلکہ آقا کریم ﷺ کی دکھیاری امت کی خدمت سمجھوں گا۔ اس ادارے کی
            ترویج و ترقی کے لئے اپنی صلاحیتوں کو حتی الامکان بروئے کار لاؤں گا، ادارے کی ضرورت اور آقا
            کریم ﷺ کی دکھیاری امت کی ہر پریشانی و مصیبت کے وقت مقررشدہ اوقات کے علاوہ بھی ہمہ وقت ہر قسم
            کی خدمات دینے کے لئے "فی سبیل اللہ" تیار رہوں گا۔ اپنے آپ کو ادارے کا صرف ملازم نہیں بلکہ
            دست و بازو سمجھوں گا۔ اس ادارے کے نقصان کو اپنا نقصان سمجھوں گا، اگر پانی یا روٹی یا سالن
            ضائع ہو رہا ہے یا بجلی کا ضیاع ہو رہا ہے یا کوئی اور سامان عدم توجہی کی وجہ سے ضائع ہو رہا ہے
            تو حدیثِ پاک کے اس فرمان کہ "برائی کو ہاتھ سے روکو" پر عمل کرتے ہوئے اپنی طاقت بھر اس نقصان
            کو روکنے کی پوری کوشش کروں گا۔ اور اگر خود نہ روک پایا تو اپنے سے اوپر ذمہ داروں کو اس کی
            اطلاع دوں گا، اور کسی کی ادارے کو نقصان پہنچانے والی حرکت کی پردہ پوشی نہیں کروں گا۔ اللہ
            عزوجل اپنے حبیب کریم علیہ الصلوٰۃ والتسلیم کے وسیلہ سے مجھے اس عہد پر پورا اترنے کی توفیق
            عطا فرمائے (آمین)۔
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-black px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">تاریخ:</span>
            <InlineBlank
              value={draft.page1Date}
              onChange={(v) => set("page1Date", v)}
              ariaLabel="تاریخ"
              width="8rem"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">دستخط:</span>
            <SignaturePad
              ariaLabel="دستخط"
              value={draft.page1Signature}
              onChange={(v) => set("page1Signature", v)}
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="border-t-2 border-black py-1.5 text-center text-[10px] text-neutral-500">
          Page 1 of 2
        </div>
      </div>

      {/* ============================================================ PAGE 2 == */}
      <div
        dir="rtl"
        lang="ur"
        className="print-a4-half-nama mx-auto w-full max-w-4xl border-2 border-black bg-white font-urdu text-black print:max-w-none print:border-0"
      >
        <div className="flex flex-col items-center gap-2 border-b-2 border-black px-6 py-4">
          <img
            src={saylaniLogo}
            alt="سیلانی ویلفیئر انٹرنیشنل ٹرسٹ"
            className="h-14 w-auto object-contain"
          />
          <h1 className="text-xl font-bold">سیلانی ویلفیئر انٹرنیشنل ٹرسٹ</h1>
          <p className="text-lg">﴾ اقرار نامہ ﴿</p>
        </div>

        <div className="border-b-2 border-black px-6 py-6">
          <p className="text-justify text-[17px] leading-[2.6]">
            میں{" "}
            <InlineBlank
              value={draft.page2Name}
              onChange={(v) => set("page2Name", v)}
              ariaLabel="نام"
              width="8rem"
            />{" "}
            ولدیت{" "}
            <InlineBlank
              value={draft.page2FatherName}
              onChange={(v) => set("page2FatherName", v)}
              ariaLabel="والد کا نام"
              width="8rem"
            />{" "}
            ادارے کا کوڈ نمبر{" "}
            <InlineBlank
              value={draft.page2CodeNumber}
              onChange={(v) => set("page2CodeNumber", v)}
              ariaLabel="ادارے کا کوڈ نمبر"
              width="6rem"
            />{" "}
            اور{" "}
            <InlineBlank
              value={draft.page2Department}
              onChange={(v) => set("page2Department", v)}
              ariaLabel="ڈیپارٹمنٹ"
              width="8rem"
            />{" "}
            ڈیپارٹمنٹ میں بحیثیت{" "}
            <InlineBlank
              value={draft.page2Designation}
              onChange={(v) => set("page2Designation", v)}
              ariaLabel="بحیثیت"
              width="8rem"
            />{" "}
            کے کام کرتا ہوں کہ مجھے تمام ہدایات اچھی طرح سے سمجھا گیا ہے اور ان میں بتائی گئی تمام
            شرائط، جرمانہ وغیرہ کی سختی سے پابندی کروں گا۔ بتائی گئی تمام پالیسیاں مندرجہ ذیل ہیں۔
          </p>
        </div>

        <div className="overflow-x-auto">
        <table dir="rtl" className="w-full border-collapse text-sm">
          <tbody>
            {POLICY_ROWS.map((text, i) => (
              <tr key={i}>
                <td className="w-12 border border-black/70 px-2 py-2.5 text-center font-semibold">
                  {i + 1}
                </td>
                <td className="border border-black/70 px-3 py-2.5 leading-relaxed">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="border-b-2 border-black px-6 py-5">
          <p className="text-justify text-[17px] leading-[2.6]">
            مزید براں یہ کہ میں کسی قسم کی غیر قانونی حرکات وغیرہ میں بھی شامل نہیں رہوں گا۔ میں اوپر
            بتائی گئی تمام ہدایات پر سختی سے عمل کروں گا/گی اور اگر کسی قسم کی شکایات انتظامیہ تک
            پہنچیں تو انتظامیہ سخت ایکشن کا حق محفوظ رکھتی ہے۔
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-around gap-6 px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="font-semibold">دستخط:</span>
            <SignaturePad
              ariaLabel="دستخط"
              value={draft.page2Signature}
              onChange={(v) => set("page2Signature", v)}
              disabled={readOnly}
            />
          </div>
          <ThumbprintPlaceholder label="سیدھے ہاتھ کا انگوٹھا" />
          <ThumbprintPlaceholder label="الٹے ہاتھ کا انگوٹھا" />
        </div>

        <div className="border-t-2 border-black py-1.5 text-center text-[10px] text-neutral-500">
          Page 2 of 2
        </div>
      </div>
      </fieldset>
    </div>
  )
}
