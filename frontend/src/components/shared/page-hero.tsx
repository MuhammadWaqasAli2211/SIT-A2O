import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Eyebrow } from '@/components/shared/section'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  href?: string
}

/** Shared masthead for every inner marketing page. */
export function PageHero({
  eyebrow,
  title,
  description,
  crumbs = [],
  children,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  crumbs?: Crumb[]
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={cn('relative overflow-hidden border-b border-border pt-32 pb-16 sm:pt-40 sm:pb-20', className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 surface-grid opacity-25 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute -top-32 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl animate-aurora" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {crumbs.length > 0 && (
          <motion.nav
            aria-label="Breadcrumb"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link to="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
            {crumbs.map((crumb) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                <ChevronRight className="size-3.5" />
                {crumb.href ? (
                  <Link to={crumb.href} className="transition-colors hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </motion.nav>
        )}

        <div className="flex max-w-3xl flex-col gap-5">
          {eyebrow && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              <Eyebrow>{eyebrow}</Eyebrow>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.08]"
          >
            {title}
          </motion.h1>

          {description && (
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              {description}
            </motion.p>
          )}

          {children && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.22 }}
              className="mt-2"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
