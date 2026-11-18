import React, { useId } from "react";
import {
  get,
  useFormContext,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

export interface FormFieldError {
  message?: string;
  [key: string]: unknown;
}

export interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
  label?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function useFormFieldError<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(name: TName): FormFieldError | undefined {
  const formContext = useFormContext<TFieldValues>();
  if (!formContext) return undefined;
  return get(formContext.formState.errors, name) as FormFieldError | undefined;
}

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  label,
  helperText,
  required = false,
  className = "",
  children,
}: FormFieldProps<TFieldValues, TName>) {
  const generatedId = useId();

  const safeName = String(name).replace(/\./g, "-");
  const fieldId = `field-${safeName}-${generatedId}`;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  const error = useFormFieldError<TFieldValues, TName>(name);
  const errorMessage =
    typeof error?.message === "string" ? error.message : undefined;

  const hasError = Boolean(errorMessage);

  const describedBy: string[] = [];
  if (hasError) describedBy.push(errorId);
  if (helperText) describedBy.push(helperId);
  const ariaDescribedBy =
    describedBy.length > 0 ? describedBy.join(" ") : undefined;

  const childElement = React.isValidElement(children)
    ? (children as React.ReactElement<Record<string, unknown>>)
    : null;

  const childProps = childElement?.props ?? {};

  const mergedProps: Record<string, unknown> = {
    ...childProps,
    id: (childProps.id as string | undefined) ?? fieldId,
    "aria-invalid": hasError || undefined,
    "aria-describedby":
      (childProps["aria-describedby"] as string | undefined) ?? ariaDescribedBy,
  };

  const renderedChild = childElement
    ? React.cloneElement(childElement, mergedProps)
    : children;

  return (
    <div
      className={`form-field ${hasError ? "has-error" : ""} ${className}`.trim()}
      data-invalid={hasError ? "true" : undefined}
    >
      {label && (
        <label htmlFor={fieldId} className="form-field__label">
          {label}
          {required && (
            <span className="form-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="form-field__control">{renderedChild}</div>

      {hasError && (
        <p id={errorId} className="form-field__error" role="alert">
          {errorMessage}
        </p>
      )}

      {!hasError && helperText && (
        <p id={helperId} className="form-field__helper">
          {helperText}
        </p>
      )}
    </div>
  );
}

export default FormField;
