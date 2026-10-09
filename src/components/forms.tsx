"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const FormContext = createContext<{ state: FormState; pending: boolean }>({ state: initialFormState, pending: false });

export const useFormContext = () => useContext(FormContext);

export function FormAlert({ state, compact = false }: { state: FormState; compact?: boolean }) {
  if (!state.message) return null;
  const Icon = state.ok ? CheckCircle2 : AlertCircle;
  if (compact) {
    return (
      <p role={state.ok ? "status" : "alert"} className={`text-xs font-medium ${state.ok ? "text-emerald-600" : "text-red-500"}`}>
        {state.message}
      </p>
    );
  }
  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
        state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{state.message}</span>
    </div>
  );
}

type ActionFormProps = {
  action: Action;
  children: ReactNode;
  className?: string;
  /** Clear the fields after a successful submission. */
  resetOnSuccess?: boolean;
  /** Render the result message as small inline text (for one-button forms). */
  compact?: boolean;
  /** Where the message appears relative to the fields. */
  messagePosition?: "top" | "bottom";
  /** Ask for confirmation before submitting (destructive actions). */
  confirm?: string;
};

/**
 * Form wired to a server action. Field values are preserved when validation
 * fails, errors are announced, and submit buttons show a pending state.
 */
export function ActionForm({ action, children, className, resetOnSuccess, compact, messagePosition = "top", confirm }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  const alert = <FormAlert state={state} compact={compact} />;
  return (
    <FormContext.Provider value={{ state, pending }}>
      <form ref={ref} action={formAction} onSubmit={onSubmit} className={className} noValidate>
        {messagePosition === "top" && state.message && <div className={`col-span-full ${compact ? "mb-1" : "mb-5"}`}>{alert}</div>}
        {children}
        {messagePosition === "bottom" && state.message && <div className={`col-span-full ${compact ? "mt-1.5" : "mt-4"}`}>{alert}</div>}
      </form>
    </FormContext.Provider>
  );
}

export function SubmitButton({
  children,
  className = "btn btn-gold",
  pendingText,
  disabled,
  ...props
}: ComponentProps<"button"> & { pendingText?: string }) {
  const { pending } = useFormContext();
  return (
    <button type="submit" className={className} aria-busy={pending} {...props} disabled={pending || disabled}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  className?: string;
};

function useField(name: string) {
  const id = useId();
  const { state } = useFormContext();
  const error = state.errors?.[name];
  return { id, error, describedBy: error ? `${id}-error` : undefined };
}

export function TextField({ name, label, hint, className, ...props }: FieldProps & Omit<ComponentProps<"input">, "name" | "className">) {
  const { id, error, describedBy } = useField(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} name={name} className={`input ${error ? "input-error" : ""}`} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

export function TextAreaField({ name, label, hint, className, ...props }: FieldProps & Omit<ComponentProps<"textarea">, "name" | "className">) {
  const { id, error, describedBy } = useField(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <textarea id={id} name={name} rows={4} className={`input ${error ? "input-error" : ""}`} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

export function SelectField({
  name,
  label,
  hint,
  className,
  children,
  ...props
}: FieldProps & Omit<ComponentProps<"select">, "name" | "className">) {
  const { id, error, describedBy } = useField(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} name={name} className={`input ${error ? "input-error" : ""}`} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props}>
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  ...props
}: { name: string; label: ReactNode; hint?: string } & Omit<ComponentProps<"input">, "name" | "type">) {
  const { id, error } = useField(name);
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
        <input id={id} name={name} type="checkbox" className="checkbox mt-0.5" {...props} />
        <span>
          {label}
          {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
        </span>
      </label>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
