import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface StatCardDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  trendsHeading: string;
  trendsDescription: string;
  noDeltaHeading: string;
  noDeltaDescription: string;
  sparklineHeading: string;
  sparklineDescription: string;
  truncationHeading: string;
  truncationDescription: string;
  stylingHeading: string;
  stylingDescription: string;
  revenue: string;
  orders: string;
  sessions: string;
  churnRate: string;
  activeUsers: string;
  openTickets: string;
  errorRate: string;
  longLabel: string;
}

export const STAT_CARD_DEMO_LOCALES: Record<string, StatCardDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Stat Card',
    description:
      'A KPI tile — label, value, an optional delta badge and an optional projected sparkline. This is the tile the dashboard block is built from.',
    trendsHeading: 'Trends',
    trendsDescription:
      'The trend drives both the badge colour and the arrow. It describes whether the change is favourable, not the sign of the delta — a falling churn rate trends up.',
    noDeltaHeading: 'Without a delta',
    noDeltaDescription:
      'Leave the delta unset and the badge is omitted entirely, rather than rendered blank.',
    sparklineHeading: 'With a projected sparkline',
    sparklineDescription:
      'Anything you project renders under the value — a chart, a progress bar, a row of avatars.',
    truncationHeading: 'Long text truncates',
    truncationDescription:
      'A long label or value is clipped with an ellipsis instead of widening its grid column.',
    stylingHeading: 'Restyling a tile',
    stylingDescription:
      'The class input lands on the card surface, so borders, rings and backgrounds apply to the tile itself.',
    revenue: 'Revenue',
    orders: 'Orders',
    sessions: 'Sessions',
    churnRate: 'Churn rate',
    activeUsers: 'Active users',
    openTickets: 'Open tickets',
    errorRate: 'Error rate',
    longLabel: 'Monthly recurring revenue across every region',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'כרטיס נתון',
    description:
      'אריח מדד — תווית, ערך, תג שינוי אופציונלי וגרף מוקרן אופציונלי. זהו האריח שממנו בנוי בלוק לוח המחוונים.',
    trendsHeading: 'מגמות',
    trendsDescription:
      'המגמה קובעת גם את צבע התג וגם את החץ. היא מתארת אם השינוי חיובי, לא את הסימן של השינוי — ירידה בנטישה היא מגמה עולה.',
    noDeltaHeading: 'ללא שינוי',
    noDeltaDescription: 'אם לא מגדירים שינוי, התג מושמט לחלוטין ולא מוצג ריק.',
    sparklineHeading: 'עם גרף מוקרן',
    sparklineDescription:
      'כל תוכן שתקרין מוצג מתחת לערך — גרף, סרגל התקדמות או שורת אווטרים.',
    truncationHeading: 'טקסט ארוך נחתך',
    truncationDescription:
      'תווית או ערך ארוכים נחתכים בשלוש נקודות במקום להרחיב את עמודת הרשת.',
    stylingHeading: 'עיצוב מחדש של אריח',
    stylingDescription:
      'הקלט class מוחל על משטח הכרטיס, כך שמסגרות, טבעות ורקעים חלים על האריח עצמו.',
    revenue: 'הכנסות',
    orders: 'הזמנות',
    sessions: 'הפעלות',
    churnRate: 'שיעור נטישה',
    activeUsers: 'משתמשים פעילים',
    openTickets: 'פניות פתוחות',
    errorRate: 'שיעור שגיאות',
    longLabel: 'הכנסה חודשית חוזרת בכל האזורים',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'بطاقة إحصائية',
    description:
      'لوحة مؤشر أداء — تسمية وقيمة وشارة تغيّر اختيارية ورسم بياني مصغّر اختياري. هذه هي اللوحة التي بُني منها قسم لوحة المعلومات.',
    trendsHeading: 'الاتجاهات',
    trendsDescription:
      'يحدّد الاتجاه لون الشارة والسهم معًا. وهو يصف ما إذا كان التغيّر مواتيًا، لا إشارة الرقم — فانخفاض معدل التسرّب اتجاه صاعد.',
    noDeltaHeading: 'بدون تغيّر',
    noDeltaDescription: 'اترك التغيّر غير محدّد فتُحذف الشارة تمامًا بدل عرضها فارغة.',
    sparklineHeading: 'مع رسم بياني مصغّر',
    sparklineDescription:
      'كل ما تعرضه يظهر أسفل القيمة — رسم بياني أو شريط تقدّم أو صف صور رمزية.',
    truncationHeading: 'اقتطاع النص الطويل',
    truncationDescription:
      'تُقتطع التسمية أو القيمة الطويلة بعلامة حذف بدل توسيع عمود الشبكة.',
    stylingHeading: 'إعادة تنسيق اللوحة',
    stylingDescription:
      'يُطبَّق مُدخل class على سطح البطاقة، فتنطبق الحدود والحلقات والخلفيات على اللوحة نفسها.',
    revenue: 'الإيرادات',
    orders: 'الطلبات',
    sessions: 'الجلسات',
    churnRate: 'معدل التسرّب',
    activeUsers: 'المستخدمون النشطون',
    openTickets: 'التذاكر المفتوحة',
    errorRate: 'معدل الأخطاء',
    longLabel: 'الإيرادات الشهرية المتكرّرة في جميع المناطق',
  },
  de: {
    code: 'de',
    heading: 'Kennzahlenkarte',
    description:
      'Eine KPI-Kachel — Bezeichnung, Wert, optionales Veränderungs-Badge und optionale projizierte Sparkline. Aus dieser Kachel besteht der Dashboard-Block.',
    trendsHeading: 'Trends',
    trendsDescription:
      'Der Trend bestimmt sowohl die Badge-Farbe als auch den Pfeil. Er beschreibt, ob die Veränderung günstig ist, nicht das Vorzeichen — eine sinkende Abwanderungsrate steigt im Trend.',
    noDeltaHeading: 'Ohne Veränderung',
    noDeltaDescription:
      'Ohne gesetzte Veränderung entfällt das Badge vollständig, statt leer gerendert zu werden.',
    sparklineHeading: 'Mit projizierter Sparkline',
    sparklineDescription:
      'Alles Projizierte erscheint unter dem Wert — ein Diagramm, ein Fortschrittsbalken, eine Avatarreihe.',
    truncationHeading: 'Langer Text wird gekürzt',
    truncationDescription:
      'Lange Bezeichnungen oder Werte werden mit Auslassungspunkten beschnitten, statt die Rasterspalte zu verbreitern.',
    stylingHeading: 'Kachel umgestalten',
    stylingDescription:
      'Die class-Eingabe landet auf der Kartenfläche, sodass Rahmen, Ringe und Hintergründe für die Kachel selbst gelten.',
    revenue: 'Umsatz',
    orders: 'Bestellungen',
    sessions: 'Sitzungen',
    churnRate: 'Abwanderungsrate',
    activeUsers: 'Aktive Nutzer',
    openTickets: 'Offene Tickets',
    errorRate: 'Fehlerrate',
    longLabel: 'Monatlich wiederkehrender Umsatz über alle Regionen',
  },
  fr: {
    code: 'fr',
    heading: 'Carte de statistique',
    description:
      'Une tuile d’indicateur — libellé, valeur, badge de variation facultatif et sparkline projetée facultative. C’est la tuile dont est fait le bloc tableau de bord.',
    trendsHeading: 'Tendances',
    trendsDescription:
      'La tendance détermine à la fois la couleur du badge et la flèche. Elle décrit si la variation est favorable, non son signe — un taux d’attrition en baisse est une tendance à la hausse.',
    noDeltaHeading: 'Sans variation',
    noDeltaDescription:
      'Sans variation définie, le badge est omis entièrement plutôt que rendu vide.',
    sparklineHeading: 'Avec une sparkline projetée',
    sparklineDescription:
      'Tout contenu projeté s’affiche sous la valeur — un graphique, une barre de progression, une rangée d’avatars.',
    truncationHeading: 'Le texte long est tronqué',
    truncationDescription:
      'Un libellé ou une valeur trop long est coupé par des points de suspension au lieu d’élargir la colonne.',
    stylingHeading: 'Restyler une tuile',
    stylingDescription:
      'L’entrée class s’applique à la surface de la carte : bordures, anneaux et arrière-plans visent la tuile elle-même.',
    revenue: 'Chiffre d’affaires',
    orders: 'Commandes',
    sessions: 'Sessions',
    churnRate: 'Taux d’attrition',
    activeUsers: 'Utilisateurs actifs',
    openTickets: 'Tickets ouverts',
    errorRate: 'Taux d’erreur',
    longLabel: 'Revenu récurrent mensuel sur toutes les régions',
  },
  es: {
    code: 'es',
    heading: 'Tarjeta de estadística',
    description:
      'Un mosaico de KPI: etiqueta, valor, insignia de variación opcional y minigráfico proyectado opcional. Es el mosaico con el que se construye el bloque de panel.',
    trendsHeading: 'Tendencias',
    trendsDescription:
      'La tendencia determina tanto el color de la insignia como la flecha. Describe si el cambio es favorable, no su signo: una tasa de abandono a la baja es tendencia al alza.',
    noDeltaHeading: 'Sin variación',
    noDeltaDescription:
      'Si no defines la variación, la insignia se omite por completo en lugar de mostrarse vacía.',
    sparklineHeading: 'Con minigráfico proyectado',
    sparklineDescription:
      'Todo lo que proyectes se muestra bajo el valor: un gráfico, una barra de progreso, una fila de avatares.',
    truncationHeading: 'El texto largo se recorta',
    truncationDescription:
      'Una etiqueta o valor largo se recorta con puntos suspensivos en vez de ensanchar la columna.',
    stylingHeading: 'Reestilizar un mosaico',
    stylingDescription:
      'La entrada class se aplica a la superficie de la tarjeta, así que bordes, anillos y fondos afectan al mosaico.',
    revenue: 'Ingresos',
    orders: 'Pedidos',
    sessions: 'Sesiones',
    churnRate: 'Tasa de abandono',
    activeUsers: 'Usuarios activos',
    openTickets: 'Tickets abiertos',
    errorRate: 'Tasa de errores',
    longLabel: 'Ingresos recurrentes mensuales en todas las regiones',
  },
  ja: {
    code: 'ja',
    heading: '統計カード',
    description:
      'KPI タイル — ラベル、値、任意の変化バッジ、任意の投影スパークライン。ダッシュボードブロックはこのタイルで構成されています。',
    trendsHeading: 'トレンド',
    trendsDescription:
      'トレンドはバッジの色と矢印の両方を決めます。数値の符号ではなく変化が好ましいかどうかを表すため、解約率の低下は上昇トレンドです。',
    noDeltaHeading: '変化なし',
    noDeltaDescription: '変化を指定しなければ、バッジは空で描画されず完全に省略されます。',
    sparklineHeading: '投影スパークライン付き',
    sparklineDescription:
      '投影した内容は値の下に表示されます — グラフ、進捗バー、アバターの列など。',
    truncationHeading: '長いテキストは省略',
    truncationDescription:
      '長いラベルや値は、グリッド列を広げる代わりに省略記号で切り詰められます。',
    stylingHeading: 'タイルの再スタイル',
    stylingDescription:
      'class 入力はカード面に適用されるため、枠線・リング・背景はタイル自体に効きます。',
    revenue: '収益',
    orders: '注文',
    sessions: 'セッション',
    churnRate: '解約率',
    activeUsers: 'アクティブユーザー',
    openTickets: '未対応チケット',
    errorRate: 'エラー率',
    longLabel: '全地域の月次経常収益',
  },
  zh: {
    code: 'zh',
    heading: '指标卡',
    description:
      'KPI 磁贴——标签、数值、可选的变化徽章和可选的投影迷你图。仪表板区块正是由这种磁贴构成的。',
    trendsHeading: '趋势',
    trendsDescription:
      '趋势同时决定徽章颜色和箭头。它描述变化是否有利，而非数值的正负——流失率下降属于上升趋势。',
    noDeltaHeading: '不带变化值',
    noDeltaDescription: '不设置变化值时，徽章会被整体省略，而不是渲染为空。',
    sparklineHeading: '带投影迷你图',
    sparklineDescription: '投影的任何内容都显示在数值下方——图表、进度条或头像行。',
    truncationHeading: '长文本截断',
    truncationDescription: '过长的标签或数值会以省略号截断，而不是撑宽网格列。',
    stylingHeading: '重新设计磁贴样式',
    stylingDescription: 'class 输入作用于卡片表面，因此边框、描边环和背景都作用于磁贴本身。',
    revenue: '收入',
    orders: '订单',
    sessions: '会话',
    churnRate: '流失率',
    activeUsers: '活跃用户',
    openTickets: '待处理工单',
    errorRate: '错误率',
    longLabel: '所有地区的月度经常性收入',
  },
  ru: {
    code: 'ru',
    heading: 'Карточка показателя',
    description:
      'Плитка KPI — подпись, значение, необязательный бейдж изменения и необязательный спарклайн. Именно из таких плиток собран блок панели.',
    trendsHeading: 'Тренды',
    trendsDescription:
      'Тренд задаёт и цвет бейджа, и стрелку. Он описывает, благоприятно ли изменение, а не знак числа: снижение оттока — это восходящий тренд.',
    noDeltaHeading: 'Без изменения',
    noDeltaDescription:
      'Если изменение не задано, бейдж полностью опускается, а не отображается пустым.',
    sparklineHeading: 'Со спарклайном',
    sparklineDescription:
      'Всё спроецированное отображается под значением — график, полоса прогресса, ряд аватаров.',
    truncationHeading: 'Длинный текст обрезается',
    truncationDescription:
      'Длинная подпись или значение обрезается многоточием вместо расширения колонки сетки.',
    stylingHeading: 'Перестилизация плитки',
    stylingDescription:
      'Входной параметр class применяется к поверхности карточки, поэтому рамки, кольца и фон действуют на саму плитку.',
    revenue: 'Выручка',
    orders: 'Заказы',
    sessions: 'Сессии',
    churnRate: 'Отток',
    activeUsers: 'Активные пользователи',
    openTickets: 'Открытые обращения',
    errorRate: 'Доля ошибок',
    longLabel: 'Регулярная месячная выручка по всем регионам',
  },
  pt: {
    code: 'pt',
    heading: 'Cartão de estatística',
    description:
      'Um bloco de KPI — rótulo, valor, selo de variação opcional e minigráfico projetado opcional. É o bloco de que o bloco de painel é feito.',
    trendsHeading: 'Tendências',
    trendsDescription:
      'A tendência define tanto a cor do selo quanto a seta. Ela descreve se a mudança é favorável, não o sinal do número — uma taxa de cancelamento em queda é tendência de alta.',
    noDeltaHeading: 'Sem variação',
    noDeltaDescription:
      'Sem variação definida, o selo é omitido por completo em vez de ser renderizado vazio.',
    sparklineHeading: 'Com minigráfico projetado',
    sparklineDescription:
      'Tudo o que você projetar aparece abaixo do valor — um gráfico, uma barra de progresso, uma fila de avatares.',
    truncationHeading: 'Texto longo é truncado',
    truncationDescription:
      'Um rótulo ou valor longo é cortado com reticências em vez de alargar a coluna da grade.',
    stylingHeading: 'Reestilizar um bloco',
    stylingDescription:
      'A entrada class é aplicada à superfície do cartão, então bordas, anéis e fundos afetam o próprio bloco.',
    revenue: 'Receita',
    orders: 'Pedidos',
    sessions: 'Sessões',
    churnRate: 'Taxa de cancelamento',
    activeUsers: 'Usuários ativos',
    openTickets: 'Chamados abertos',
    errorRate: 'Taxa de erros',
    longLabel: 'Receita recorrente mensal em todas as regiões',
  },
};
