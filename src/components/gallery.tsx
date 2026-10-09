"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

type Photo = { url: string; alt: string };

export function Gallery({ images, title }: { images: Photo[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const count = images.length;

  const step = useCallback(
    (delta: number) => setActive((current) => (current === null ? current : (current + delta + count) % count)),
    [count],
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active, step]);

  if (count === 0) {
    return <div className="flex aspect-[16/7] items-center justify-center rounded-2xl bg-cream-200 text-sm text-muted">Photos coming soon</div>;
  }

  const [cover, ...rest] = images;
  const thumbs = rest.slice(0, 4);

  return (
    <>
      <div className={`relative grid gap-2 overflow-hidden rounded-2xl ${thumbs.length ? "md:grid-cols-[1.5fr_1fr]" : ""}`}>
        <button type="button" onClick={() => setActive(0)} className="group relative aspect-[4/3] cursor-zoom-in overflow-hidden bg-cream-200 md:aspect-auto md:min-h-[440px]" aria-label="Open photo 1">
          <Image src={cover.url} alt={cover.alt || title} fill priority sizes="(min-width: 768px) 60vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
        </button>
        {thumbs.length > 0 && (
          <div className={`grid grid-cols-4 gap-2 md:grid-cols-2 ${thumbs.length <= 2 ? "md:grid-rows-2 md:grid-cols-1" : "md:grid-rows-2"}`}>
            {thumbs.map((photo, index) => (
              <button key={photo.url} type="button" onClick={() => setActive(index + 1)} className="group relative aspect-square cursor-zoom-in overflow-hidden bg-cream-200 md:aspect-auto" aria-label={`Open photo ${index + 2}`}>
                <Image src={photo.url} alt={photo.alt || title} fill sizes="(min-width: 768px) 22vw, 25vw" className="object-cover transition duration-700 group-hover:scale-105" />
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setActive(0)} className="btn btn-outline btn-sm absolute right-3 bottom-3 shadow-card">
          <Images className="size-4" aria-hidden="true" /> View all {count} photos
        </button>
      </div>

      {active !== null && (
        <div role="dialog" aria-modal="true" aria-label={`${title} photo gallery`} className="fixed inset-0 z-[60] flex flex-col bg-navy-950/97">
          <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
            <p className="text-sm">
              <span className="font-semibold">{active + 1}</span> / {count}
            </p>
            <button type="button" onClick={() => setActive(null)} autoFocus className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/20 hover:border-gold-400 hover:text-gold-300" aria-label="Close gallery">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex-1">
            <Image key={images[active].url} src={images[active].url} alt={images[active].alt || title} fill sizes="100vw" className="object-contain" />
            {count > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} className="absolute top-1/2 left-3 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-navy-950/60 text-white hover:text-gold-300" aria-label="Previous photo">
                  <ChevronLeft className="size-6" />
                </button>
                <button type="button" onClick={() => step(1)} className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-navy-950/60 text-white hover:text-gold-300" aria-label="Next photo">
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>
          <p className="px-4 py-4 text-center text-sm text-navy-200">{images[active].alt || title}</p>
        </div>
      )}
    </>
  );
}
