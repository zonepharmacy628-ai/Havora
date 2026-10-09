export type PlatformSettings = {
  /** Commission deducted from the owner's accommodation subtotal (basis points). */
  commissionRateBps: number;
  /** Service fee added to the guest's total (basis points). */
  serviceFeeRateBps: number;
  /** When true, new listings need administrator approval before going live. */
  requireListingApproval: boolean;
  supportEmail: string;
  /** Optional site-wide notice shown above the header. */
  announcement: string;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  commissionRateBps: 1200,
  serviceFeeRateBps: 500,
  requireListingApproval: true,
  supportEmail: "support@havora.example",
  announcement: "",
};

export const SETTING_KEYS: Record<keyof PlatformSettings, string> = {
  commissionRateBps: "commission_rate_bps",
  serviceFeeRateBps: "service_fee_rate_bps",
  requireListingApproval: "require_listing_approval",
  supportEmail: "support_email",
  announcement: "announcement",
};

export function settingsFromRows(rows: { key: string; value: string }[]): PlatformSettings {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const int = (key: string, fallback: number) => {
    const parsed = Number.parseInt(map.get(key) ?? "", 10);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 5000 ? parsed : fallback;
  };
  return {
    commissionRateBps: int(SETTING_KEYS.commissionRateBps, DEFAULT_SETTINGS.commissionRateBps),
    serviceFeeRateBps: int(SETTING_KEYS.serviceFeeRateBps, DEFAULT_SETTINGS.serviceFeeRateBps),
    requireListingApproval: (map.get(SETTING_KEYS.requireListingApproval) ?? "true") !== "false",
    supportEmail: map.get(SETTING_KEYS.supportEmail) || DEFAULT_SETTINGS.supportEmail,
    announcement: map.get(SETTING_KEYS.announcement) ?? "",
  };
}
