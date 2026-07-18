"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Dictionary,
  dictionaries,
  isLocale,
  type Locale,
} from "./dictionaries";

const LOCALE_COOKIE = "locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dict: Dictionary;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readLocaleCookie(): Locale | null {
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  return value && isLocale(value) ? value : null;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // SSR always renders English; the cookie preference is applied after
  // mount (same trade-off next-themes makes for the theme class).
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = readLocaleCookie();
    if (stored) {
      setLocaleState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    const maxAge = 60 * 60 * 24 * 365;
    // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${maxAge}`;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ dict: dictionaries[locale], locale, setLocale }),
    [locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
