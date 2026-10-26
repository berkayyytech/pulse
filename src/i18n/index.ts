import enMessages from './locales/en.json';

export type TranslationKey = keyof typeof enMessages;

const dictionaries: Record<string, Record<TranslationKey, string>> = {
  en: enMessages,
};

let activeLocale = 'en';

export function setLocale(locale: string): void {
  if (dictionaries[locale]) {
    activeLocale = locale;
  }
}

export function t(
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  const dict = dictionaries[activeLocale] ?? enMessages;
  const template = dict[key];
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replaceAll(`{${paramKey}}`, String(value)),
    template,
  );
}
