import "server-only";
import { createHash } from "node:crypto";

const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME || "";
const apiKey = () => process.env.CLOUDINARY_API_KEY || "";
const apiSecret = () => process.env.CLOUDINARY_API_SECRET || "";

export const cloudinaryConfigured = () => Boolean(cloudName() && apiKey() && apiSecret());

function sign(params: Record<string, string | number>): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret()).digest("hex");
}

/**
 * Creates a short-lived signature so the browser can upload one image straight
 * to Cloudinary. The API secret never leaves the server.
 */
export function createUploadSignature(propertyId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `havora/properties/${propertyId}`;
  return {
    cloudName: cloudName(),
    apiKey: apiKey(),
    timestamp,
    folder,
    signature: sign({ folder, timestamp }),
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName()}/image/upload`,
  };
}

/** True if the URL is an image delivered from this project's own Cloudinary folder for the property. */
export function isOwnCloudinaryUrl(url: string, propertyId: string): boolean {
  return (
    url.startsWith(`https://res.cloudinary.com/${cloudName()}/image/upload/`) &&
    url.includes(`/havora/properties/${propertyId}/`)
  );
}

/** Best-effort removal of an uploaded asset. */
export async function destroyAsset(publicId: string): Promise<void> {
  if (!cloudinaryConfigured()) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey(),
    signature: sign({ public_id: publicId, timestamp }),
  });
  await fetch(`https://api.cloudinary.com/v1_1/${cloudName()}/image/destroy`, { method: "POST", body }).catch((error) =>
    console.error("[cloudinary] destroy failed", error),
  );
}
