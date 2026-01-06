/**
 * Internationalization (i18n) configuration for CleanCity
 * Supports English and Hindi languages
 * Requirements: 16.5
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import hi from './locales/hi.json';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English', rtl: false },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', rtl: false },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Get device language or default to English
const getDeviceLanguage = (): SupportedLanguage => {
  const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
  return deviceLocale in SUPPORTED_LANGUAGES
    ? (deviceLocale as SupportedLanguage)
    : 'en';
};

// Initialize i18next
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  react: {
    useSuspense: false, // Disable suspense for React Native
  },
});

export default i18n;

/**
 * Change the current language
 */
export const changeLanguage = async (lang: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(lang);
};

/**
 * Get the current language
 */
export const getCurrentLanguage = (): SupportedLanguage => {
  return (i18n.language as SupportedLanguage) || 'en';
};

/**
 * Check if current language is RTL
 */
export const isRTL = (): boolean => {
  const lang = getCurrentLanguage();
  return SUPPORTED_LANGUAGES[lang]?.rtl || false;
};

/**
 * Get all translation keys for validation
 */
export const getAllTranslationKeys = (obj: object, prefix = ''): string[] => {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...getAllTranslationKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
};

/**
 * Validate that all keys exist in both languages
 */
export const validateTranslations = (): { missing: { en: string[]; hi: string[] } } => {
  const enKeys = getAllTranslationKeys(en);
  const hiKeys = getAllTranslationKeys(hi);

  const missingInHi = enKeys.filter((key) => !hiKeys.includes(key));
  const missingInEn = hiKeys.filter((key) => !enKeys.includes(key));

  return {
    missing: {
      en: missingInEn,
      hi: missingInHi,
    },
  };
};
