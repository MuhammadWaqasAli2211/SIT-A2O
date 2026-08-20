import type { ReactNode } from 'react'

import { Reveal } from '@/components/motion/reveal'
import { cn } from '@/lib/utils'

export function Section({
  children,
  className,
  id,
  container = true,
}: {
  children: ReactNode
  className?: string
  id?: string
  container?: boolean
}) {
  return (
    <section id={id} className={cn('py-20 sm:py-28', className)}>
      {container ? <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div> : children}
    </section>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1',
        'text-xs font-semibold uppercase tracking-widest text-primary',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'left'
  className?: string
}) {
  return (
    <Reveal
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'mx-auto max-w-3xl items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
        {title}
      </h2>
      {description && (
        <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
      )}
    </Reveal>
  )
}
