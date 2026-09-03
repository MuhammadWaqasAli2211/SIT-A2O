import { LogOut } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { BRAND_ACCENT, BRAND_PRIMARY, BrandMark } from '@/features/marketing/brand'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CANDIDATE: 'Candidate',
}

export function AppShell() {
  const { profile, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center text-primary">
              <BrandMark />
            </span>
            <span className="font-semibold">
              {BRAND_PRIMARY} <span className="text-primary">{BRAND_ACCENT}</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight">{profile.full_name ?? profile.email}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[profile.role] ?? profile.role}</p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
