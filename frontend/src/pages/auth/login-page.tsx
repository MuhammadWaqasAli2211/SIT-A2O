import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { PasswordInput } from '@/components/shared/password-input'
import { AuthDivider, AuthField, AuthLayout } from '@/features/auth/auth-layout'
import { OAuthButtons } from '@/features/auth/oauth-buttons'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { useAuth } from '@/hooks/use-auth'
import { toErrorMessage } from '@/lib/api-client'
import { HOME_BY_ROLE } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    <AuthLayout title="Sign In" subtitle="Sign in to track your bootcamp application">
      <OAuthButtons />
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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

        <AuthField id="email" label="Email" icon={Mail} required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 rounded-xl pl-10"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </AuthField>

        <AuthField
          id="password"
          label="Password"
          icon={Lock}
          required
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            className="h-11 rounded-xl pl-10"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </AuthField>

        <Button
          type="submit"
          size="lg"
          className="mt-1 h-11 w-full rounded-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
