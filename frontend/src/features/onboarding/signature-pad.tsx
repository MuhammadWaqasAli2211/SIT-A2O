import { Eraser } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A hand-drawn signature, not a typed name. This is the one field on a
 * verification form that is supposed to feel like actually signing
 * something, and a name in a cursive font does not get there.
 *
 * Stores the stroke as a PNG data URL in `value` — plain HTML5 canvas and
 * pointer events, no signature-pad library. Legal validity is explicitly out
 * of scope for this pass; this is a visual/functional replica only.
 */
export function SignaturePad({
  value,
  onChange,
  ariaLabel,
  className,
  disabled,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
  ariaLabel: string
  className?: string
  disabled?: boolean
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const drawing = React.useRef(false)
  const hasStroke = React.useRef(false)

  // Restores a saved signature (from the auto-saved draft) onto the canvas
  // once it mounts at its real size.
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const img = new Image()
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    img.src = value
  }, [value])

  const getContext = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#1f2937"
    return ctx
  }

  const pointFromEvent = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    canvas.setPointerCapture(e.pointerId)
    drawing.current = true
    hasStroke.current = true
    const { x, y } = pointFromEvent(canvas, e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    const { x, y } = pointFromEvent(canvas, e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handlePointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && hasStroke.current) onChange(canvas.toDataURL("image/png"))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasStroke.current = false
    onChange(null)
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <canvas
        ref={canvasRef}
        width={280}
        height={80}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={cn(
          "h-20 w-full max-w-70 touch-none rounded border border-input bg-white print:border-black",
          disabled && "opacity-70",
        )}
      />
      {!disabled && (
        <button
          type="button"
          onClick={clear}
          className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground print:hidden"
        >
          <Eraser className="size-3" />
          Clear
        </button>
      )}
    </div>
  )
}
