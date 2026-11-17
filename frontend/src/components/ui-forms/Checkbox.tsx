import { forwardRef, useId } from "react";
import type { ChangeEvent, InputHTMLAttributes } from "react";
import { useFormContext } from "react-hook-form";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "name" | "value" | "onChange" | "type"
> {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ name, label, className = "", id, ...rest }, ref) {
    const formContext = useFormContext();
    const reg = formContext && name ? formContext.register(name) : undefined;
    const autoId = useId();
    const inputId = id ?? `chk-${name ?? "field"}-${autoId}`;

    return (
      <label
        className={`form-checkbox ${className}`.trim()}
        htmlFor={inputId}
        dir="rtl"
      >
        <input
          {...rest}
          {...(reg ?? {})}
          ref={(e) => {
            reg?.ref(e);
            if (typeof ref === "function") ref(e);
            else if (ref)
              (ref as React.MutableRefObject<HTMLInputElement | null>).current =
                e;
          }}
          id={inputId}
          type="checkbox"
        />
        {label && <span className="form-checkbox-label">{label}</span>}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
export default Checkbox;
