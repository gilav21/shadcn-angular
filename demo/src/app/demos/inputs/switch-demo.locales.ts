// demo/src/app/demos/inputs/switch-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface SwitchDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  basicHeading: string;
  airplaneModeLabel: string;
  inlineLabelHeading: string;
  notificationsLabel: string;
  disabledHeading: string;
  disabledLabel: string;
}

export const SWITCH_DEMO_LOCALES: Record<string, SwitchDemoLocale> = {
  en: {
    code: 'en',
    title: 'Switch',
    description: 'A control that allows the user to toggle between checked and not checked.',
    basicHeading: 'Basic',
    airplaneModeLabel: 'Airplane Mode',
    inlineLabelHeading: 'With Inline Label (Simple Mode)',
    notificationsLabel: 'Notifications',
    disabledHeading: 'Disabled',
    disabledLabel: 'Disabled Switch',
  },
  he: {
    code: 'he', rtl: true,
    title: 'מתג',
    description: 'פקד המאפשר למשתמש לעבור בין מצב מסומן ולא מסומן.',
    basicHeading: 'בסיסי',
    airplaneModeLabel: 'מצב טיסה',
    inlineLabelHeading: 'עם תווית מוטבעת (מצב פשוט)',
    notificationsLabel: 'התראות',
    disabledHeading: 'מושבת',
    disabledLabel: 'מתג מושבת',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'مفتاح التبديل',
    description: 'عنصر تحكم يتيح للمستخدم التبديل بين الحالة المحددة وغير المحددة.',
    basicHeading: 'أساسي',
    airplaneModeLabel: 'وضع الطيران',
    inlineLabelHeading: 'مع تسمية مضمّنة (الوضع البسيط)',
    notificationsLabel: 'الإشعارات',
    disabledHeading: 'معطّل',
    disabledLabel: 'مفتاح معطّل',
  },
  de: {
    code: 'de',
    title: 'Schalter',
    description: 'Ein Steuerelement, mit dem der Benutzer zwischen aktiviert und deaktiviert wechseln kann.',
    basicHeading: 'Einfach',
    airplaneModeLabel: 'Flugzeugmodus',
    inlineLabelHeading: 'Mit Inline-Beschriftung (Einfacher Modus)',
    notificationsLabel: 'Benachrichtigungen',
    disabledHeading: 'Deaktiviert',
    disabledLabel: 'Deaktivierter Schalter',
  },
  fr: {
    code: 'fr',
    title: 'Interrupteur',
    description: "Un contrôle permettant à l'utilisateur de basculer entre coché et non coché.",
    basicHeading: 'Basique',
    airplaneModeLabel: 'Mode avion',
    inlineLabelHeading: 'Avec étiquette intégrée (mode simple)',
    notificationsLabel: 'Notifications',
    disabledHeading: 'Désactivé',
    disabledLabel: 'Interrupteur désactivé',
  },
  es: {
    code: 'es',
    title: 'Interruptor',
    description: 'Un control que permite al usuario alternar entre marcado y no marcado.',
    basicHeading: 'Básico',
    airplaneModeLabel: 'Modo avión',
    inlineLabelHeading: 'Con etiqueta en línea (modo simple)',
    notificationsLabel: 'Notificaciones',
    disabledHeading: 'Deshabilitado',
    disabledLabel: 'Interruptor deshabilitado',
  },
  ja: {
    code: 'ja',
    title: 'スイッチ',
    description: 'ユーザーがオンとオフを切り替えられるコントロールです。',
    basicHeading: '基本',
    airplaneModeLabel: '機内モード',
    inlineLabelHeading: 'インラインラベル付き（シンプルモード）',
    notificationsLabel: '通知',
    disabledHeading: '無効',
    disabledLabel: '無効なスイッチ',
  },
  zh: {
    code: 'zh',
    title: '开关',
    description: '允许用户在选中和未选中之间切换的控件。',
    basicHeading: '基础',
    airplaneModeLabel: '飞行模式',
    inlineLabelHeading: '带内联标签（简单模式）',
    notificationsLabel: '通知',
    disabledHeading: '已禁用',
    disabledLabel: '已禁用开关',
  },
  ru: {
    code: 'ru',
    title: 'Переключатель',
    description: 'Элемент управления, позволяющий пользователю переключаться между включённым и выключенным состоянием.',
    basicHeading: 'Базовый',
    airplaneModeLabel: 'Режим полёта',
    inlineLabelHeading: 'Со встроенной меткой (простой режим)',
    notificationsLabel: 'Уведомления',
    disabledHeading: 'Отключён',
    disabledLabel: 'Отключённый переключатель',
  },
  pt: {
    code: 'pt',
    title: 'Alternância',
    description: 'Um controle que permite ao usuário alternar entre marcado e não marcado.',
    basicHeading: 'Básico',
    airplaneModeLabel: 'Modo avião',
    inlineLabelHeading: 'Com rótulo embutido (modo simples)',
    notificationsLabel: 'Notificações',
    disabledHeading: 'Desabilitado',
    disabledLabel: 'Alternância desabilitada',
  },
};
