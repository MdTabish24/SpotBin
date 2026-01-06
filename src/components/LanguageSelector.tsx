import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal as RNModal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  changeLanguage,
  getCurrentLanguage,
} from '../i18n';
import { MIN_TOUCH_TARGET_SIZE } from '../utils/accessibility';

interface LanguageSelectorProps {
  compact?: boolean;
}

/**
 * Language selector component for switching between English and Hindi
 * Requirements: 16.5
 */
export function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const currentLang = getCurrentLanguage();

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setModalVisible(false);
  };

  if (compact) {
    // Compact toggle button
    return (
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={{ minWidth: MIN_TOUCH_TARGET_SIZE, minHeight: MIN_TOUCH_TARGET_SIZE }}
        className="flex-row items-center justify-center px-3 py-2 bg-gray-100 rounded-lg"
        accessibilityLabel={t('accessibility.changeLanguage')}
        accessibilityRole="button"
        accessibilityHint="Opens language selection"
      >
        <Ionicons name="language" size={20} color="#4B5563" />
        <Text className="ml-2 text-sm font-medium text-gray-700">
          {SUPPORTED_LANGUAGES[currentLang].nativeName}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      {/* Full selector button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={{ minWidth: MIN_TOUCH_TARGET_SIZE, minHeight: MIN_TOUCH_TARGET_SIZE }}
        className="flex-row items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200"
        accessibilityLabel={t('accessibility.changeLanguage')}
        accessibilityRole="button"
      >
        <View className="flex-row items-center">
          <Ionicons name="language" size={24} color="#059669" />
          <View className="ml-3">
            <Text className="text-sm text-gray-500">{t('profile.language')}</Text>
            <Text className="text-base font-medium text-gray-900">
              {SUPPORTED_LANGUAGES[currentLang].nativeName}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Language selection modal */}
      <RNModal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View className="bg-white rounded-2xl w-80 overflow-hidden">
            <View className="px-4 py-3 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-900">
                {t('profile.language')}
              </Text>
            </View>

            {(Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]).map((lang) => (
              <TouchableOpacity
                key={lang}
                onPress={() => handleLanguageChange(lang)}
                style={{ minHeight: MIN_TOUCH_TARGET_SIZE }}
                className={`flex-row items-center justify-between px-4 py-4 ${
                  lang === currentLang ? 'bg-green-50' : ''
                }`}
                accessibilityLabel={`Select ${SUPPORTED_LANGUAGES[lang].name}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: lang === currentLang }}
              >
                <View>
                  <Text
                    className={`text-base ${
                      lang === currentLang
                        ? 'font-semibold text-green-700'
                        : 'text-gray-900'
                    }`}
                  >
                    {SUPPORTED_LANGUAGES[lang].nativeName}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {SUPPORTED_LANGUAGES[lang].name}
                  </Text>
                </View>
                {lang === currentLang && (
                  <Ionicons name="checkmark-circle" size={24} color="#059669" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{ minHeight: MIN_TOUCH_TARGET_SIZE }}
              className="px-4 py-4 border-t border-gray-100"
              accessibilityLabel={t('common.cancel')}
              accessibilityRole="button"
            >
              <Text className="text-center text-base font-medium text-gray-500">
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </RNModal>
    </>
  );
}

export default LanguageSelector;
