import type { LocaleMeta } from '../../lib/i18n';

/**
 * Locale dictionary for `<ui-input-otp>`.
 *
 * - `label` is the default `aria-label` on the hidden input that receives
 *   typing, used when the consumer passes neither `ariaLabel` nor
 *   `ariaLabelledby`.
 */
export interface InputOtpLocale extends LocaleMeta {
    label: string;
}

export const INPUT_OTP_LOCALES: Record<string, InputOtpLocale> = {
    en: { code: 'en', label: 'One-time code' },
    he: { code: 'he', rtl: true, label: 'קוד חד-פעמי' },
    ar: { code: 'ar', rtl: true, label: 'رمز لمرة واحدة' },
    de: { code: 'de', label: 'Einmalcode' },
    fr: { code: 'fr', label: 'Code à usage unique' },
    es: { code: 'es', label: 'Código de un solo uso' },
    ja: { code: 'ja', label: 'ワンタイムコード' },
    zh: { code: 'zh', label: '一次性验证码' },
    ru: { code: 'ru', label: 'Одноразовый код' },
    pt: { code: 'pt', label: 'Código de uso único' },
};
