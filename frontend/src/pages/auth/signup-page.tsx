import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { ArrowLeft, CheckCircle2, GraduationCap, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { PasswordInput } from '@/components/shared/password-input'
import { PasswordStrength } from '@/components/shared/password-strength'
import { authApi } from '@/features/auth/api'
import { RoleSelector, type AccountTypeOption } from '@/features/auth/role-selector'
import { signupSchema, type SignupValues } from '@/features/auth/schemas'
import { toErrorMessage } from '@/lib/api-client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
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
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>Start your Saylani bootcamp application — it's free</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <RoleSelector value={accountType} onChange={setAccountType} />

              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  autoComplete="name"
                  placeholder="e.g. Ayesha Siddiqui"
                  aria-invalid={!!errors.full_name}
                  {...register('full_name')}
                />
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name.message}</p>
                )}
              </div>

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
                <Label htmlFor="phone">
                  Phone <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="0300 1234567"
                  aria-invalid={!!errors.phone}
                  {...register('phone')}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <PasswordStrength value={password ?? ''} className="pt-1" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm password</Label>
                <PasswordInput
                  id="confirm_password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirm_password}
                  {...register('confirm_password')}
                />
                {errors.confirm_password && (
                  <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-11 w-full"
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Create account
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
