import { t as contentT, en, de } from "@embertrail/content";
import type { Locale } from "@embertrail/shared";

let locale: Locale = (localStorage.getItem("embertrail_locale") as Locale) || "en";

export function getLocale(): Locale {
  return locale;
}

export function setLocale(l: Locale): void {
  locale = l;
  localStorage.setItem("embertrail_locale", l);
}

export function t(key: string, args?: Record<string, string | number>): string {
  return contentT(locale, key, args);
}

export function toggleLocale(): Locale {
  setLocale(locale === "en" ? "de" : "en");
  return locale;
}

export { en, de };
