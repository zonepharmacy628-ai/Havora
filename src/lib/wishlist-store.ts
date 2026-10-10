"use client";

import { useSyncExternalStore } from "react";

// The wishlist lives in this browser's localStorage, so it works without an
// account. Limitations (by design): it is per browser and per device, it is not
// synced or backed up, and it disappears if site data is cleared or in private
// browsing sessions.

const KEY = "havora:wishlist";
const IMPORTED_KEY = "havora:wishlist-imported";
const CHANGE_EVENT = "havora:wishlist-change";
const MAX_ITEMS = 100;
const EMPTY: string[] = [];

let cachedRaw: string | null | undefined;
let cachedIds: string[] = EMPTY;

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 40))].slice(0, MAX_ITEMS);
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Storage blocked (e.g. strict privacy settings): behave as an empty wishlist.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parse(raw);
  }
  return cachedIds;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function write(ids: string[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** Saved property ids (newest first). Empty during server rendering. */
export function useWishlist(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** Adds or removes a property. Returns false if the browser refused to store it. */
export function toggleWishlist(propertyId: string): boolean {
  const current = getSnapshot();
  return write(current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [propertyId, ...current]);
}

export function removeFromWishlist(propertyIds: string[]): void {
  const current = getSnapshot();
  const next = current.filter((id) => !propertyIds.includes(id));
  if (next.length !== current.length) write(next);
}

/** One-time import of a legacy account's saved properties into this browser. */
export function importLegacyWishlist(propertyIds: string[]): void {
  try {
    if (propertyIds.length === 0 || window.localStorage.getItem(IMPORTED_KEY)) return;
    window.localStorage.setItem(IMPORTED_KEY, "1");
  } catch {
    return;
  }
  const current = getSnapshot();
  write([...current, ...propertyIds.filter((id) => !current.includes(id))]);
}
