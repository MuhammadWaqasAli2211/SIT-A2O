import { AnimatePresence, motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
      className={cn(
        'relative grid size-9 place-items-center overflow-hidden rounded-lg border border-border',
        'text-foreground transition-colors hover:bg-muted',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={resolved}
          initial={{ y: -18, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 18, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="grid place-items-center"
        >
          {resolved === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
