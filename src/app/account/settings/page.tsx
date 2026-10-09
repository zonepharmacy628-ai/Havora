import { ProfileForms } from "@/components/profile-forms";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";

export default async function AccountSettingsPage() {
  const user = await requireUser("/account/settings");
  return (
    <>
      <PageHeader title="Profile Settings" subtitle="Manage your personal details and sign-in security." />
      <ProfileForms user={user} />
    </>
  );
}
