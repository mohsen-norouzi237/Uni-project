import React, { forwardRef } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { useFormContext } from "react-hook-form";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "name" | "value" | "onChange"
> {
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: readonly SelectOption[];
  placeholder?: string;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { name, options, placeholder, children, className = "", dir, ...rest },
    ref,
  ) {
    const formContext = useFormContext();
    const reg = formContext && name ? formContext.register(name) : undefined;

    return (
      <span className="form-select-wrap">
        <select
          {...rest}
          {...(reg ?? {})}
          ref={(e) => {
            reg?.ref(e);
            if (typeof ref === "function") ref(e);
            else if (ref)
              (
                ref as React.MutableRefObject<HTMLSelectElement | null>
              ).current = e;
          }}
          dir={dir ?? "rtl"}
          className={`form-control ${className}`.trim()}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <span className="select-chevron" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </span>
    );
  },
);

Select.displayName = "Select";
export default Select;
