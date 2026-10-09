"use client";

import { ArrowRight } from "lucide-react";
import { newsletterAction } from "@/actions/misc";
import { ActionForm, SubmitButton } from "./forms";

export function NewsletterForm() {
  return (
    <ActionForm action={newsletterAction} resetOnSuccess compact messagePosition="bottom">
      <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 p-1.5 focus-within:border-gold-500">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Your email address"
          className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-white placeholder:text-navy-300 focus:outline-none"
        />
        <SubmitButton className="btn btn-gold size-9 rounded-full p-0" aria-label="Subscribe">
          <ArrowRight className="size-4" />
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
