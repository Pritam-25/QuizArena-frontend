import { z } from 'zod';

// Password Validation Schema
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[@$#!%*~?&/\\(){}[\]]/,
    'Password must contain at least one special character'
  );

// Signup Schema
export const signupSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters'),

  email: z.email('Invalid email format'),

  password: passwordSchema,
});

// Login Schema
export const loginSchema = z.object({
  email: z.email('Invalid email format'),
  password: z.string().min(6, 'Invalid Credentials'),
});

export type SignupInput = z.input<typeof signupSchema>;
export type LoginInput = z.input<typeof loginSchema>;

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(30, 'Title must not exceed 30 characters'),

  description: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(30, 'Title must not exceed 30 characters'),

  description: z.string().optional(),
  status: z.enum(['PENDING', 'COMPLETED']),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const updateUserProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters'),

  email: z.email('Invalid email format'),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
