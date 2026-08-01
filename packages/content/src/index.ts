export { en } from "./i18n/en.js";
export { de } from "./i18n/de.js";
export * from "./world.js";
export * from "./shops.js";

import { en } from "./i18n/en.js";
import { de } from "./i18n/de.js";
import type { Locale } from "@embertrail/shared";

const tables: Record<Locale, Record<string, string>> = { en, de };

export function t(locale: Locale, key: string, args?: Record<string, string | number>): string {
  let s = tables[locale][key] ?? tables.en[key] ?? key;
  if (args) {
    for (const [k, v] of Object.entries(args)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}
