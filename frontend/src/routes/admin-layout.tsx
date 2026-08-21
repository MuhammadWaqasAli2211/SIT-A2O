import { Outlet } from 'react-router-dom'

import { BootcampProvider } from '@/features/admin/bootcamp-context'

/**
 * Layout route holding the selected-intake state for the whole admin section.
 *
 * A layout route rather than a wrapper inside each page, so switching from
 * Candidates to Interviews does not remount the provider and re-fetch the
 * bootcamp list on every navigation.
 */
export function AdminBootcampLayout() {
  return (
    <BootcampProvider>
      <Outlet />
    </BootcampProvider>
  )
}
