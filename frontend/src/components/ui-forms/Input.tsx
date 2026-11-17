import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { useFormContext } from "react-hook-form";

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "name" | "value" | "onChange"
> {
  name?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { name, className = "", dir, ...rest },
  ref,
) {
  const formContext = useFormContext();
  const reg = formContext && name ? formContext.register(name) : undefined;

  return (
    <input
      {...rest}
      {...(reg ?? {})}
      ref={(e) => {
        reg?.ref(e);
        if (typeof ref === "function") ref(e);
        else if (ref)
          (ref as React.MutableRefObject<HTMLInputElement | null>).current = e;
      }}
      dir={dir ?? "rtl"}
      autoComplete={rest.autoComplete ?? "off"}
      className={`form-control ${className}`.trim()}
    />
  );
});

Input.displayName = "Input";
export default Input;
