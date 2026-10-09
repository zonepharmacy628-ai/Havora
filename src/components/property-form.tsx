import type { Amenity, Property } from "@prisma/client";
import { savePropertyAction } from "@/actions/owner";
import { CANCELLATION_POLICIES, PROPERTY_TYPES } from "@/lib/constants";
import { centsToInput, formatBps } from "@/lib/money";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "./forms";
import { AmenityIcon } from "./ui";

type Props = {
  property?: Property & { amenities: { amenityId: string }[] };
  amenities: Amenity[];
  commissionRateBps: number;
};

function Section({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-cream-200 py-7 first:border-t-0 first:pt-0 lg:grid-cols-[240px_1fr]">
      <div>
        <h2 className="font-serif text-lg font-medium text-ink">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function PropertyForm({ property, amenities, commissionRateBps }: Props) {
  const selected = new Set(property?.amenities.map((a) => a.amenityId));
  const sleeping = Array.isArray(property?.sleepingArrangements)
    ? (property.sleepingArrangements as { room: string; beds: string }[]).map((r) => `${r.room}: ${r.beds}`).join("\n")
    : "";

  return (
    <ActionForm action={savePropertyAction} className="card card-pad">
      {property && <input type="hidden" name="propertyId" value={property.id} />}

      <Section title="The basics" text="A clear title and description help guests understand what makes your place special.">
        <TextField name="title" label="Listing title" defaultValue={property?.title} placeholder="Luxury Villa with Private Pool" maxLength={90} required className="sm:col-span-2" />
        <SelectField name="type" label="Property type" defaultValue={property?.type ?? "VILLA"}>
          {PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </SelectField>
        <TextField name="summary" label="Short summary" defaultValue={property?.summary} placeholder="One sentence shown in search results" maxLength={160} required className="sm:col-span-2" />
        <TextAreaField name="description" label="Full description" defaultValue={property?.description} rows={7} maxLength={5000} required hint="At least 80 characters. Separate paragraphs with a blank line." className="sm:col-span-2" />
      </Section>

      <Section title="Location" text="The street address is only shown to guests after they book. The timezone decides what counts as “today” for check-ins.">
        <TextField name="addressLine" label="Street address" defaultValue={property?.addressLine} autoComplete="off" required className="sm:col-span-2" />
        <TextField name="city" label="City / destination" defaultValue={property?.city} required />
        <TextField name="region" label="Area / region (optional)" defaultValue={property?.region ?? ""} />
        <TextField name="country" label="Country" defaultValue={property?.country} required />
        <TextField name="countryCode" label="Country code" defaultValue={property?.countryCode} placeholder="ID" maxLength={2} required hint="2-letter ISO code, e.g. ID, AE, FR." />
        <TextField name="postalCode" label="Postal code (optional)" defaultValue={property?.postalCode ?? ""} />
        <TextField name="timezone" label="Timezone" defaultValue={property?.timezone ?? "UTC"} placeholder="Asia/Makassar" required hint="IANA name, e.g. Europe/Paris." />
      </Section>

      <Section title="Capacity & rooms" text="Guests can only book for up to the maximum number of guests you set here.">
        <TextField name="maxGuests" label="Maximum guests" type="number" min={1} max={30} defaultValue={property?.maxGuests ?? 2} required />
        <TextField name="bedrooms" label="Bedrooms" type="number" min={0} max={30} defaultValue={property?.bedrooms ?? 1} required />
        <TextField name="beds" label="Beds" type="number" min={1} max={60} defaultValue={property?.beds ?? 1} required />
        <TextField name="bathrooms" label="Bathrooms" type="number" min={0} max={30} defaultValue={property?.bathrooms ?? 1} required />
        <TextAreaField name="sleepingArrangements" label="Sleeping arrangements (optional)" defaultValue={sleeping} rows={3} placeholder={"Bedroom 1: 1 king bed\nBedroom 2: 2 single beds"} hint="One room per line, as “Room: beds”." className="sm:col-span-2" />
      </Section>

      <Section title="Pricing" text={`Prices are in USD. HAVORA's commission is currently ${formatBps(commissionRateBps)} of the accommodation subtotal.`}>
        <TextField name="nightlyPrice" label="Nightly price (USD)" inputMode="decimal" defaultValue={property ? centsToInput(property.nightlyPriceCents) : ""} placeholder="185" required />
        <TextField name="cleaningFee" label="Cleaning fee (USD)" inputMode="decimal" defaultValue={property ? centsToInput(property.cleaningFeeCents) : "0"} hint="Charged once per stay. Enter 0 for none." required />
      </Section>

      <Section title="Amenities" text="Select everything guests can use during their stay.">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:col-span-2 sm:grid-cols-3">
          {amenities.map((amenity) => (
            <label key={amenity.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
              <input type="checkbox" name="amenities" value={amenity.key} defaultChecked={selected.has(amenity.id)} className="checkbox" />
              <AmenityIcon icon={amenity.icon} className="size-4 text-gold-600" />
              {amenity.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Stay rules" text="Set your check-in times, stay length and cancellation terms.">
        <TextField name="checkInFrom" label="Check-in from" type="time" defaultValue={property?.checkInFrom ?? "15:00"} required />
        <TextField name="checkOutBy" label="Check-out by" type="time" defaultValue={property?.checkOutBy ?? "11:00"} required />
        <TextField name="minNights" label="Minimum nights" type="number" min={1} max={90} defaultValue={property?.minNights ?? 1} required />
        <TextField name="maxNights" label="Maximum nights" type="number" min={1} max={365} defaultValue={property?.maxNights ?? 30} required />
        <SelectField name="cancellationPolicy" label="Cancellation policy" defaultValue={property?.cancellationPolicy ?? "MODERATE"} className="sm:col-span-2">
          {Object.entries(CANCELLATION_POLICIES).map(([value, policy]) => (
            <option key={value} value={value}>
              {policy.label} — {policy.summary}
            </option>
          ))}
        </SelectField>
        <TextAreaField name="houseRules" label="House rules (optional)" defaultValue={property?.houseRules.join("\n")} rows={4} placeholder={"No smoking indoors\nNo parties or events"} hint="One rule per line." className="sm:col-span-2" />
        <div className="space-y-3 sm:col-span-2">
          <CheckboxField name="instantBook" label="Instant booking" hint="Bookings are confirmed immediately. Turn off to approve each request yourself." defaultChecked={property?.instantBook ?? true} />
          <CheckboxField name="payAtPropertyEnabled" label="Accept Pay at Property" hint="Guests reserve online and pay you on arrival. This is currently the only booking method, so turning it off pauses new bookings." defaultChecked={property?.payAtPropertyEnabled ?? true} />
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-cream-200 pt-6">
        <SubmitButton className="btn btn-gold btn-lg" pendingText="Saving…">
          {property ? "Save changes" : "Save and add photos"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
