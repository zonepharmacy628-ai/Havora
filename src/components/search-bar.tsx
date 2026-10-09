"use client";

import { useState } from "react";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { addDays } from "@/lib/dates";

type Props = {
  today: string;
  defaults?: { q?: string; checkIn?: string | null; checkOut?: string | null; guests?: number };
  /** Extra query params to keep when searching (e.g. active filters). */
  preserve?: Record<string, string>;
};

/** Destination / dates / guests search. A plain GET form, so it works without JavaScript too. */
export function SearchBar({ today, defaults = {}, preserve = {} }: Props) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults.checkOut ?? "");

  function onCheckIn(value: string) {
    setCheckIn(value);
    if (value && (!checkOut || checkOut <= value)) setCheckOut(addDays(value, 1));
  }

  const cell = "flex min-w-0 flex-1 items-center gap-3 px-4 py-3 lg:py-2";
  const label = "block text-[13px] font-semibold text-ink";
  const input = "w-full min-w-0 bg-transparent p-0 text-[13px] text-muted placeholder:text-navy-300 focus:outline-none";

  return (
    <form
      action="/properties"
      method="get"
      role="search"
      className="flex flex-col divide-y divide-cream-200 rounded-2xl bg-white p-1.5 shadow-lift lg:flex-row lg:items-center lg:divide-x lg:divide-y-0 lg:rounded-full lg:pl-3"
    >
      {Object.entries(preserve).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className={`${cell} lg:flex-[1.4]`}>
        <MapPin className="size-5 shrink-0 text-gold-600" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={label}>Where to?</span>
          <input name="q" type="search" defaultValue={defaults.q} placeholder="Search destination or property" maxLength={80} className={input} />
        </span>
      </label>
      <label className={cell}>
        <CalendarDays className="size-5 shrink-0 text-gold-600" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={label}>Check-in</span>
          <input name="checkIn" type="date" min={today} value={checkIn} onChange={(e) => onCheckIn(e.target.value)} className={input} />
        </span>
      </label>
      <label className={cell}>
        <CalendarDays className="size-5 shrink-0 text-gold-600" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={label}>Check-out</span>
          <input
            name="checkOut"
            type="date"
            min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className={input}
          />
        </span>
      </label>
      <label className={cell}>
        <Users className="size-5 shrink-0 text-gold-600" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={label}>Guests</span>
          <select name="guests" defaultValue={String(defaults.guests ?? 1)} className={`${input} cursor-pointer`}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} guest{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </span>
      </label>
      <div className="p-1.5 lg:border-0 lg:p-0 lg:pl-2">
        <button type="submit" className="btn btn-gold w-full rounded-xl py-3 lg:size-12 lg:rounded-full lg:p-0" aria-label="Search stays">
          <Search className="size-5" aria-hidden="true" />
          <span className="lg:hidden">Search</span>
        </button>
      </div>
    </form>
  );
}
