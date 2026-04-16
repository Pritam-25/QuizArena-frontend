"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { loginSchema, LoginInput } from "@/lib/schemas/auth.schema";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { PasswordInput } from "./passwordInput";
import { Loader2 } from "lucide-react";
import { usePostApiV1AuthLogin } from "@/api/auth/auth";
import { handleMutation } from "@/lib/api/mutationWrapper";
import { handleError } from "@/lib/api/handleError";

/**
 * LoginForm Component
 *
 * @description
 * - Handles user login using React Hook Form + Zod validation
 * - Uses React Query mutation (Orval generated)
 * - Displays validation + API errors
 * - Redirects user on successful login
 *
 * @returns {JSX.Element}
 */
export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();

  /**
   * React Hook Form setup with Zod validation
   */
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  /**
   * React Query mutation for login
   */
  const { mutate, isPending } = usePostApiV1AuthLogin();

  /**
   * Handles form submission
   *
   * @param {LoginInput} values - User login credentials
   */
  const onSubmit = (values: LoginInput) => {
    mutate(
      { data: values },
      {
        onSuccess: (res) => {
          handleMutation(res, (_data, message) => {
            toast.success(message || "Login successful");
            router.replace("/");
          });
        },
        onError: handleError,
      }
    );
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="p-6 md:p-8 w-full"
          >
            <FieldGroup>
              <FieldSet>
                <div className="flex flex-col gap-6">
                  {/* Header */}
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold">Welcome back</h1>
                    <p className="text-muted-foreground text-balance">
                      Login to your Primetrade account
                    </p>
                  </div>

                  {/* Email */}
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      autoFocus
                      {...form.register("email")}
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
                      {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.password.message as string}
                      </p>
                    )}
                  </Field>

                  {/* Submit */}
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="w-full cursor-pointer"
                      disabled={form.formState.isSubmitting || isPending}
                    >
                      {form.formState.isSubmitting || isPending ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Logging in...
                        </span>
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-sm">
                    Don&apos;t have an account?{" "}
                    <Link
                      href="/signup"
                      className="underline underline-offset-4"
                    >
                      Sign up
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
