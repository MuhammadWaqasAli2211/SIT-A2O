import { useContext } from 'react'

import { BootcampContext } from '@/features/admin/bootcamp-context'

export function useBootcamp() {
  const context = useContext(BootcampContext)
  if (!context) {
    throw new Error('useBootcamp must be used inside a BootcampProvider.')
  }
  return context
}
