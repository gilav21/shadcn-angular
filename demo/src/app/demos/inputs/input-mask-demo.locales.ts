import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface InputMaskDemoLocale extends LocaleMeta {
    heading: string;
    description: string;
    phoneLabel: string;
    dateLabel: string;
    licensePlateLabel: string;
    nativeInputLabel: string;
}

export const INPUT_MASK_DEMO_LOCALES: Record<string, InputMaskDemoLocale> = {
    en: {
        code: 'en',
        heading: 'Input Mask',
        description: 'Input masking for formatted data entry.',
        phoneLabel: 'Phone Number ((000) 000-0000)',
        dateLabel: 'Date (99/99/9999)',
        licensePlateLabel: 'License Plate (AAA-999)',
        nativeInputLabel: 'Native Input Support',
    },
    he: {
        code: 'he',
        rtl: true,
        heading: 'מסכת קלט',
        description: 'מסכת קלט לעיצוב הזנת נתונים.',
        phoneLabel: 'מספר טלפון ((000) 000-0000)',
        dateLabel: 'תאריך (99/99/9999)',
        licensePlateLabel: 'לוחית רישוי (AAA-999)',
        nativeInputLabel: 'תמיכה בשדה קלט מקורי',
    },
    ar: {
        code: 'ar',
        rtl: true,
        heading: 'قناع الإدخال',
        description: 'قناع الإدخال لإدخال البيانات المنسقة.',
        phoneLabel: 'رقم الهاتف ((000) 000-0000)',
        dateLabel: 'التاريخ (99/99/9999)',
        licensePlateLabel: 'لوحة الترخيص (AAA-999)',
        nativeInputLabel: 'دعم الإدخال الأصلي',
    },
    de: {
        code: 'de',
        heading: 'Eingabemaske',
        description: 'Eingabemaske für formatierte Dateneingabe.',
        phoneLabel: 'Telefonnummer ((000) 000-0000)',
        dateLabel: 'Datum (99/99/9999)',
        licensePlateLabel: 'Kennzeichen (AAA-999)',
        nativeInputLabel: 'Unterstützung nativer Eingabe',
    },
    fr: {
        code: 'fr',
        heading: 'Masque de saisie',
        description: 'Masque de saisie pour la saisie de données formatées.',
        phoneLabel: 'Numéro de téléphone ((000) 000-0000)',
        dateLabel: 'Date (99/99/9999)',
        licensePlateLabel: "Plaque d'immatriculation (AAA-999)",
        nativeInputLabel: 'Support de saisie native',
    },
    es: {
        code: 'es',
        heading: 'Máscara de entrada',
        description: 'Máscara de entrada para entrada de datos formateados.',
        phoneLabel: 'Número de teléfono ((000) 000-0000)',
        dateLabel: 'Fecha (99/99/9999)',
        licensePlateLabel: 'Placa de matrícula (AAA-999)',
        nativeInputLabel: 'Soporte de entrada nativa',
    },
    ja: {
        code: 'ja',
        heading: '入力マスク',
        description: '書式付きデータ入力のための入力マスク。',
        phoneLabel: '電話番号 ((000) 000-0000)',
        dateLabel: '日付 (99/99/9999)',
        licensePlateLabel: 'ナンバープレート (AAA-999)',
        nativeInputLabel: 'ネイティブ入力サポート',
    },
    zh: {
        code: 'zh',
        heading: '输入掩码',
        description: '用于格式化数据输入的输入掩码。',
        phoneLabel: '电话号码 ((000) 000-0000)',
        dateLabel: '日期 (99/99/9999)',
        licensePlateLabel: '车牌号 (AAA-999)',
        nativeInputLabel: '原生输入支持',
    },
    ru: {
        code: 'ru',
        heading: 'Маска ввода',
        description: 'Маска ввода для форматированного ввода данных.',
        phoneLabel: 'Номер телефона ((000) 000-0000)',
        dateLabel: 'Дата (99/99/9999)',
        licensePlateLabel: 'Номерной знак (AAA-999)',
        nativeInputLabel: 'Поддержка нативного ввода',
    },
    pt: {
        code: 'pt',
        heading: 'Máscara de entrada',
        description: 'Máscara de entrada para inserção de dados formatados.',
        phoneLabel: 'Número de telefone ((000) 000-0000)',
        dateLabel: 'Data (99/99/9999)',
        licensePlateLabel: 'Placa de matrícula (AAA-999)',
        nativeInputLabel: 'Suporte de entrada nativa',
    },
};
