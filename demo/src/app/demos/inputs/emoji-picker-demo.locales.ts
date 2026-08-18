import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface EmojiPickerDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  triggerLabel: string;
  closeOnSelectLabel: string;
  clippedLabel: string;
  clippedCaption: string;
}

export const EMOJI_PICKER_DEMO_LOCALES: Record<string, EmojiPickerDemoLocale> = {
  en: {
    code: 'en',
    title: 'Emoji Picker',
    description: 'A customizable emoji picker with category navigation and search.',
    triggerLabel: 'Pick an Emoji',
    closeOnSelectLabel: 'Close on select',
    clippedLabel: 'Inside a Clipped Card',
    clippedCaption: 'Try it: open the picker inside this overflow-hidden card — the popup renders in the browser top layer, so it is never clipped.',
  },
  he: {
    code: 'he', rtl: true,
    title: 'בורר אימוג\'י',
    description: 'בורר אימוג\'י מותאם אישית עם ניווט קטגוריות וחיפוש.',
    triggerLabel: 'בחר אימוג\'י',
    closeOnSelectLabel: 'סגור בבחירה',
    clippedLabel: 'בתוך כרטיס חתוך',
    clippedCaption: 'נסו: פתחו את הבורר בתוך הכרטיס עם overflow-hidden — החלונית מוצגת בשכבה העליונה של הדפדפן ולכן אינה נחתכת.',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'منتقي الرموز التعبيرية',
    description: 'منتقي رموز تعبيرية قابل للتخصيص مع التنقل بين الفئات والبحث.',
    triggerLabel: 'اختر رمزًا تعبيريًا',
    closeOnSelectLabel: 'إغلاق عند الاختيار',
    clippedLabel: 'داخل بطاقة مقصوصة',
    clippedCaption: 'جرّب: افتح المنتقي داخل هذه البطاقة ذات overflow-hidden — تُعرض النافذة المنبثقة في الطبقة العليا للمتصفح فلا تُقتطع أبدًا.',
  },
  de: {
    code: 'de',
    title: 'Emoji-Auswahl',
    description: 'Eine anpassbare Emoji-Auswahl mit Kategorienavigation und Suche.',
    triggerLabel: 'Emoji auswählen',
    closeOnSelectLabel: 'Bei Auswahl schließen',
    clippedLabel: 'In einer beschnittenen Karte',
    clippedCaption: 'Zum Ausprobieren: Auswahl in dieser Karte mit overflow-hidden öffnen — das Popup wird in der obersten Browser-Ebene gerendert und daher nie abgeschnitten.',
  },
  fr: {
    code: 'fr',
    title: 'Sélecteur d\'emoji',
    description: 'Un sélecteur d\'emoji personnalisable avec navigation par catégorie et recherche.',
    triggerLabel: 'Choisir un emoji',
    closeOnSelectLabel: 'Fermer à la sélection',
    clippedLabel: 'Dans une carte rognée',
    clippedCaption: 'À essayer : ouvrez le sélecteur dans cette carte en overflow-hidden — la fenêtre s’affiche dans la couche supérieure du navigateur et n’est jamais rognée.',
  },
  es: {
    code: 'es',
    title: 'Selector de emoji',
    description: 'Un selector de emoji personalizable con navegación por categorías y búsqueda.',
    triggerLabel: 'Elegir un emoji',
    closeOnSelectLabel: 'Cerrar al seleccionar',
    clippedLabel: 'Dentro de una tarjeta recortada',
    clippedCaption: 'Pruébalo: abre el selector dentro de esta tarjeta con overflow-hidden; el desplegable se dibuja en la capa superior del navegador, así que nunca se recorta.',
  },
  ja: {
    code: 'ja',
    title: '絵文字ピッカー',
    description: 'カテゴリナビゲーションと検索機能を備えたカスタマイズ可能な絵文字ピッカーです。',
    triggerLabel: '絵文字を選ぶ',
    closeOnSelectLabel: '選択時に閉じる',
    clippedLabel: '切り取られたカードの中',
    clippedCaption: 'お試し: overflow-hidden のカード内でピッカーを開いてください。ポップアップはブラウザーの最前面レイヤーに描画されるため、切り取られません。',
  },
  zh: {
    code: 'zh',
    title: '表情符号选择器',
    description: '带有类别导航和搜索功能的可自定义表情符号选择器。',
    triggerLabel: '选择表情符号',
    closeOnSelectLabel: '选择后关闭',
    clippedLabel: '在被裁剪的卡片内',
    clippedCaption: '试试看：在这个 overflow-hidden 卡片内打开选择器——弹出层渲染在浏览器顶层，不会被裁剪。',
  },
  ru: {
    code: 'ru',
    title: 'Выбор эмодзи',
    description: 'Настраиваемый выбор эмодзи с навигацией по категориям и поиском.',
    triggerLabel: 'Выбрать эмодзи',
    closeOnSelectLabel: 'Закрыть при выборе',
    clippedLabel: 'Внутри обрезанной карточки',
    clippedCaption: 'Попробуйте: откройте выбор эмодзи внутри карточки с overflow-hidden — всплывающее окно отрисовывается в верхнем слое браузера и не обрезается.',
  },
  pt: {
    code: 'pt',
    title: 'Seletor de emoji',
    description: 'Um seletor de emoji personalizável com navegação por categorias e pesquisa.',
    triggerLabel: 'Escolher um emoji',
    closeOnSelectLabel: 'Fechar ao selecionar',
    clippedLabel: 'Dentro de um cartão recortado',
    clippedCaption: 'Experimente: abra o seletor dentro deste cartão com overflow-hidden — o pop-up é renderizado na camada superior do navegador e nunca é cortado.',
  },
};
