import "server-only";

type Email = { to: string; subject: string; text: string };

/**
 * What actually happened to a message:
 *  - "sent":   the mail provider accepted it for delivery
 *  - "failed": the provider rejected it, timed out or could not be reached
 *  - "off":    email is not configured on this deployment, so nothing was attempted
 * Callers use this to tell people the truth — the site never says "we emailed
 * you" unless the result was "sent".
 */
export type EmailResult = "sent" | "failed" | "off";

const SEND_TIMEOUT_MS = 8000;

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/**
 * Sends transactional email through Resend. Never throws: a mail problem must
 * not break the action that triggered it (for example a booking). Message
 * bodies and recipients are never written to production logs.
 */
export async function sendEmailWithResult({ to, subject, text }: Email): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      // Development only: lets flows such as password reset be tested without a provider.
      console.info(`\n[email:not-sent] To: ${to}\nSubject: ${subject}\n${text}\n`);
    } else {
      console.warn(`[email] not configured — "${subject}" was not sent.`);
    }
    return "off";
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[email] provider rejected "${subject}" (HTTP ${response.status})`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error(`[email] could not reach the provider for "${subject}":`, error instanceof Error ? error.name : "error");
    return "failed";
  }
}

/** Convenience wrapper: true only when the provider accepted the message. */
export async function sendEmail(email: Email): Promise<boolean> {
  return (await sendEmailWithResult(email)) === "sent";
}
