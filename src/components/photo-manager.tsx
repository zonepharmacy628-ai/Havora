"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Star, Trash2, Upload } from "lucide-react";
import { addImageByUrlAction, getUploadSignatureAction, imageAction, registerUploadedImageAction } from "@/actions/owner";
import { ALLOWED_IMAGE_HOSTS } from "@/lib/constants";
import { ActionForm, SubmitButton, TextField } from "./forms";

type Photo = { id: string; url: string; alt: string };

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function PhotoManager({ propertyId, images, uploadsEnabled }: { propertyId: string; images: Photo[]; uploadsEnabled: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
        if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 8 MB.`);

        // 1. Ask our server for a short-lived signature (ownership is checked there).
        const signed = await getUploadSignatureAction(propertyId);
        if (!signed.ok) throw new Error(signed.message);

        // 2. Upload the file straight from the browser to Cloudinary.
        const body = new FormData();
        body.set("file", file);
        body.set("api_key", signed.data.apiKey);
        body.set("timestamp", String(signed.data.timestamp));
        body.set("folder", signed.data.folder);
        body.set("signature", signed.data.signature);
        const response = await fetch(signed.data.uploadUrl, { method: "POST", body });
        if (!response.ok) throw new Error("The image host rejected the upload. Please try again.");
        const result = (await response.json()) as { secure_url: string; public_id: string };

        // 3. Register the uploaded image against the listing.
        const saved = await registerUploadedImageAction(propertyId, result.secure_url, result.public_id);
        if (!saved.ok) throw new Error(saved.message ?? "The photo could not be saved.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cream-300 bg-cream-50 px-5 py-10 text-center text-sm text-muted">
          No photos yet. Add at least 3 — the first photo is your cover image.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-xl border border-cream-200 bg-white">
              <div className="relative aspect-[4/3] bg-cream-200">
                <Image src={image.url} alt={image.alt} fill sizes="240px" className="object-cover" />
                {index === 0 && <span className="badge absolute top-2 left-2 bg-gold-500 text-navy-950">Cover</span>}
              </div>
              <ActionForm action={imageAction} compact messagePosition="bottom" className="p-1.5">
                <input type="hidden" name="propertyId" value={propertyId} />
                <input type="hidden" name="imageId" value={image.id} />
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <SubmitButton name="intent" value="up" disabled={index === 0} className="btn btn-outline btn-sm size-8 p-0" aria-label="Move earlier" title="Move earlier">
                      <ArrowUp className="size-3.5" />
                    </SubmitButton>
                    <SubmitButton name="intent" value="down" disabled={index === images.length - 1} className="btn btn-outline btn-sm size-8 p-0" aria-label="Move later" title="Move later">
                      <ArrowDown className="size-3.5" />
                    </SubmitButton>
                    <SubmitButton name="intent" value="cover" disabled={index === 0} className="btn btn-outline btn-sm size-8 p-0" aria-label="Use as cover photo" title="Use as cover photo">
                      <Star className="size-3.5" />
                    </SubmitButton>
                  </div>
                  <SubmitButton name="intent" value="delete" className="btn btn-danger btn-sm size-8 p-0" aria-label="Delete photo" title="Delete photo">
                    <Trash2 className="size-3.5" />
                  </SubmitButton>
                </div>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
          <h3 className="text-sm font-semibold text-ink">Upload photos</h3>
          {uploadsEnabled ? (
            <>
              <p className="mt-1 mb-3 text-xs text-muted">JPG, PNG or WebP, up to 8 MB each.</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" id="photo-upload" onChange={(event) => upload(event.target.files)} />
              <label htmlFor="photo-upload" className={`btn btn-navy ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
                {uploading ? "Uploading…" : "Choose files"}
              </label>
            </>
          ) : (
            <p className="mt-1 text-xs leading-5 text-muted">
              File uploads are not configured on this site yet (the administrator needs to add Cloudinary credentials). You can add photos by link in the meantime.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <ActionForm action={addImageByUrlAction} resetOnSuccess messagePosition="bottom" compact className="rounded-xl border border-cream-200 bg-cream-50 p-4">
          <input type="hidden" name="propertyId" value={propertyId} />
          <h3 className="mb-3 text-sm font-semibold text-ink">Add a photo by link</h3>
          <div className="space-y-3">
            <TextField name="url" label="Image URL" type="url" placeholder="https://images.unsplash.com/photo-…" hint={`Supported hosts: ${ALLOWED_IMAGE_HOSTS.join(", ")}. Only use images you have the right to publish.`} required />
            <TextField name="alt" label="Description (optional)" placeholder="Pool terrace at sunset" maxLength={140} />
            <SubmitButton className="btn btn-outline">Add photo</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
