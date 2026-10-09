import { changePasswordAction, updateProfileAction } from "@/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import type { SessionUser } from "@/lib/session";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "./forms";

/** Profile + password forms shared by the customer, owner and admin settings pages. */
export function ProfileForms({ user, bioLabel = "About you (optional)" }: { user: SessionUser; bioLabel?: string }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="card card-pad">
        <h2 className="mb-1 font-serif text-xl font-medium text-ink">Profile</h2>
        <p className="mb-5 text-xs text-muted">
          {ROLE_LABEL[user.role]} · Member since {formatDate(user.createdAt)}
        </p>
        <ActionForm action={updateProfileAction} className="space-y-4">
          <TextField name="name" label="Full name" defaultValue={user.name} autoComplete="name" required />
          <TextField name="email" label="Email address" defaultValue={user.email} disabled hint="Contact support to change your sign-in email." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="phone" label="Phone number" type="tel" defaultValue={user.phone ?? ""} placeholder="+1 234 567 8900" autoComplete="tel" />
            <TextField name="country" label="Country" defaultValue={user.country ?? ""} autoComplete="country-name" />
          </div>
          <TextAreaField name="bio" label={bioLabel} defaultValue={user.bio ?? ""} rows={3} maxLength={600} />
          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </section>

      <section className="card card-pad xl:self-start">
        <h2 className="mb-1 font-serif text-xl font-medium text-ink">Password</h2>
        <p className="mb-5 text-xs text-muted">Changing your password signs you out on your other devices.</p>
        <ActionForm action={changePasswordAction} className="space-y-4" resetOnSuccess>
          <TextField name="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
          <TextField name="newPassword" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." required />
          <SubmitButton className="btn btn-navy">Update password</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
