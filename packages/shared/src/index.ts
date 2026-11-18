import { z } from 'zod';

export const USER_ROLES = ['admin', 'user'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters'); // batas bcrypt

export const createUserSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(150),
  email: z.email('Invalid email').transform((v) => v.toLowerCase()),
  password,
  role: userRoleSchema.default('user'),
  isActive: z.boolean().default(true),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// Didefinisikan eksplisit TANPA default — field yang tidak dikirim tidak boleh ikut berubah.
export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required').max(150).optional(),
    email: z.email('Invalid email').transform((v) => v.toLowerCase()).optional(),
    password: password.optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'At least one field is required');
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Bentuk user yang dikirim ke client — tanpa password. */
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- Auth ----------
export const loginSchema = z.object({
  email: z.email('Format email tidak valid').transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password wajib diisi'),
  rememberMe: z.boolean().default(false),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginPayload = z.output<typeof loginSchema>;

export interface AuthResponse {
  user: User;
}

export * from './pagination';
export * from './data-url';

export * from './settings';
export * from './analytics';
