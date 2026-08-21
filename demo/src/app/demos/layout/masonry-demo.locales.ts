import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface MasonryDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  responsiveLabel: string;
  domOrderNote: string;
  addCard: string;
  removeCard: string;
  cardPrefix: string;
}

export const MASONRY_DEMO_LOCALES: Record<string, MasonryDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Masonry',
    description: 'Column-balanced layout for items of uneven height.',
    responsiveLabel: '1 column on a phone, 2 from 640px, 3 from 1024px — measured on the container, not the viewport.',
    domOrderNote: 'Items stay in source order in the DOM, so tabbing through them follows the visual reading order — the thing CSS columns cannot do.',
    addCard: 'Add card',
    removeCard: 'Remove card',
    cardPrefix: 'Card',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'מייסונרי',
    description: 'פריסה מאוזנת בעמודות לפריטים בגבהים שונים.',
    responsiveLabel: 'עמודה אחת בטלפון, שתיים מ-640px, שלוש מ-1024px — נמדד לפי המכל ולא לפי חלון התצוגה.',
    domOrderNote: 'הפריטים נשארים בסדר המקור ב-DOM, כך שמעבר ב-Tab עוקב אחר סדר הקריאה החזותי — מה שעמודות CSS לא מסוגלות לעשות.',
    addCard: 'הוסף כרטיס',
    removeCard: 'הסר כרטיס',
    cardPrefix: 'כרטיס',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'تخطيط متدرج',
    description: 'تخطيط متوازن الأعمدة لعناصر متفاوتة الارتفاع.',
    responsiveLabel: 'عمود واحد على الهاتف، وعمودان من 640 بكسل، وثلاثة من 1024 بكسل — يُقاس على الحاوية لا على نافذة العرض.',
    domOrderNote: 'تبقى العناصر بترتيب المصدر في DOM، لذا يتبع التنقل بمفتاح Tab ترتيب القراءة المرئي — وهو ما لا تستطيعه أعمدة CSS.',
    addCard: 'إضافة بطاقة',
    removeCard: 'إزالة بطاقة',
    cardPrefix: 'بطاقة',
  },
  de: {
    code: 'de',
    heading: 'Masonry',
    description: 'Spaltenausgeglichenes Layout für Elemente ungleicher Höhe.',
    responsiveLabel: '1 Spalte auf dem Handy, 2 ab 640px, 3 ab 1024px — gemessen am Container, nicht am Viewport.',
    domOrderNote: 'Elemente bleiben in Quellreihenfolge im DOM, sodass die Tab-Reihenfolge der visuellen Lesereihenfolge folgt — was CSS-Spalten nicht können.',
    addCard: 'Karte hinzufügen',
    removeCard: 'Karte entfernen',
    cardPrefix: 'Karte',
  },
  fr: {
    code: 'fr',
    heading: 'Masonry',
    description: 'Disposition en colonnes équilibrées pour des éléments de hauteurs inégales.',
    responsiveLabel: '1 colonne sur mobile, 2 à partir de 640px, 3 à partir de 1024px — mesuré sur le conteneur, pas sur la fenêtre.',
    domOrderNote: "Les éléments restent dans l'ordre source du DOM, donc la tabulation suit l'ordre de lecture visuel — ce que les colonnes CSS ne permettent pas.",
    addCard: 'Ajouter une carte',
    removeCard: 'Retirer une carte',
    cardPrefix: 'Carte',
  },
  es: {
    code: 'es',
    heading: 'Masonry',
    description: 'Disposición de columnas equilibradas para elementos de altura desigual.',
    responsiveLabel: '1 columna en móvil, 2 desde 640px, 3 desde 1024px: se mide en el contenedor, no en la ventana.',
    domOrderNote: 'Los elementos conservan el orden de origen en el DOM, así que tabular sigue el orden de lectura visual, algo que las columnas CSS no logran.',
    addCard: 'Añadir tarjeta',
    removeCard: 'Quitar tarjeta',
    cardPrefix: 'Tarjeta',
  },
  ja: {
    code: 'ja',
    heading: 'メイソンリー',
    description: '高さが不揃いな要素のための、列バランス型レイアウト。',
    responsiveLabel: 'スマホで 1 列、640px から 2 列、1024px から 3 列 — ビューポートではなくコンテナ幅で判定します。',
    domOrderNote: '要素は DOM 上でソース順のまま保たれるため、Tab 移動が視覚的な読み順と一致します。CSS カラムにはできないことです。',
    addCard: 'カードを追加',
    removeCard: 'カードを削除',
    cardPrefix: 'カード',
  },
  zh: {
    code: 'zh',
    heading: '瀑布流',
    description: '为高度参差的元素提供列平衡布局。',
    responsiveLabel: '手机 1 列，640px 起 2 列，1024px 起 3 列 —— 依据容器宽度而非视口。',
    domOrderNote: '元素在 DOM 中保持源顺序，因此 Tab 键顺序与视觉阅读顺序一致 —— 这正是 CSS 多列做不到的。',
    addCard: '添加卡片',
    removeCard: '移除卡片',
    cardPrefix: '卡片',
  },
  ru: {
    code: 'ru',
    heading: 'Кладка',
    description: 'Раскладка со сбалансированными колонками для элементов разной высоты.',
    responsiveLabel: '1 колонка на телефоне, 2 от 640px, 3 от 1024px — измеряется по контейнеру, а не по окну.',
    domOrderNote: 'Элементы сохраняют исходный порядок в DOM, поэтому обход по Tab совпадает с визуальным порядком чтения — чего колонки CSS не дают.',
    addCard: 'Добавить карточку',
    removeCard: 'Убрать карточку',
    cardPrefix: 'Карточка',
  },
  pt: {
    code: 'pt',
    heading: 'Masonry',
    description: 'Layout de colunas equilibradas para itens de altura desigual.',
    responsiveLabel: '1 coluna no celular, 2 a partir de 640px, 3 a partir de 1024px — medido no contêiner, não na viewport.',
    domOrderNote: 'Os itens permanecem na ordem de origem no DOM, então a navegação por Tab segue a ordem visual de leitura — o que colunas CSS não fazem.',
    addCard: 'Adicionar cartão',
    removeCard: 'Remover cartão',
    cardPrefix: 'Cartão',
  },
};
