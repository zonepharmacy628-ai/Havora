import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// The customer dashboard no longer exists. This old address sends people to the
// settings page that matches their role; guests and legacy customers go to their bookings.
export default async function LegacyAccountSettings() {
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") redirect("/admin/settings");
  if (user?.role === "OWNER") redirect("/owner/settings");
  redirect("/bookings");
}
