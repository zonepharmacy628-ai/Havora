"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Clock, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { createCategoryAction, getCategoryUploadSignatureAction, reviewCategoryRequestAction } from "@/actions/category";
import type { CategoryFormData, CategoryOption, CategoryRequest } from "@/lib/categories";
import { ALLOWED_IMAGE_HOSTS } from "@/lib/constants";
import { useFormContext } from "./forms";

type Props = {
  data: CategoryFormData;
  defaultValue?: string | null;
  /** Administrators create categories directly; owners submit a request. */
  isAdmin: boolean;
  uploadsEnabled: boolean;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const byName = (a: CategoryOption, b: CategoryOption) => a.name.localeCompare(b.name);

/**
 * Category selector for the Add / Edit Property form, with "+ Create New
 * Category" beside it. The dialog's inputs have no `name`, so they are never
 * part of the property form's own submission and opening or closing it leaves
 * every other field exactly as it was.
 */
export function CategoryField({ data, defaultValue, isAdmin, uploadsEnabled }: Props) {
  const selectId = useId();
  const { state } = useFormContext();
  const fieldError = state.errors?.categoryId;

  const [options, setOptions] = useState<CategoryOption[]>(data.active);
  const [pending, setPending] = useState<CategoryOption[]>(data.myPending);
  const [requests, setRequests] = useState<CategoryRequest[]>(data.toReview);
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "pending" | "error"; text: string } | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [declining, setDeclining] = useState<{ id: string; reason: string } | null>(null);

  function onCreated(result: { status: "ACTIVE" | "PENDING"; category: CategoryOption; message: string }) {
    if (result.status === "ACTIVE") {
      setOptions((current) => [...current.filter((c) => c.id !== result.category.id), result.category].sort(byName));
      setValue(result.category.id); // select it for the property being added
      setNotice({ tone: "success", text: result.message });
    } else {
      setPending((current) => [result.category, ...current]);
      setNotice({ tone: "pending", text: result.message });
    }
    setOpen(false);
  }

  async function review(request: CategoryRequest, decision: "approve" | "reject", reason?: string) {
    setReviewing(request.id);
    const result = await reviewCategoryRequestAction(request.id, decision, reason).catch(() => null);
    setReviewing(null);
    if (!result || !result.ok) {
      setNotice({ tone: "error", text: result?.message ?? "Something went wrong. Please try again." });
      return;
    }
    setRequests((current) => current.filter((r) => r.id !== request.id));
    setDeclining(null);
    if (result.approved) setOptions((current) => [...current, result.category].sort(byName));
    setNotice({ tone: "success", text: result.message });
  }

  return (
    <div className="sm:col-span-2">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={selectId} className="label mb-0">
          Category
        </label>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-gold-700 hover:underline">
          <Plus className="size-3.5" aria-hidden="true" /> Create New Category
        </button>
      </div>
      <select
        id={selectId}
        name="categoryId"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={Boolean(fieldError)}
        className={`input mt-1.5 ${fieldError ? "input-error" : ""}`}
      >
        <option value="">Select a category…</option>
        {options.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
        {pending.length > 0 && (
          <optgroup label="Your requests — pending approval">
            {pending.map((category) => (
              <option key={category.id} value="" disabled>
                {category.name} (pending approval)
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {fieldError ? (
        <p className="field-error">{fieldError}</p>
      ) : (
        <p className="hint">
          {isAdmin ? "Can't find the right one? Create a new category — it is added for all hosts straight away." : "Can't find the right one? Request a new category — an administrator reviews it before it becomes available."}
        </p>
      )}

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mt-3 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : notice.tone === "pending"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.tone === "success" ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : notice.tone === "pending" ? <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
          <span>
            {notice.tone === "pending" && <strong>Pending approval. </strong>}
            {notice.text}
          </span>
        </p>
      )}

      {isAdmin && requests.length > 0 && (
        <div className="mt-3 rounded-lg border border-cream-200 bg-cream-50 p-3.5">
          <p className="text-[13px] font-semibold text-ink">Category requests from owners ({requests.length})</p>
          <ul className="mt-2 divide-y divide-cream-200">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-ink">{request.name}</span>
                  {request.requestedBy && <span className="text-muted"> · requested by {request.requestedBy}</span>}
                  {request.description && <span className="block text-xs text-muted">{request.description}</span>}
                </span>
                {declining?.id === request.id ? (
                  <span className="flex w-full flex-col gap-2 sm:flex-row">
                    <input
                      autoFocus
                      value={declining.reason}
                      onChange={(event) => setDeclining({ id: request.id, reason: event.target.value })}
                      onKeyDown={(event) => {
                        // Enter declines the request; it must never submit the property form.
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void review(request, "reject", declining.reason);
                        }
                      }}
                      maxLength={200}
                      placeholder="Reason shown to the owner"
                      aria-label={`Reason for declining ${request.name}`}
                      className="input flex-1 py-1.5 text-[13px]"
                    />
                    <span className="flex shrink-0 gap-1.5">
                      <button type="button" disabled={reviewing === request.id} onClick={() => review(request, "reject", declining.reason)} className="btn btn-danger btn-sm">
                        {reviewing === request.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null} Confirm decline
                      </button>
                      <button type="button" onClick={() => setDeclining(null)} className="btn btn-outline btn-sm">
                        Cancel
                      </button>
                    </span>
                  </span>
                ) : (
                  <span className="flex shrink-0 gap-1.5">
                    <button type="button" disabled={reviewing === request.id} onClick={() => review(request, "approve")} className="btn btn-gold btn-sm">
                      {reviewing === request.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null} Approve
                    </button>
                    <button type="button" disabled={reviewing === request.id} onClick={() => setDeclining({ id: request.id, reason: "" })} className="btn btn-outline btn-sm">
                      Decline
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isAdmin && data.myDeclined.length > 0 && (
        <div className="mt-3 rounded-lg border border-cream-200 bg-cream-50 p-3.5">
          <p className="text-[13px] font-semibold text-ink">Declined category requests</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {data.myDeclined.map((request) => (
              <li key={request.id}>
                <span className="font-medium text-ink">{request.name}</span>
                <span className="text-muted"> — {request.reason ?? "No reason was given."}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && <CategoryDialog isAdmin={isAdmin} uploadsEnabled={uploadsEnabled} onClose={() => setOpen(false)} onCreated={onCreated} />}
    </div>
  );
}

type DialogProps = {
  isAdmin: boolean;
  uploadsEnabled: boolean;
  onClose: () => void;
  onCreated: (result: { status: "ACTIVE" | "PENDING"; category: CategoryOption; message: string }) => void;
};

function CategoryDialog({ isAdmin, uploadsEnabled, onClose, onCreated }: DialogProps) {
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePublicId, setImagePublicId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Editing a field removes its own error and the summary message, so stale errors never linger. */
  function clearError(field: string) {
    setMessage(null);
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    if (!file.type.startsWith("image/")) return setMessage("Please choose an image file.");
    if (file.size > MAX_FILE_BYTES) return setMessage("The image must be 5 MB or smaller.");
    setUploading(true);
    try {
      const signed = await getCategoryUploadSignatureAction();
      if (!signed.ok) throw new Error(signed.message);
      const body = new FormData();
      body.set("file", file);
      body.set("api_key", signed.data.apiKey);
      body.set("timestamp", String(signed.data.timestamp));
      body.set("folder", signed.data.folder);
      body.set("signature", signed.data.signature);
      const response = await fetch(signed.data.uploadUrl, { method: "POST", body });
      if (!response.ok) throw new Error("The image host rejected the upload. Please try again.");
      const result = (await response.json()) as { secure_url: string; public_id: string };
      setImageUrl(result.secure_url);
      setImagePublicId(result.public_id);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (saving || uploading) return;
    setSaving(true);
    setMessage(null);
    setErrors({});
    const result = await createCategoryAction({ name, description, imageUrl, imagePublicId }).catch(() => null);
    setSaving(false);
    if (!result) return setMessage("Something went wrong. Please try again.");
    if (!result.ok) {
      setMessage(result.message);
      setErrors(result.errors ?? {});
      return;
    }
    onCreated(result);
  }

  // Enter must save the category, never submit the property form behind the dialog.
  function onEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-950/70 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="animate-fade-up max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-lift sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 px-5 py-4">
          <div>
            <h3 id={titleId} className="font-serif text-xl font-medium text-ink">
              {isAdmin ? "Create new category" : "Request a new category"}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {isAdmin ? "It becomes available to every host immediately." : "An administrator reviews requests before a category becomes available."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cream-300 text-muted hover:border-gold-500 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {message && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {message}
            </p>
          )}
          <div>
            <label htmlFor={`${titleId}-name`} className="label">
              Category name
            </label>
            <input
              ref={nameRef}
              id={`${titleId}-name`}
              value={name}
              onChange={(event) => (setName(event.target.value), clearError("name"))}
              onKeyDown={onEnter}
              maxLength={40}
              placeholder="e.g. Tree house"
              aria-invalid={Boolean(errors.name)}
              className={`input ${errors.name ? "input-error" : ""}`}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor={`${titleId}-description`} className="label">
              Description <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id={`${titleId}-description`}
              value={description}
              onChange={(event) => (setDescription(event.target.value), clearError("description"))}
              rows={2}
              maxLength={200}
              aria-invalid={Boolean(errors.description)}
              className={`input ${errors.description ? "input-error" : ""}`}
            />
            {errors.description && <p className="field-error">{errors.description}</p>}
          </div>
          <div>
            <p className="label">
              Category image <span className="font-normal text-muted">(optional)</span>
            </p>
            {/* Only preview complete links to supported hosts, so a half-typed link never breaks the dialog. */}
            {ALLOWED_IMAGE_HOSTS.some((host) => imageUrl.startsWith(`https://${host}/`)) && (
              <div className="relative mb-2 aspect-[5/3] w-40 overflow-hidden rounded-lg bg-cream-200">
                <Image src={imageUrl} alt="" fill sizes="160px" className="object-cover" />
              </div>
            )}
            {uploadsEnabled ? (
              <div className="flex items-center gap-3">
                <input id={`${titleId}-file`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => upload(event.target.files?.[0])} />
                <label htmlFor={`${titleId}-file`} className={`btn btn-outline btn-sm ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                  {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-3.5" aria-hidden="true" />}
                  {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
                </label>
                {imageUrl && (
                  <button type="button" onClick={() => (setImageUrl(""), setImagePublicId(""))} className="cursor-pointer text-xs font-semibold text-muted hover:text-red-700">
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <>
                <input
                  value={imageUrl}
                  onChange={(event) => (setImageUrl(event.target.value.trim()), setImagePublicId(""), clearError("imageUrl"))}
                  onKeyDown={onEnter}
                  type="url"
                  placeholder="https://images.unsplash.com/photo-…"
                  aria-label="Category image link"
                  aria-invalid={Boolean(errors.imageUrl)}
                  className={`input ${errors.imageUrl ? "input-error" : ""}`}
                />
                <p className="hint">File uploads are not configured on this site yet, so paste an image link instead. Supported hosts: {ALLOWED_IMAGE_HOSTS.join(", ")}.</p>
              </>
            )}
            {errors.imageUrl && <p className="field-error">{errors.imageUrl}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-cream-200 bg-cream-50 px-5 py-4">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || uploading} className="btn btn-gold" aria-busy={saving}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isAdmin ? "Save category" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}
