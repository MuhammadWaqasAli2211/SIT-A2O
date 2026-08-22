import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Lock, Mail, Phone, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { PasswordInput } from '@/components/shared/password-input'
import { PasswordStrength } from '@/components/shared/password-strength'
import { authApi } from '@/features/auth/api'
import { AuthDivider, AuthField, AuthLayout } from '@/features/auth/auth-layout'
import { OAuthButtons } from '@/features/auth/oauth-buttons'
import { RoleSelector, type AccountTypeOption } from '@/features/auth/role-selector'
import { signupSchema, type SignupValues } from '@/features/auth/schemas'
import { toErrorMessage } from '@/lib/api-client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SignupPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<AccountTypeOption['id']>('student')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    // Validate as the user types so the checklist and the submit button stay
    // in step with what has actually been entered.
    mode: 'onChange',
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
    },
  })

  const password = watch('password')

  const onSubmit = async (values: SignupValues) => {
    setFormError(null)
    try {
      await authApi.signup({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        phone: values.phone?.trim() || undefined,
      })

      // Deliberately no auto-login: the account must be email-confirmed first,
      // so we hand the user to /login with a success notice.
      navigate('/login', {
        replace: true,
        state: { signupEmail: values.email },
      })
    } catch (error) {
      setFormError(toErrorMessage(error, 'Could not create your account.'))
    }
  }

  return (
    <AuthLayout title="Sign Up" subtitle="Start your Saylani bootcamp application — it's free">
      <OAuthButtons />
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <RoleSelector value={accountType} onChange={setAccountType} />

        <AuthField
          id="full_name"
          label="Full name"
          icon={User}
          required
          error={errors.full_name?.message}
        >
          <Input
            id="full_name"
            autoComplete="name"
            placeholder="e.g. Ayesha Siddiqui"
            className="h-11 rounded-xl pl-10"
            aria-invalid={!!errors.full_name}
            {...register('full_name')}
          />
        </AuthField>

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
          id="phone"
          label="Phone"
          icon={Phone}
          error={errors.phone?.message}
          hint={<span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
        >
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="0300 1234567"
            className="h-11 rounded-xl pl-10"
            aria-invalid={!!errors.phone}
            {...register('phone')}
          />
        </AuthField>

        <AuthField id="password" label="Password" icon={Lock} required>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            className="h-11 rounded-xl pl-10"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </AuthField>
        <PasswordStrength value={password ?? ''} className="-mt-1.5" />

        <AuthField
          id="confirm_password"
          label="Confirm password"
          icon={Lock}
          required
          error={errors.confirm_password?.message}
        >
          <PasswordInput
            id="confirm_password"
            autoComplete="new-password"
            className="h-11 rounded-xl pl-10"
            aria-invalid={!!errors.confirm_password}
            {...register('confirm_password')}
          />
        </AuthField>

        <Button
          type="submit"
          size="lg"
          className="mt-1 h-11 w-full rounded-full"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Sign Up'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
