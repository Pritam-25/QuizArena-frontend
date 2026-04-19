import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CreateQuizInput, createQuizSchema } from "@/lib/schemas/index";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { useCreateQuiz } from "@/features/quiz/hooks/useCreateQuiz";

/**
 * CreateQuizModal Component
 *
 * @description
 * - Handles quiz creation using React Hook Form + Zod validation
 * - Uses React Query mutation (Orval generated)
 * - Displays validation + API errors
 * - Redirects user on successful quiz creation
 */
export default function CreateQuizModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  /**
   * React Hook Form setup with Zod validation
   * @param {CreateQuizSchema} - Zod schema for quiz creation form validation
   * - Ensures form data adheres to expected structure before submission
   * - Provides form state management (e.g., errors, isSubmitting)
   */
  const form = useForm<CreateQuizInput>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: {
      title: "Untitled Quiz",
      description: undefined,
    },
  });

  /**
   * @param {useCreateQuiz} - Custom hook for quiz creation (React Query mutation)
   * - Abstracts API call, success handling (toast + redirect), and error handling
   */
  const { mutate, isPending } = useCreateQuiz();

  /**
   * Handles form submission
   *
   * @param {CreateQuizInput} values - Quiz creation data
   */
  const onSubmit = (values: CreateQuizInput) => {
    mutate({ data: values });
  };

  function handleOpenChange(open: boolean) {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Create New Quiz</DialogTitle>
          <DialogDescription>
            What would you like to name your new quiz?
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FieldGroup>
            <FieldSet>
              <div className="flex flex-col gap-6">
                <Field>
                  <FieldLabel htmlFor="title">Quiz Title</FieldLabel>
                  <Input
                    id="title"
                    placeholder="Quiz Title"
                    {...form.register("title")}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.title.message as string}
                    </p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Input
                    id="description"
                    placeholder="Quiz Description"
                    {...form.register("description")}
                  />
                  {form.formState.errors.description && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.description.message as string}
                    </p>
                  )}
                </Field>
                {/* isPublished removed, only title and description remain */}
                <DialogFooter>
                  <Button
                    disabled={form.formState.isSubmitting || isPending}
                    type="submit"
                  >
                    {form.formState.isSubmitting || isPending
                      ? "Saving..."
                      : "Save Quiz"}
                  </Button>
                </DialogFooter>
              </div>
            </FieldSet>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
