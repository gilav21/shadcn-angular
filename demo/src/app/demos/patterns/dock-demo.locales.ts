import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface DockItem {
  label: string;
  icon: string;
  active: boolean;
}

export interface DockDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  magnificationLabel: string;
  distanceLabel: string;
  simpleModeHeading: string;
  simpleModeDescription: string;
  dockItems: ReadonlyArray<DockItem>;
}

export const DOCK_DEMO_LOCALES: Record<string, DockDemoLocale> = {
  en: {
    code: 'en',
    title: 'Dock',
    description: 'A macOS-style dock with magnification effect.',
    magnificationLabel: 'Magnification',
    distanceLabel: 'Distance',
    simpleModeHeading: 'Simple Mode (Data-driven)',
    simpleModeDescription: 'Using the items input array.',
    dockItems: [
      { label: 'Home', icon: '🏠', active: true },
      { label: 'Profile', icon: '👤', active: false },
      { label: 'Settings', icon: '⚙️', active: false },
      { label: 'Messages', icon: '✉️', active: false },
      { label: 'Calendar', icon: '📅', active: false },
    ],
  },
  he: {
    code: 'he', rtl: true,
    title: 'מזח',
    description: 'מזח בסגנון macOS עם אפקט הגדלה.',
    magnificationLabel: 'הגדלה',
    distanceLabel: 'מרחק',
    simpleModeHeading: 'מצב פשוט (מבוסס נתונים)',
    simpleModeDescription: 'שימוש במערך קלט פריטים.',
    dockItems: [
      { label: 'בית', icon: '🏠', active: true },
      { label: 'פרופיל', icon: '👤', active: false },
      { label: 'הגדרות', icon: '⚙️', active: false },
      { label: 'הודעות', icon: '✉️', active: false },
      { label: 'לוח שנה', icon: '📅', active: false },
    ],
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'رصيف',
    description: 'رصيف بنمط macOS مع تأثير التكبير.',
    magnificationLabel: 'التكبير',
    distanceLabel: 'المسافة',
    simpleModeHeading: 'الوضع البسيط (مدفوع بالبيانات)',
    simpleModeDescription: 'باستخدام مصفوفة إدخال العناصر.',
    dockItems: [
      { label: 'الرئيسية', icon: '🏠', active: true },
      { label: 'الملف الشخصي', icon: '👤', active: false },
      { label: 'الإعدادات', icon: '⚙️', active: false },
      { label: 'الرسائل', icon: '✉️', active: false },
      { label: 'التقويم', icon: '📅', active: false },
    ],
  },
  de: {
    code: 'de',
    title: 'Dock',
    description: 'Ein macOS-artiges Dock mit Vergrößerungseffekt.',
    magnificationLabel: 'Vergrößerung',
    distanceLabel: 'Abstand',
    simpleModeHeading: 'Einfacher Modus (datengesteuert)',
    simpleModeDescription: 'Nutzt das Elemente-Eingabe-Array.',
    dockItems: [
      { label: 'Startseite', icon: '🏠', active: true },
      { label: 'Profil', icon: '👤', active: false },
      { label: 'Einstellungen', icon: '⚙️', active: false },
      { label: 'Nachrichten', icon: '✉️', active: false },
      { label: 'Kalender', icon: '📅', active: false },
    ],
  },
  fr: {
    code: 'fr',
    title: 'Dock',
    description: 'Un dock de style macOS avec effet de grossissement.',
    magnificationLabel: 'Grossissement',
    distanceLabel: 'Distance',
    simpleModeHeading: 'Mode simple (basé sur les données)',
    simpleModeDescription: 'Utilise le tableau d\'entrée d\'éléments.',
    dockItems: [
      { label: 'Accueil', icon: '🏠', active: true },
      { label: 'Profil', icon: '👤', active: false },
      { label: 'Paramètres', icon: '⚙️', active: false },
      { label: 'Messages', icon: '✉️', active: false },
      { label: 'Calendrier', icon: '📅', active: false },
    ],
  },
  es: {
    code: 'es',
    title: 'Dock',
    description: 'Un dock estilo macOS con efecto de ampliación.',
    magnificationLabel: 'Ampliación',
    distanceLabel: 'Distancia',
    simpleModeHeading: 'Modo simple (basado en datos)',
    simpleModeDescription: 'Usa el array de entrada de elementos.',
    dockItems: [
      { label: 'Inicio', icon: '🏠', active: true },
      { label: 'Perfil', icon: '👤', active: false },
      { label: 'Configuración', icon: '⚙️', active: false },
      { label: 'Mensajes', icon: '✉️', active: false },
      { label: 'Calendario', icon: '📅', active: false },
    ],
  },
  ja: {
    code: 'ja',
    title: 'ドック',
    description: '拡大効果付きのmacOSスタイルドック。',
    magnificationLabel: '拡大率',
    distanceLabel: '距離',
    simpleModeHeading: 'シンプルモード（データ駆動）',
    simpleModeDescription: 'アイテム入力配列を使用します。',
    dockItems: [
      { label: 'ホーム', icon: '🏠', active: true },
      { label: 'プロフィール', icon: '👤', active: false },
      { label: '設定', icon: '⚙️', active: false },
      { label: 'メッセージ', icon: '✉️', active: false },
      { label: 'カレンダー', icon: '📅', active: false },
    ],
  },
  zh: {
    code: 'zh',
    title: 'Dock栏',
    description: '带放大效果的macOS风格Dock栏。',
    magnificationLabel: '放大倍数',
    distanceLabel: '距离',
    simpleModeHeading: '简单模式（数据驱动）',
    simpleModeDescription: '使用项目输入数组。',
    dockItems: [
      { label: '主页', icon: '🏠', active: true },
      { label: '个人资料', icon: '👤', active: false },
      { label: '设置', icon: '⚙️', active: false },
      { label: '消息', icon: '✉️', active: false },
      { label: '日历', icon: '📅', active: false },
    ],
  },
  ru: {
    code: 'ru',
    title: 'Dock',
    description: 'Dock в стиле macOS с эффектом увеличения.',
    magnificationLabel: 'Увеличение',
    distanceLabel: 'Расстояние',
    simpleModeHeading: 'Простой режим (управляемый данными)',
    simpleModeDescription: 'Использует входной массив элементов.',
    dockItems: [
      { label: 'Главная', icon: '🏠', active: true },
      { label: 'Профиль', icon: '👤', active: false },
      { label: 'Настройки', icon: '⚙️', active: false },
      { label: 'Сообщения', icon: '✉️', active: false },
      { label: 'Календарь', icon: '📅', active: false },
    ],
  },
  pt: {
    code: 'pt',
    title: 'Dock',
    description: 'Um dock estilo macOS com efeito de ampliação.',
    magnificationLabel: 'Ampliação',
    distanceLabel: 'Distância',
    simpleModeHeading: 'Modo simples (orientado a dados)',
    simpleModeDescription: 'Usa o array de entrada de itens.',
    dockItems: [
      { label: 'Início', icon: '🏠', active: true },
      { label: 'Perfil', icon: '👤', active: false },
      { label: 'Configurações', icon: '⚙️', active: false },
      { label: 'Mensagens', icon: '✉️', active: false },
      { label: 'Calendário', icon: '📅', active: false },
    ],
  },
};
