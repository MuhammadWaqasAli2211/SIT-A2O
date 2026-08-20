import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { ArrowLeft, CheckCircle2, GraduationCap, Loader2, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { PasswordInput } from '@/components/shared/password-input'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { useAuth } from '@/hooks/use-auth'
import { toErrorMessage } from '@/lib/api-client'
import { HOME_BY_ROLE } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginLocationState {
  /** Set by the signup flow so we can confirm the account was created. */
  signupEmail?: string
  /** Set by ProtectedRoute so we can return the user where they were headed. */
  from?: { pathname: string }
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LoginLocationState | null

  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state?.signupEmail ?? '', password: '' },
  })

  const onSubmit = async (values: LoginValues) => {
    setFormError(null)
    try {
      const profile = await login(values.email, values.password)
      navigate(state?.from?.pathname ?? HOME_BY_ROLE[profile.role], { replace: true })
    } catch (error) {
      setFormError(toErrorMessage(error, 'Could not sign you in.'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to site
        </Link>

        <Card>
          <CardHeader className="space-y-2 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-6" />
            </span>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to track your bootcamp application</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
              {state?.signupEmail && !formError && (
                <Alert className="border-success/35 bg-success/5">
                  <CheckCircle2 className="size-4 text-success" />
                  <AlertDescription>
                    Account created. Check your email to confirm your address, then sign in.
                  </AlertDescription>
                </Alert>
              )}

              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Sign in
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/signup" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
