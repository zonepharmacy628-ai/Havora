import type { Metadata } from "next";
import { OpenBooking } from "@/components/open-booking";

export const metadata: Metadata = { title: "Open your booking", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function OpenBookingPage() {
  return (
    <div className="container-page py-16">
      <OpenBooking />
    </div>
  );
}
