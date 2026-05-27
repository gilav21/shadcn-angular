import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface InputGroupDemoLocale extends LocaleMeta {
    heading: string;
    description: string;
    searchPlaceholder: string;
    locationPlaceholder: string;
    locateButton: string;
}

export const INPUT_GROUP_DEMO_LOCALES: Record<string, InputGroupDemoLocale> = {
    en: {
        code: 'en',
        heading: 'Input Group',
        description: 'Group inputs with addons like icons, text, and buttons.',
        searchPlaceholder: 'Search...',
        locationPlaceholder: 'Enter location',
        locateButton: 'Locate',
    },
    he: {
        code: 'he',
        rtl: true,
        heading: 'קבוצת שדות',
        description: 'קבצו שדות קלט עם תוספות כמו סמלים, טקסט וכפתורים.',
        searchPlaceholder: 'חיפוש...',
        locationPlaceholder: 'הזינו מיקום',
        locateButton: 'אתר',
    },
    ar: {
        code: 'ar',
        rtl: true,
        heading: 'مجموعة حقول الإدخال',
        description: 'تجميع حقول الإدخال مع إضافات مثل الأيقونات والنصوص والأزرار.',
        searchPlaceholder: 'بحث...',
        locationPlaceholder: 'أدخل الموقع',
        locateButton: 'تحديد الموقع',
    },
    de: {
        code: 'de',
        heading: 'Eingabegruppe',
        description: 'Gruppieren Sie Eingabefelder mit Erweiterungen wie Symbolen, Text und Schaltflächen.',
        searchPlaceholder: 'Suchen...',
        locationPlaceholder: 'Ort eingeben',
        locateButton: 'Suchen',
    },
    fr: {
        code: 'fr',
        heading: 'Groupe de champs',
        description: 'Regroupez les champs de saisie avec des extensions comme des icônes, du texte et des boutons.',
        searchPlaceholder: 'Rechercher...',
        locationPlaceholder: 'Entrez un lieu',
        locateButton: 'Localiser',
    },
    es: {
        code: 'es',
        heading: 'Grupo de entrada',
        description: 'Agrupe campos de entrada con complementos como iconos, texto y botones.',
        searchPlaceholder: 'Buscar...',
        locationPlaceholder: 'Ingresa una ubicación',
        locateButton: 'Localizar',
    },
    ja: {
        code: 'ja',
        heading: '入力グループ',
        description: 'アイコン、テキスト、ボタンなどのアドオンと組み合わせた入力フィールド。',
        searchPlaceholder: '検索...',
        locationPlaceholder: '場所を入力',
        locateButton: '探す',
    },
    zh: {
        code: 'zh',
        heading: '输入组',
        description: '将输入框与图标、文本和按钮等附加组件组合使用。',
        searchPlaceholder: '搜索...',
        locationPlaceholder: '输入位置',
        locateButton: '定位',
    },
    ru: {
        code: 'ru',
        heading: 'Группа полей',
        description: 'Группируйте поля ввода с дополнениями, такими как иконки, текст и кнопки.',
        searchPlaceholder: 'Поиск...',
        locationPlaceholder: 'Введите место',
        locateButton: 'Найти',
    },
    pt: {
        code: 'pt',
        heading: 'Grupo de entrada',
        description: 'Agrupe campos de entrada com complementos como ícones, texto e botões.',
        searchPlaceholder: 'Pesquisar...',
        locationPlaceholder: 'Inserir localização',
        locateButton: 'Localizar',
    },
};
