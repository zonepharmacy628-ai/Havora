"use client";

type LoaderArgs = { src: string; width: number; quality?: number };

// Delegates resizing to the image CDN that hosts the file, so no Vercel image
// optimisation quota is consumed.
export default function imageLoader({ src, width, quality }: LoaderArgs): string {
  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(quality ?? 72));
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    return url.toString();
  }
  if (src.startsWith("https://res.cloudinary.com/") && src.includes("/upload/")) {
    return src.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${width}/`);
  }
  return src;
}
