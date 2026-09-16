/**
 * The candidate's own ID card download.
 *
 * Rendered only when the server says so — see `id_card_available` on the
 * onboarding progress payload, which is true when cards are issued for the
 * intake *and* this candidate was selected at the physical interview.
 *
 * The file is fetched as a blob rather than linked to directly: the route
 * needs the bearer token, so a plain anchor would hit it unauthenticated.
 */

import { IdCard } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { toErrorMessage } from '@/lib/api-client'

export function IdCardDownload({ applicationId }: { applicationId: string }) {
  const [pending, setPending] = useState(false)

  async function download() {
    setPending(true)
    try {
      const { data, headers } = await api.get<Blob>(`/applications/${applicationId}/id-card`, {
        responseType: 'blob',
      })

      // Prefer the name the server chose, so the file is called after the
      // candidate code rather than the route.
      const disposition = String(headers['content-disposition'] ?? '')
      const match = /filename="?([^"]+)"?/.exec(disposition)
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = match?.[1] ?? 'id-card.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(toErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <IdCard className="size-5" />
        </span>
        <div className="flex flex-col">
          <span className="font-medium">Your ID Card</span>
          <span className="text-sm text-muted-foreground">
            Two pages — front and back. Print or keep it on your phone.
          </span>
        </div>
      </div>
      <Button onClick={download} disabled={pending}>
        <IdCard className="size-4" />
        <PendingLabel idle="Download ID Card" pending="Preparing…" isPending={pending} />
      </Button>
    </div>
  )
}
