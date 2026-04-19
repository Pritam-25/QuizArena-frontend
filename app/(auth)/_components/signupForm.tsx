'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { SignupInput, signupSchema } from '@/lib/schemas/auth.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { PasswordInput } from './passwordInput';
import { Loader2 } from 'lucide-react';
import { usePostApiV1AuthRegister } from '@/api/auth/auth';
import { handleMutation } from '@/lib/api/mutationWrapper';
import { handleError } from '@/lib/api/handleError';

/**
 * SignUpForm Component
 *
 * @description
 * - Handles user registration using React Hook Form + Zod validation
 * - Uses React Query mutation (Orval generated)
 * - Displays validation + API errors
 * - Redirects user on successful signup
 *
 * @returns {JSX.Element}
 */
export function SignUpForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const router = useRouter();

  const { mutate, isPending } = usePostApiV1AuthRegister();

  /**
   * React Hook Form setup with Zod validation
   */
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  /**
   * Handles form submission
   *
   * @param {SignupInput} values - User registration credentials
   */
  const onSubmit = (values: SignupInput) => {
    mutate(
      { data: values },
      {
        onSuccess: res => {
          handleMutation(res, (_data, message) => {
            toast.success(message || 'Successfully signed up!');
            router.replace('/login');
          });
        },
        onError: handleError,
      }
    );
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="p-6 md:p-8 w-full"
          >
            <FieldGroup>
              <FieldSet>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold">Create your account</h1>
                    <p className="text-muted-foreground text-balance">
                      Sign up to start using Primetrade
                    </p>
                  </div>

                  {/* Username */}
                  <Field>
                    <FieldLabel htmlFor="username">Username</FieldLabel>
                    <Input
                      id="username"
                      placeholder="Your username"
                      autoFocus
                      {...form.register('username')}
                    />
                    {form.formState.errors.username && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.username.message as string}
                      </p>
                    )}
                  </Field>

                  {/* Email */}
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      {...form.register('email')}
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message as string}
                      </p>
                    )}
                  </Field>

                  {/* Password */}
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <PasswordInput
                      id="password"
                      placeholder="••••••••"
                      {...form.register('password')}
                    />
                    {form.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.password.message as string}
                      </p>
                    )}
                  </Field>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="w-full cursor-pointer"
                      disabled={form.formState.isSubmitting || isPending}
                    >
                      {form.formState.isSubmitting || isPending ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing up...
                        </span>
                      ) : (
                        'Sign Up'
                      )}
                    </Button>
                  </div>

                  <div className="text-center text-sm">
                    Already have an account?{' '}
                    <Link
                      href="/login"
                      className="underline underline-offset-4"
                    >
                      Log in
                    </Link>
                  </div>
                </div>
              </FieldSet>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
