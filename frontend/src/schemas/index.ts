/**
 * Zod schemas barrel.
 *
 * `course.schema.ts` and `application.schema.ts` were deleted: they described
 * shapes the backend never had (course "levels"/"statuses", application
 * types) and nothing imported them — dead code flagged by the audit.
 */
export {
  normalizeDigits,
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.schema";

export type {
  LoginInput,
  LoginData,
  RegisterInput,
  RegisterData,
  ForgotPasswordInput,
  ForgotPasswordData,
  ResetPasswordInput,
  ResetPasswordData,
  ChangePasswordInput,
  ChangePasswordData,
} from "./auth.schema";
