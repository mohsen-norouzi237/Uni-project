import React, { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { useFormContext } from "react-hook-form";

export interface TextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "name" | "value" | "onChange"
> {
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ name, className = "", dir, ...rest }, ref) {
    const formContext = useFormContext();
    const reg = formContext && name ? formContext.register(name) : undefined;

    return (
      <textarea
        {...rest}
        {...(reg ?? {})}
        ref={(e) => {
          reg?.ref(e);
          if (typeof ref === "function") ref(e);
          else if (ref)
            (
              ref as React.MutableRefObject<HTMLTextAreaElement | null>
            ).current = e;
        }}
        dir={dir ?? "rtl"}
        className={`form-control ${className}`.trim()}
      />
    );
  },
);

Textarea.displayName = "Textarea";
export default Textarea;
