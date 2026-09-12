import { zodResolver } from '@hookform/resolvers/zod'
import {
  CheckCircle2,
  Lock,
  Mail,
  MailWarning,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { PasswordInput } from '@/components/shared/password-input'
import { AuthDivider, AuthField, AuthLayout } from '@/features/auth/auth-layout'
import { authApi } from '@/features/auth/api'
import { OAuthButtons } from '@/features/auth/oauth-buttons'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { useAuth } from '@/hooks/use-auth'
import { toErrorCode, toErrorMessage } from '@/lib/api-client'
import { HOME_BY_ROLE } from '@/lib/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  /* Kept beside the message because the unverified-email case is the one
     failure the user can act on from here, and it needs its own affordance. */
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resendNote, setResendNote] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state?.signupEmail ?? '', password: '' },
  })

  const onSubmit = async (values: LoginValues) => {
    setFormError(null)
    setErrorCode(null)
    setResendState('idle')
    setResendNote(null)
    try {
      const profile = await login(values.email, values.password)
      navigate(state?.from?.pathname ?? HOME_BY_ROLE[profile.role], { replace: true })
    } catch (error) {
      setFormError(toErrorMessage(error, 'Could not sign you in.'))
      setErrorCode(toErrorCode(error))
    }
  }

  /* The account exists but the address was never confirmed, and nothing else
     in the product re-sends that email. Without this the user is stuck. */
  const onResend = async () => {
    setResendState('sending')
    setResendNote(null)
    try {
      const { message } = await authApi.resendConfirmation(getValues('email'))
      setResendState('sent')
      setResendNote(message)
    } catch (error) {
      setResendState('idle')
      setResendNote(toErrorMessage(error, 'Could not send that email. Please try again.'))
    }
  }

  return (
    <AuthLayout title="Sign In" subtitle="Sign in to track your bootcamp application">
      <OAuthButtons />
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Shown after signup hands the user here. Names the address the mail
            went to, because the most common failure is a typo in it, and says
            to check spam, because the second most common is a filter. */}
        {state?.signupEmail && !formError && (
          <Alert className="border-success/35 bg-success/5">
            <CheckCircle2 className="size-4 text-success" />
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>
              Your account is created. We have sent a confirmation email to{' '}
              <span className="font-medium text-foreground">{state.signupEmail}</span>.
              Open it to confirm your address, then sign in below. If it is not
              there in a few minutes, check your spam folder.
            </AlertDescription>
          </Alert>
        )}

        {formError && errorCode !== 'email_not_verified' && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {/* Unverified email is a dead end without a way out: the account is
            real, the password was right, and the only thing standing in the
            way is an email that may never have arrived. */}
        {formError && errorCode === 'email_not_verified' && (
          <Alert className="border-warning/40 bg-warning/5">
            <MailWarning className="size-4 text-warning" />
            <AlertTitle>Confirm your email first</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>{formError}</span>
              {resendState === 'sent' ? (
                <span className="text-sm font-medium text-success">{resendNote}</span>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={onResend}
                    disabled={resendState === 'sending'}
                  >
                    {resendState === 'sending' ? (
                      <>
                        Sending...
                      </>
                    ) : (
                      'Resend confirmation email'
                    )}
                  </Button>
                  {resendNote && (
                    <span className="text-sm text-destructive">{resendNote}</span>
                  )}
                </>
              )}
            </AlertDescription>
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
