import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { PageTransition } from '@/components/motion/page-transition'
import { PublicFooter } from '@/components/layout/public-footer'
import { PublicHeader } from '@/components/layout/public-header'

export function PublicLayout() {
  const { pathname, hash } = useLocation()

  // Restore the top of the page on navigation, but let in-page anchors win.
  useEffect(() => {
    if (hash) {
      const target = document.querySelector(hash)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <PageTransition />
      </main>
      <PublicFooter />
    </div>
  )
}
