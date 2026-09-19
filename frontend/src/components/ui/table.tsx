import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Every table in the app is wide enough, on a narrow screen, to need this
 * container's horizontal scroll — but a plain `overflow-x-auto` div gives no
 * hint that there's more to the right. A candidate row would end at "AI
 * score" and just look cut off, not scrollable. These two edge fades are the
 * hint: present only on the side that actually has more content, so they
 * double as a real signal (both gone means you're seeing the whole table),
 * not decoration.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const updateFades = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    updateFades()
    // Content can change width after mount (data loads, columns hide/show at
    // a breakpoint) without the container itself resizing, so this watches
    // the table's own size rather than only listening for scroll/resize.
    const observer = new ResizeObserver(updateFades)
    observer.observe(el)
    el.addEventListener('scroll', updateFades, { passive: true })
    window.addEventListener('resize', updateFades)
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', updateFades)
      window.removeEventListener('resize', updateFades)
    }
  }, [updateFades])

  return (
    <div data-slot="table-container" className="relative w-full">
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-card to-transparent transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-card to-transparent transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div ref={containerRef} className="overflow-x-auto">
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * A row's own styling, exported so an animated row (a `motion.tr`, which
 * cannot be a `TableRow`) can wear exactly these classes rather than a copy
 * that drifts from them. See components/motion/table-row.tsx.
 */
const tableRowClass =
  "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted"

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn(tableRowClass, className)} {...props} />
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  tableRowClass,
}
