/**
 * A graduate testimonial as a chat bubble with a tail pointing at the speaker.
 *
 * The quote types itself out when the bubble scrolls into view, which is why
 * these are laid out in a grid rather than a carousel: an off-screen slide
 * never intersects, so its typewriter would either never fire or fire unseen.
 * A grid gives every bubble its own trigger as the reader reaches it.
 */

import { motion } from 'motion/react'
import { Quote } from 'lucide-react'

import { Typewriter } from '@/components/motion/typewriter'
import { cn } from '@/lib/utils'

export interface Story {
  quote: string
  name: string
  role: string
  company: string
  initials: string
}

export function StoryBubble({
  story,
  delay = 0,
  className,
}: {
  story: Story
  /** Staggers the bubble's entrance, not the typing. */
  delay?: number
  className?: string
}) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay }}
      className={cn('flex flex-col', className)}
    >
      {/* Bubble */}
      <div className="relative rounded-2xl rounded-bl-md border border-border bg-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
        <Quote
          aria-hidden="true"
          className="mb-2.5 size-5 text-primary/40"
          fill="currentColor"
        />

        <blockquote className="text-sm leading-relaxed text-foreground/90">
          <Typewriter text={story.quote} speed={22} />
        </blockquote>

        {/* Tail. A rotated square inheriting the bubble's own fill and two of
            its borders, so it stays correct in either theme without a second
            colour definition. */}
        <span
          aria-hidden="true"
          className="absolute -bottom-[7px] left-7 size-3 rotate-45 border-r border-b border-border bg-card"
        />
      </div>

      {/* Speaker */}
      <figcaption className="mt-4 flex items-center gap-3 pl-1">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-sm">
          {story.initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{story.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {story.role} · {story.company}
          </span>
        </span>
      </figcaption>
    </motion.figure>
  )
}
