import "server-only";
import { unstable_rethrow } from "next/navigation";
import { BookingError } from "./bookings";
import { AuthorizationError } from "./session";
import type { FormState } from "./validation";

export const TOO_MANY: FormState = { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };

/**
 * Runs a server action body and converts failures into a safe FormState.
 * Expected errors show their message; anything else is logged server-side and
 * replaced with a generic message so internals never leak to the browser.
 */
export async function safely(run: () => Promise<FormState>): Promise<FormState> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error); // let redirect()/notFound() propagate
    if (error instanceof AuthorizationError || error instanceof BookingError) {
      return { ok: false, message: error.message };
    }
    console.error("[action]", error);
    return { ok: false, message: "Something went wrong on our side. Please try again." };
  }
}
