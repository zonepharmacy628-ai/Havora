import "server-only";

type Email = { to: string; subject: string; text: string };

/**
 * Sends transactional email through Resend when RESEND_API_KEY is configured.
 * Without a key (local development) the message is written to the server log,
 * so flows like password reset stay testable. Returns whether it was delivered
 * to a real provider.
 */
export async function sendEmail({ to, subject, text }: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[email:not-sent] To: ${to}\nSubject: ${subject}\n${text}\n`);
    } else {
      console.warn(`[email] RESEND_API_KEY/EMAIL_FROM not configured — "${subject}" was not sent.`);
    }
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!response.ok) {
    console.error(`[email] Provider rejected "${subject}" (${response.status})`);
    return false;
  }
  return true;
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
