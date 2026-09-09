import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * The "no photo yet" default — a generic bust silhouette, not initials.
 *
 * Deliberately unisex: this renders for every candidate and admin who
 * hasn't uploaded a picture, so a default that reads as one gender would be
 * quietly wrong for everyone else shown it. Plain inline SVG, not a fetched
 * asset — nothing to fail to load.
 */
function DefaultAvatarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.6" fill="currentColor" />
      <path
        d="M4.2 20c.55-4.2 3.9-7.2 7.8-7.2s7.25 3 7.8 7.2"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * The signed-in user's own picture, everywhere it appears — the header
 * dropdown and the account page today. One component so both stay in sync
 * rather than drifting the way the old copy-pasted initials markup could.
 *
 * Base UI's Avatar primitive already handles the fallback-while-missing
 * case; this only supplies what goes in each slot.
 */
export function UserAvatar({
  pictureUrl,
  size = 'default',
  className,
  glyphClassName,
}: {
  pictureUrl?: string | null
  size?: 'sm' | 'default' | 'lg' | 'xl'
  className?: string
  glyphClassName?: string
}) {
  return (
    <Avatar
      size={size}
      className={cn(
        // Solid primary, not a 10% tint. The tint put a faint green glyph
        // on a faint green disc — on the dark header that read as an empty
        // grey hole rather than as a person. A filled disc with its
        // foreground colour on top reads as an avatar on any background.
        'bg-primary text-primary-foreground ring-2 ring-white/25',
        className,
      )}
    >
      {pictureUrl && <AvatarImage src={pictureUrl} alt="" />}
      <AvatarFallback className="bg-transparent text-current">
        <DefaultAvatarGlyph className={cn('size-[62%]', glyphClassName)} />
      </AvatarFallback>
    </Avatar>
  )
}
