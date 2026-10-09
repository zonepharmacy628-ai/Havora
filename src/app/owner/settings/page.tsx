import { ProfileForms } from "@/components/profile-forms";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/session";

export default async function OwnerSettingsPage() {
  const user = await requireRole(["OWNER"], "/owner/settings");
  return (
    <>
      <PageHeader title="Profile Settings" subtitle="Your name, bio and country are shown to guests on your listings." />
      <ProfileForms user={user} bioLabel="Host bio (shown on your listings)" />
    </>
  );
}
