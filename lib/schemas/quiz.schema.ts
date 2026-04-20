import { z } from 'zod';

/**
 * Request body schema for creating a quiz.
 */
export const createQuizSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters long')
    .max(100, 'Title must be less than 100 characters long'),
  description: z
    .string()
    .trim()
    .refine(val => val.length === 0 || val.length >= 10, {
      message: 'Description must be at least 10 characters long',
    })
    .max(200, 'Description must be less than 200 characters long')
    .optional(),
  isPublished: z.boolean().default(false),
});

export type CreateQuizInput = z.input<typeof createQuizSchema>;

export const QuestionType = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'TRUE_FALSE',
  MULTI_SELECT: 'MULTI_SELECT',
  FILL_IN_THE_BLANK: 'FILL_IN_THE_BLANK',
} as const;

const fractionalOrderSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z]+$/, 'order anchors must contain only lowercase letters');

/**
 * Request body schema for adding a question to a quiz.
 */
export const addQuestionSchema = z
  .object({
    questionText: z
      .string()
      .trim()
      .min(3, 'Question text must be at least 3 characters long'),
    type: z.enum(QuestionType).default(QuestionType.MCQ),
    timeLimit: z.number().int().nonnegative().default(30), // default 30 seconds
    points: z.number().int().nonnegative().default(1),
    prevOrder: fractionalOrderSchema.optional(),
    nextOrder: fractionalOrderSchema.optional(),
  })
  .refine(
    data =>
      !data.prevOrder || !data.nextOrder || data.prevOrder < data.nextOrder,
    {
      path: ['prevOrder'],
      message: 'prevOrder must be lexicographically less than nextOrder',
    }
  );

/**
 * Request body schema for reordering an existing question using fractional anchors.
 * At least one anchor must be provided:
 * - prevOrder only: move to end
 * - nextOrder only: move to start
 * - both: move between anchors
 */
export const reorderQuestionSchema = z
  .object({
    prevReorderToken: fractionalOrderSchema.optional(),
    nextReorderToken: fractionalOrderSchema.optional(),
  })
  .refine(data => !!data.prevReorderToken || !!data.nextReorderToken, {
    path: ['prevReorderToken'],
    message: 'Either prevReorderToken or nextReorderToken is required',
  })
  .refine(
    data =>
      !data.prevReorderToken ||
      !data.nextReorderToken ||
      data.prevReorderToken < data.nextReorderToken,
    {
      path: ['prevReorderToken'],
      message:
        'prevReorderToken must be lexicographically less than nextReorderToken',
    }
  );

/**
 * Request body schema for adding a single option.
 */
export const addOptionsSchema = z.object({
  optionText: z.string().min(1).max(200).trim(),
  isCorrect: z.boolean().default(false),
});

export type CreateQuizInputDto = z.infer<typeof createQuizSchema>;
/**
 * Service-layer quiz payload that includes creator identity.
 */
export type CreateQuizDto = CreateQuizInputDto & { createdBy: string };
export type AddQuestionDto = z.infer<typeof addQuestionSchema>;
export type AddQuestionInputDto = Omit<
  AddQuestionDto,
  'prevOrder' | 'nextOrder'
>;
export type ReorderQuestionDto = z.infer<typeof reorderQuestionSchema>;
export type AddOptionsDto = z.infer<typeof addOptionsSchema>;
