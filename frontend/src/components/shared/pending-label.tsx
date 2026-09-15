/**
 * A button or toggle label that says what it is doing, without moving.
 *
 * Small in-place controls do not get a spinner. A spinner next to a two-word
 * label is both too small to read as motion and — because it appears only
 * while pending — an element that did not exist a moment ago, so the label
 * beside it jumps sideways the instant you click. The control tells you what
 * it is doing in words instead.
 *
 * No layout shift, guaranteed by the layout rather than by choosing careful
 * wording: both strings are rendered into the *same* grid cell, so the
 * container is always as wide as the longer of the two and neither state can
 * resize it. Hiding the inactive one with `invisible` keeps it occupying its
 * space — `hidden` or conditional rendering would collapse it and bring the
 * jump straight back.
 *
 * That also means the pending text can be longer than the idle text without
 * anyone having to check: "Save window" -> "Saving…" is narrower, "Approve"
 * -> "Approving…" is wider, and both are stable either way.
 */

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function PendingLabel({
  idle,
  pending,
  isPending,
  reserve,
  className,
}: {
  /** What the control says at rest. */
  idle: ReactNode
  /** What it says while its action is in flight. */
  pending: ReactNode
  isPending: boolean
  /**
   * Extra strings that only contribute width, never appear.
   *
   * For a control whose *idle* text also changes once the action lands — the
   * phase toggle reads "Manually opened" or "Manually closed" depending on
   * the result — reserving the two pending strings is not enough. Listing the
   * other reachable labels here keeps the control one fixed size across every
   * state it can be in, not merely across the one transition.
   */
  reserve?: ReactNode[]
  className?: string
}) {
  return (
    // `inline-grid`, so this sits inside a button's flex row exactly as a bare
    // string would rather than becoming a block that stretches it.
    <span className={cn('inline-grid', className)}>
      <span
        aria-hidden={isPending}
        className={cn(
          'col-start-1 row-start-1 whitespace-nowrap text-center',
          isPending && 'invisible',
        )}
      >
        {idle}
      </span>
      <span
        aria-hidden={!isPending}
        className={cn(
          'col-start-1 row-start-1 whitespace-nowrap text-center',
          !isPending && 'invisible',
        )}
      >
        {pending}
      </span>
      {reserve?.map((text, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 whitespace-nowrap text-center"
        >
          {text}
        </span>
      ))}
    </span>
  )
}
