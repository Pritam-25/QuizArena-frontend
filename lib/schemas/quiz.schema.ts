import { z } from 'zod';

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
