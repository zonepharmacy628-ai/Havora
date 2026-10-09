import { saveSettingsAction } from "@/actions/admin";
import { ActionForm, CheckboxField, SubmitButton, TextField } from "@/components/forms";
import { ProfileForms } from "@/components/profile-forms";
import { Notice, PageHeader } from "@/components/ui";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { emailConfigured } from "@/lib/email";
import { requireRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function AdminSettingsPage() {
  const user = await requireRole(["ADMIN"], "/admin/settings");
  const settings = await getSettings();

  const integrations = [
    { name: "Email delivery (Resend)", ok: emailConfigured(), off: "Not configured — password reset emails are not sent." },
    { name: "Photo uploads (Cloudinary)", ok: cloudinaryConfigured(), off: "Not configured — owners add photos by link." },
    { name: "Online payments", ok: false, off: "Disabled in this release — Pay at Property only." },
  ];

  return (
    <>
      <PageHeader title="Platform Settings" subtitle="Commission, fees and site-wide content. Changes are recorded in the audit log." />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="card card-pad">
          <h2 className="mb-5 font-serif text-xl font-medium text-ink">Commission &amp; content</h2>
          <ActionForm action={saveSettingsAction} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="commissionRate" label="Owner commission (%)" type="number" step="0.01" min={0} max={50} defaultValue={settings.commissionRateBps / 100} hint="Deducted from the accommodation subtotal." required />
              <TextField name="serviceFeeRate" label="Guest service fee (%)" type="number" step="0.01" min={0} max={30} defaultValue={settings.serviceFeeRateBps / 100} hint="Added to the guest's total." required />
            </div>
            <Notice>Rate changes apply to <strong>new</strong> bookings only. Existing bookings keep the price and commission captured when they were made.</Notice>
            <CheckboxField name="requireListingApproval" label="Require administrator approval for new listings" hint="When off, owners can publish listings immediately." defaultChecked={settings.requireListingApproval} />
            <TextField name="supportEmail" label="Support email (shown in the footer and contact page)" type="email" defaultValue={settings.supportEmail} required />
            <TextField name="announcement" label="Site announcement (optional)" defaultValue={settings.announcement} maxLength={200} hint="Shown in a gold bar above the header on every page. Leave empty to hide." />
            <SubmitButton>Save settings</SubmitButton>
          </ActionForm>
        </section>

        <section className="card card-pad xl:self-start">
          <h2 className="mb-4 font-serif text-xl font-medium text-ink">Integrations</h2>
          <ul className="space-y-4 text-sm">
            {integrations.map((item) => (
              <li key={item.name} className="flex items-start gap-3">
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${item.ok ? "bg-emerald-500" : "bg-amber-400"}`} aria-hidden="true" />
                <span>
                  <span className="block font-medium text-ink">{item.name}</span>
                  <span className="text-xs text-muted">{item.ok ? "Configured" : item.off}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-cream-200 pt-3 text-xs leading-5 text-muted">Integrations are configured with environment variables on the server (see the README), never from this page.</p>
        </section>
      </div>

      <h2 className="mt-10 mb-4 font-serif text-xl font-medium text-ink">Your administrator account</h2>
      <ProfileForms user={user} />
    </>
  );
}
