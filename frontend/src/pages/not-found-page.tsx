import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-medium">This page does not exist</h1>
      <Button render={<Link to="/" />} variant="outline">
        Back to safety
      </Button>
    </div>
  )
}
