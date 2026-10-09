import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { settingsFromRows, type PlatformSettings } from "./settings-core";

export * from "./settings-core";

export const getSettings = cache(async (): Promise<PlatformSettings> => {
  return settingsFromRows(await prisma.platformSetting.findMany());
});
