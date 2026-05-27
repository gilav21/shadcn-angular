import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface InputOtpDemoLocale extends LocaleMeta {
    heading: string;
    description: string;
}

export const INPUT_OTP_DEMO_LOCALES: Record<string, InputOtpDemoLocale> = {
    en: {
        code: 'en',
        heading: 'Input OTP',
        description: 'One-time password input fields.',
    },
    he: {
        code: 'he',
        rtl: true,
        heading: 'קלט סיסמה חד-פעמית',
        description: 'שדות קלט לסיסמה חד-פעמית.',
    },
    ar: {
        code: 'ar',
        rtl: true,
        heading: 'إدخال كلمة المرور لمرة واحدة',
        description: 'حقول إدخال كلمة المرور لمرة واحدة.',
    },
    de: {
        code: 'de',
        heading: 'Einmalpasswort-Eingabe',
        description: 'Eingabefelder für Einmalpasswörter.',
    },
    fr: {
        code: 'fr',
        heading: 'Saisie OTP',
        description: 'Champs de saisie pour mot de passe à usage unique.',
    },
    es: {
        code: 'es',
        heading: 'Entrada OTP',
        description: 'Campos de entrada para contraseña de un solo uso.',
    },
    ja: {
        code: 'ja',
        heading: 'ワンタイムパスワード入力',
        description: 'ワンタイムパスワードの入力フィールド。',
    },
    zh: {
        code: 'zh',
        heading: '一次性密码输入',
        description: '一次性密码输入字段。',
    },
    ru: {
        code: 'ru',
        heading: 'Ввод одноразового пароля',
        description: 'Поля для ввода одноразового пароля.',
    },
    pt: {
        code: 'pt',
        heading: 'Entrada de senha única',
        description: 'Campos de entrada para senha de uso único.',
    },
};
