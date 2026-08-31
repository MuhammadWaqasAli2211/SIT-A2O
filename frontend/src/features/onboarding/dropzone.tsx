/**
 * Drag-and-drop + click-to-browse upload zone.
 *
 * Native HTML5 drag events rather than a library — a single-file picker
 * with a highlighted drop state doesn't need one, and the project has no
 * existing drag-and-drop dependency to build on.
 */
import { CloudUpload, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'
const MAX_MB = 5

export function UploadDropzone({
  onFile,
  label = 'Drag & drop, or click to browse',
  compact = false,
}: {
  /** Returns whether the upload succeeded — errors are shown by the caller's own toast/mutation error state. */
  onFile: (file: File) => Promise<boolean>
  label?: string
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handle(file: File | undefined) {
    if (!file) return
    setLocalError(null)
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`That file is ${formatSize(file.size)}. The limit is ${MAX_MB} MB.`)
      return
    }
    setPending(true)
    try {
      await onFile(file)
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handle(e.dataTransfer.files?.[0])
        }}
        disabled={pending}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors disabled:opacity-60',
          compact ? 'px-3 py-4' : 'px-4 py-8',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
        )}
      >
        <span
          className={cn(
            'grid place-items-center rounded-xl bg-muted text-muted-foreground transition-colors',
            dragging && 'bg-primary/15 text-primary',
            compact ? 'size-8' : 'size-11',
          )}
        >
          {pending ? (
            <Loader2 className={cn('animate-spin', compact ? 'size-4' : 'size-5')} />
          ) : (
            <CloudUpload className={compact ? 'size-4' : 'size-5'} />
          )}
        </span>
        <span className="text-sm font-medium">{pending ? 'Uploading…' : label}</span>
        {!compact && (
          <span className="text-xs text-muted-foreground">PDF, JPG, PNG, or WebP · up to {MAX_MB} MB</span>
        )}
      </button>

      {localError && (
        <Alert variant="destructive">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void handle(e.target.files?.[0])}
      />
    </div>
  )
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
