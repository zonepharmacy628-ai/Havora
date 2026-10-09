"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { PROPERTY_TYPES, SORT_OPTIONS } from "@/lib/constants";
import type { PropertyFilters } from "@/lib/properties";

type Props = {
  filters: PropertyFilters;
  amenities: { key: string; label: string }[];
  typeCounts: Record<string, number>;
};

/** Sidebar filters. Every control updates the URL, and the server re-queries the database. */
export function Filters({ filters, amenities, typeCounts }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const params = new URLSearchParams();
    // Carry the search-bar values across filter changes.
    if (filters.q) params.set("q", filters.q);
    if (filters.checkIn && filters.checkOut) {
      params.set("checkIn", filters.checkIn);
      params.set("checkOut", filters.checkOut);
    }
    if (filters.guests > 1) params.set("guests", String(filters.guests));

    const types = data.getAll("type").map(String);
    if (types.length) params.set("type", types.join(","));
    const amenityKeys = data.getAll("amenity").map(String);
    if (amenityKeys.length) params.set("amenity", amenityKeys.join(","));
    for (const name of ["minPrice", "maxPrice", "rating"]) {
      const value = String(data.get(name) ?? "").trim();
      if (value && Number(value) > 0) params.set(name, value);
    }
    const sort = String(data.get("sort") ?? "popular");
    if (sort !== "popular") params.set("sort", sort);

    startTransition(() => router.push(`/properties?${params.toString()}`, { scroll: false }));
  }

  const activeCount =
    filters.types.length + filters.amenities.length + (filters.minPrice ? 1 : 0) + (filters.maxPrice ? 1 : 0) + (filters.rating ? 1 : 0);

  const groupTitle = "mb-3 text-[13px] font-semibold text-ink";
  const option = "flex cursor-pointer items-center justify-between gap-2 py-1 text-[13px] text-ink";

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn btn-outline mb-4 w-full lg:hidden">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      {/* `key` remounts the form when the URL changes so controls always mirror the applied filters. */}
      <form
        key={JSON.stringify(filters)}
        ref={formRef}
        onChange={(event) => {
          if ((event.target as HTMLElement).dataset.defer !== "true") apply();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        className={`card card-pad space-y-6 ${open ? "block" : "hidden"} lg:block`}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg font-medium text-ink">
            Filters {pending && <Loader2 className="size-4 animate-spin text-gold-600" aria-label="Updating results" />}
          </h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                formRef.current?.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
                  if (input.type === "checkbox" || input.type === "radio") input.checked = false;
                  else input.value = "";
                });
                apply();
              }}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-gold-700 hover:underline"
            >
              <X className="size-3.5" aria-hidden="true" /> Clear all
            </button>
          )}
        </div>

        <fieldset className="lg:hidden">
          <legend className={groupTitle}>Sort by</legend>
          <select name="sort" defaultValue={filters.sort} className="input">
            {SORT_OPTIONS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend className={groupTitle}>Property Type</legend>
          {PROPERTY_TYPES.map((type) => (
            <label key={type.value} className={option}>
              <span className="flex items-center gap-2.5">
                <input type="checkbox" name="type" value={type.value} defaultChecked={filters.types.includes(type.value)} className="checkbox" />
                {type.plural}
              </span>
              <span className="text-xs text-muted">{typeCounts[type.value] ?? 0}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="divider pt-5">
          <legend className={`${groupTitle} float-left w-full`}>Price per night (USD)</legend>
          <div className="clear-both flex items-center gap-2">
            <label className="flex-1">
              <span className="sr-only">Minimum price</span>
              <input type="number" name="minPrice" data-defer="true" min={0} step={10} inputMode="numeric" placeholder="Min" defaultValue={filters.minPrice ?? ""} onBlur={apply} className="input" />
            </label>
            <span className="text-muted">–</span>
            <label className="flex-1">
              <span className="sr-only">Maximum price</span>
              <input type="number" name="maxPrice" data-defer="true" min={0} step={10} inputMode="numeric" placeholder="Max" defaultValue={filters.maxPrice ?? ""} onBlur={apply} className="input" />
            </label>
          </div>
        </fieldset>

        <fieldset className="divider pt-5">
          <legend className={`${groupTitle} float-left w-full`}>Amenities</legend>
          <div className="clear-both">
            {amenities.map((amenity) => (
              <label key={amenity.key} className={option}>
                <span className="flex items-center gap-2.5">
                  <input type="checkbox" name="amenity" value={amenity.key} defaultChecked={filters.amenities.includes(amenity.key)} className="checkbox" />
                  {amenity.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="divider pt-5">
          <legend className={`${groupTitle} float-left w-full`}>Guest Rating</legend>
          <div className="clear-both">
            {[
              { value: "", label: "Any rating" },
              { value: "5", label: "5 stars" },
              { value: "4", label: "4 stars & up" },
              { value: "3", label: "3 stars & up" },
            ].map((rating) => (
              <label key={rating.label} className={option}>
                <span className="flex items-center gap-2.5">
                  <input type="radio" name="rating" value={rating.value} defaultChecked={String(filters.rating ?? "") === rating.value} className="checkbox rounded-full" />
                  {rating.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn btn-navy w-full lg:hidden">
          Show results
        </button>
      </form>
    </div>
  );
}

/** Desktop sort dropdown shown above the results grid. */
export function SortSelect({ value, params }: { value: string; params: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="hidden items-center gap-2 text-[13px] text-muted lg:flex">
      Sort by:
      <select
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = new URLSearchParams(params);
          next.delete("page");
          if (event.target.value === "popular") next.delete("sort");
          else next.set("sort", event.target.value);
          startTransition(() => router.push(`/properties?${next.toString()}`, { scroll: false }));
        }}
        className="cursor-pointer rounded-md border border-cream-300 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-ink focus:border-gold-500 focus:outline-none"
      >
        {SORT_OPTIONS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
    </label>
  );
}
