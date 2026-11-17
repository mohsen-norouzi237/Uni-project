import { z } from "zod";

export const normalizeDigits = (value: string): string =>
  value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const iranianPhoneRegex = /^09\d{9}$/;
const nationalIdRegex = /^\d{10}$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const loginSchema = z.object({
  identifier: z
    .string({ message: "لطفاً ایمیل یا شماره موبایل خود را وارد کنید." })
    .min(1, "این فیلد الزامی است.")
    .transform(normalizeDigits),
  password: z
    .string({ message: "رمز عبور را وارد کنید." })
    .min(1, "رمز عبور الزامی است."),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginData = z.output<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z
      .string({ message: "نام الزامی است." })
      .min(2, "نام باید حداقل ۲ کاراکتر باشد.")
      .max(50, "نام حداکثر ۵۰ کاراکتر است.")
      .regex(
        /^[\u0600-\u06FF\u200C\s]+$/,
        "نام فقط باید شامل حروف فارسی باشد.",
      ),
    lastName: z
      .string({ message: "نام خانوادگی الزامی است." })
      .min(2, "نام خانوادگی باید حداقل ۲ کاراکتر باشد.")
      .max(50, "نام خانوادگی حداکثر ۵۰ کاراکتر است.")
      .regex(
        /^[\u0600-\u06FF\u200C\s]+$/,
        "نام خانوادگی فقط باید شامل حروف فارسی باشد.",
      ),
    nationalId: z
      .string({ message: "کد ملی الزامی است." })
      .transform(normalizeDigits)
      .pipe(
        z.string().regex(nationalIdRegex, "کد ملی باید دقیقاً ۱۰ رقم باشد."),
      ),
    phone: z
      .string({ message: "شماره موبایل الزامی است." })
      .transform(normalizeDigits)
      .pipe(
        z
          .string()
          .regex(
            iranianPhoneRegex,
            "شماره موبایل نامعتبر است (مثال: 09123456789).",
          ),
      ),
    email: z
      .string({ message: "ایمیل الزامی است." })
      .email("قالب آدرس ایمیل نامعتبر است."),
    password: z
      .string({ message: "رمز عبور الزامی است." })
      .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
      .regex(
        passwordRegex,
        "رمز عبور باید شامل حروف بزرگ و کوچک انگلیسی، عدد و کاراکتر خاص (@$!%*?&) باشد.",
      ),
    confirmPassword: z.string({ message: "تکرار رمز عبور الزامی است." }),
    acceptTerms: z.literal(true, {
      message: "پذیرش قوانین و مقررات الزامی است.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z
    .string({ message: "لطفاً شماره موبایل یا ایمیل خود را وارد کنید." })
    .min(1, "این فیلد الزامی است.")
    .transform(normalizeDigits),
});

export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ForgotPasswordData = z.output<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    otp: z
      .string({ message: "کد تأیید الزامی است." })
      .transform(normalizeDigits)
      .pipe(
        z
          .string()
          .length(6, "کد تأیید باید ۶ رقم باشد.")
          .regex(/^\d+$/, "کد تأیید فقط باید شامل اعداد باشد."),
      ),
    password: z
      .string({ message: "رمز عبور الزامی است." })
      .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
      .regex(
        passwordRegex,
        "رمز عبور باید شامل حروف بزرگ و کوچک انگلیسی، عدد و کاراکتر خاص باشد.",
      ),
    confirmPassword: z.string({ message: "تکرار رمز عبور الزامی است." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند.",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordData = z.output<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ message: "رمز عبور فعلی الزامی است." })
      .min(1, "رمز عبور فعلی را وارد کنید."),
    newPassword: z
      .string({ message: "رمز عبور جدید الزامی است." })
      .min(8, "رمز عبور جدید باید حداقل ۸ کاراکتر باشد.")
      .regex(
        passwordRegex,
        "رمز عبور جدید باید شامل حروف بزرگ و کوچک، عدد و نماد باشد.",
      ),
    confirmNewPassword: z.string({
      message: "تکرار رمز عبور جدید الزامی است.",
    }),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "رمز عبور جدید نباید مشابه رمز عبور فعلی باشد.",
    path: ["newPassword"],
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "رمز عبور جدید و تکرار آن یکسان نیستند.",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordData = z.output<typeof changePasswordSchema>;
