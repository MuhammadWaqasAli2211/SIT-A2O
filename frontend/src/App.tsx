import { RouterProvider } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/auth-context'
import { ThemeProvider } from '@/features/theme/theme-context'
import { router } from '@/routes'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}
