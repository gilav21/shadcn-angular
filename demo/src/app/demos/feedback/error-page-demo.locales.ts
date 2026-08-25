import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ErrorPageDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  codesHeading: string;
  codesDescription: string;
  fallbackHeading: string;
  fallbackDescription: string;
  copyHeading: string;
  copyDescription: string;
  illustrationHeading: string;
  illustrationDescription: string;
  actionsHeading: string;
  actionsDescription: string;
  outputsHeading: string;
  outputsDescription: string;
  lastEvent: string;
  noEvent: string;
  movedTitle: string;
  movedDescription: string;
  tryAgain: string;
  statusPage: string;
}

export const ERROR_PAGE_DEMO_LOCALES: Record<string, ErrorPageDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Error Page',
    description:
      'A full-page 404 / 403 / 500 state with an illustration slot, message and recovery actions.',
    codesHeading: 'Known codes',
    codesDescription:
      'Each shipped code has default copy in error-page.locales.ts, so a 404 route looks right on day one.',
    fallbackHeading: 'Unknown codes',
    fallbackDescription:
      'Any code without shipped copy falls back to a generic message rather than rendering blank.',
    copyHeading: 'Custom copy',
    copyDescription:
      'Title and description each override the code default independently.',
    illustrationHeading: 'Custom illustration',
    illustrationDescription:
      'A projected illustration replaces the typographic code rather than joining it.',
    actionsHeading: 'Custom actions',
    actionsDescription:
      'Projected actions replace both defaults. The built-in outputs stop firing once you do this, so wire your own handlers.',
    outputsHeading: 'Outputs, not routing',
    outputsDescription:
      'The component never routes. It emits goBack and goHome and leaves the destination entirely to you — press a button to see the event land here.',
    lastEvent: 'Last event',
    noEvent: 'nothing yet',
    movedTitle: 'This page moved',
    movedDescription: 'We reorganised the docs. Try the new address instead.',
    tryAgain: 'Try again',
    statusPage: 'Check status page',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'דף שגיאה',
    description: 'מצב שגיאה מלא-עמוד (404 / 403 / 500) עם איור, הודעה ופעולות התאוששות.',
    codesHeading: 'קודים מוכרים',
    codesDescription:
      'לכל קוד שנשלח יש נוסח ברירת מחדל ב-error-page.locales.ts, כך שנתיב 404 נראה נכון מהיום הראשון.',
    fallbackHeading: 'קודים לא מוכרים',
    fallbackDescription: 'קוד ללא נוסח ייעודי נופל לנוסח כללי במקום להיות ריק.',
    copyHeading: 'נוסח מותאם',
    copyDescription: 'הכותרת והתיאור דורסים כל אחד בנפרד את ברירת המחדל של הקוד.',
    illustrationHeading: 'איור מותאם',
    illustrationDescription: 'איור מוקרן מחליף את הקוד הטיפוגרפי במקום להצטרף אליו.',
    actionsHeading: 'פעולות מותאמות',
    actionsDescription:
      'פעולות מוקרנות מחליפות את שתי ברירות המחדל. הפלטים המובנים מפסיקים לפעול, אז חברו מטפלים משלכם.',
    outputsHeading: 'פלטים, לא ניתוב',
    outputsDescription:
      'הרכיב לעולם אינו מנתב. הוא פולט goBack ו-goHome ומשאיר לכם את היעד — לחצו כדי לראות את האירוע כאן.',
    lastEvent: 'האירוע האחרון',
    noEvent: 'עדיין כלום',
    movedTitle: 'הדף הזה הועבר',
    movedDescription: 'ארגנו מחדש את התיעוד. נסו את הכתובת החדשה.',
    tryAgain: 'נסו שוב',
    statusPage: 'בדקו את דף הסטטוס',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'صفحة الخطأ',
    description: 'حالة خطأ بملء الصفحة (404 / 403 / 500) مع رسم توضيحي ورسالة وإجراءات تعافٍ.',
    codesHeading: 'الرموز المعروفة',
    codesDescription:
      'لكل رمز مشمول نص افتراضي في error-page.locales.ts، فيبدو مسار 404 صحيحًا من اليوم الأول.',
    fallbackHeading: 'الرموز غير المعروفة',
    fallbackDescription: 'أي رمز بلا نص مخصّص يعود إلى رسالة عامة بدل أن يظهر فارغًا.',
    copyHeading: 'نص مخصّص',
    copyDescription: 'يتجاوز العنوان والوصف كلٌّ على حدة النص الافتراضي للرمز.',
    illustrationHeading: 'رسم توضيحي مخصّص',
    illustrationDescription: 'الرسم المعروض يحلّ محل الرمز الطباعي بدل أن يُضاف إليه.',
    actionsHeading: 'إجراءات مخصّصة',
    actionsDescription:
      'تحلّ الإجراءات المعروضة محل الإجراءين الافتراضيين. تتوقف المخرجات المدمجة، فاربط معالجاتك.',
    outputsHeading: 'مخرجات لا توجيه',
    outputsDescription:
      'المكوّن لا يوجّه أبدًا. يُصدر goBack و goHome ويترك لك الوجهة — اضغط زرًا لترى الحدث هنا.',
    lastEvent: 'آخر حدث',
    noEvent: 'لا شيء بعد',
    movedTitle: 'انتقلت هذه الصفحة',
    movedDescription: 'أعدنا تنظيم التوثيق. جرّب العنوان الجديد.',
    tryAgain: 'حاول مجددًا',
    statusPage: 'اطّلع على صفحة الحالة',
  },
  de: {
    code: 'de',
    heading: 'Fehlerseite',
    description:
      'Ein ganzseitiger 404-/403-/500-Zustand mit Illustrationsslot, Meldung und Wiederherstellungsaktionen.',
    codesHeading: 'Bekannte Codes',
    codesDescription:
      'Jeder mitgelieferte Code hat Standardtexte in error-page.locales.ts, sodass eine 404-Route vom ersten Tag an stimmt.',
    fallbackHeading: 'Unbekannte Codes',
    fallbackDescription:
      'Codes ohne eigenen Text fallen auf eine allgemeine Meldung zurück statt leer zu bleiben.',
    copyHeading: 'Eigene Texte',
    copyDescription:
      'Titel und Beschreibung überschreiben den Code-Standard jeweils unabhängig.',
    illustrationHeading: 'Eigene Illustration',
    illustrationDescription:
      'Eine projizierte Illustration ersetzt den typografischen Code, statt ihn zu ergänzen.',
    actionsHeading: 'Eigene Aktionen',
    actionsDescription:
      'Projizierte Aktionen ersetzen beide Standards. Die eingebauten Outputs feuern dann nicht mehr.',
    outputsHeading: 'Outputs statt Routing',
    outputsDescription:
      'Die Komponente routet nie. Sie sendet goBack und goHome und überlässt das Ziel Ihnen.',
    lastEvent: 'Letztes Ereignis',
    noEvent: 'noch nichts',
    movedTitle: 'Diese Seite ist umgezogen',
    movedDescription: 'Wir haben die Doku umstrukturiert. Bitte neue Adresse verwenden.',
    tryAgain: 'Erneut versuchen',
    statusPage: 'Statusseite ansehen',
  },
  fr: {
    code: 'fr',
    heading: 'Page d’erreur',
    description:
      'Un état 404 / 403 / 500 pleine page avec emplacement d’illustration, message et actions de récupération.',
    codesHeading: 'Codes connus',
    codesDescription:
      'Chaque code fourni a un texte par défaut dans error-page.locales.ts : une route 404 est correcte dès le premier jour.',
    fallbackHeading: 'Codes inconnus',
    fallbackDescription:
      'Un code sans texte dédié retombe sur un message générique plutôt que de rester vide.',
    copyHeading: 'Texte personnalisé',
    copyDescription:
      'Le titre et la description remplacent chacun indépendamment la valeur par défaut.',
    illustrationHeading: 'Illustration personnalisée',
    illustrationDescription:
      'Une illustration projetée remplace le code typographique au lieu de s’y ajouter.',
    actionsHeading: 'Actions personnalisées',
    actionsDescription:
      'Les actions projetées remplacent les deux valeurs par défaut. Les sorties intégrées cessent alors d’émettre.',
    outputsHeading: 'Des sorties, pas du routage',
    outputsDescription:
      'Le composant ne route jamais. Il émet goBack et goHome et vous laisse la destination.',
    lastEvent: 'Dernier événement',
    noEvent: 'rien pour l’instant',
    movedTitle: 'Cette page a été déplacée',
    movedDescription: 'Nous avons réorganisé la doc. Essayez la nouvelle adresse.',
    tryAgain: 'Réessayer',
    statusPage: 'Voir la page d’état',
  },
  es: {
    code: 'es',
    heading: 'Página de error',
    description:
      'Un estado 404 / 403 / 500 a página completa con espacio para ilustración, mensaje y acciones de recuperación.',
    codesHeading: 'Códigos conocidos',
    codesDescription:
      'Cada código incluido trae texto por defecto en error-page.locales.ts, así una ruta 404 se ve bien desde el primer día.',
    fallbackHeading: 'Códigos desconocidos',
    fallbackDescription:
      'Cualquier código sin texto propio recurre a un mensaje genérico en vez de quedar en blanco.',
    copyHeading: 'Texto propio',
    copyDescription:
      'El título y la descripción sustituyen el valor por defecto de forma independiente.',
    illustrationHeading: 'Ilustración propia',
    illustrationDescription:
      'Una ilustración proyectada sustituye al código tipográfico en lugar de sumarse a él.',
    actionsHeading: 'Acciones propias',
    actionsDescription:
      'Las acciones proyectadas sustituyen ambas por defecto. Las salidas integradas dejan de emitir.',
    outputsHeading: 'Salidas, no enrutado',
    outputsDescription:
      'El componente nunca enruta. Emite goBack y goHome y te deja el destino a ti.',
    lastEvent: 'Último evento',
    noEvent: 'nada todavía',
    movedTitle: 'Esta página se movió',
    movedDescription: 'Reorganizamos la documentación. Prueba la nueva dirección.',
    tryAgain: 'Reintentar',
    statusPage: 'Ver página de estado',
  },
  ja: {
    code: 'ja',
    heading: 'エラーページ',
    description:
      'イラスト枠、メッセージ、復帰アクションを備えた全画面の 404 / 403 / 500 状態。',
    codesHeading: '既知のコード',
    codesDescription:
      '同梱の各コードには error-page.locales.ts に既定文があるので、404 ルートは初日から正しく見えます。',
    fallbackHeading: '未知のコード',
    fallbackDescription: '専用の文がないコードは空白ではなく汎用メッセージにフォールバックします。',
    copyHeading: 'カスタム文言',
    copyDescription: 'タイトルと説明はそれぞれ独立にコードの既定値を上書きします。',
    illustrationHeading: 'カスタムイラスト',
    illustrationDescription:
      '投影したイラストは、タイポグラフィのコードに足されるのではなく置き換えます。',
    actionsHeading: 'カスタムアクション',
    actionsDescription:
      '投影したアクションは既定の 2 つを置き換えます。組み込みの出力は発火しなくなります。',
    outputsHeading: 'ルーティングではなく出力',
    outputsDescription:
      'このコンポーネントはルーティングしません。goBack と goHome を出力し、遷移先はあなたに委ねます。',
    lastEvent: '最後のイベント',
    noEvent: 'まだありません',
    movedTitle: 'このページは移動しました',
    movedDescription: 'ドキュメントを再編しました。新しいアドレスをお試しください。',
    tryAgain: '再試行',
    statusPage: 'ステータスページを見る',
  },
  zh: {
    code: 'zh',
    heading: '错误页',
    description: '带插图位、消息与恢复操作的整页 404 / 403 / 500 状态。',
    codesHeading: '已知状态码',
    codesDescription:
      '每个内置状态码在 error-page.locales.ts 中都有默认文案，404 路由第一天就是对的。',
    fallbackHeading: '未知状态码',
    fallbackDescription: '没有专属文案的状态码会回退到通用消息，而不是留空。',
    copyHeading: '自定义文案',
    copyDescription: '标题与描述各自独立地覆盖状态码的默认值。',
    illustrationHeading: '自定义插图',
    illustrationDescription: '投影的插图会替换排版状态码，而不是与之并列。',
    actionsHeading: '自定义操作',
    actionsDescription: '投影的操作会替换两个默认按钮，内置输出随之不再触发。',
    outputsHeading: '输出，而非路由',
    outputsDescription:
      '组件从不路由。它发出 goBack 与 goHome，目的地完全交给你决定。',
    lastEvent: '最近事件',
    noEvent: '暂无',
    movedTitle: '此页面已迁移',
    movedDescription: '我们重新整理了文档，请尝试新地址。',
    tryAgain: '重试',
    statusPage: '查看状态页',
  },
  ru: {
    code: 'ru',
    heading: 'Страница ошибки',
    description:
      'Полноэкранное состояние 404 / 403 / 500 с местом под иллюстрацию, сообщением и действиями восстановления.',
    codesHeading: 'Известные коды',
    codesDescription:
      'У каждого поставляемого кода есть текст по умолчанию в error-page.locales.ts, поэтому маршрут 404 выглядит правильно сразу.',
    fallbackHeading: 'Неизвестные коды',
    fallbackDescription:
      'Код без собственного текста откатывается к общему сообщению, а не остаётся пустым.',
    copyHeading: 'Свой текст',
    copyDescription: 'Заголовок и описание независимо переопределяют значения по умолчанию.',
    illustrationHeading: 'Своя иллюстрация',
    illustrationDescription:
      'Спроецированная иллюстрация заменяет типографский код, а не дополняет его.',
    actionsHeading: 'Свои действия',
    actionsDescription:
      'Спроецированные действия заменяют оба значения по умолчанию, и встроенные выходы перестают срабатывать.',
    outputsHeading: 'Выходы, а не маршрутизация',
    outputsDescription:
      'Компонент никогда не маршрутизирует. Он отдаёт goBack и goHome, а пункт назначения выбираете вы.',
    lastEvent: 'Последнее событие',
    noEvent: 'пока ничего',
    movedTitle: 'Страница переехала',
    movedDescription: 'Мы перестроили документацию. Попробуйте новый адрес.',
    tryAgain: 'Повторить',
    statusPage: 'Открыть страницу статуса',
  },
  pt: {
    code: 'pt',
    heading: 'Página de erro',
    description:
      'Um estado 404 / 403 / 500 em página inteira com espaço para ilustração, mensagem e ações de recuperação.',
    codesHeading: 'Códigos conhecidos',
    codesDescription:
      'Cada código incluído tem texto padrão em error-page.locales.ts, então uma rota 404 já fica certa no primeiro dia.',
    fallbackHeading: 'Códigos desconhecidos',
    fallbackDescription:
      'Qualquer código sem texto próprio recorre a uma mensagem genérica em vez de ficar em branco.',
    copyHeading: 'Texto próprio',
    copyDescription:
      'Título e descrição substituem o padrão do código de forma independente.',
    illustrationHeading: 'Ilustração própria',
    illustrationDescription:
      'Uma ilustração projetada substitui o código tipográfico em vez de se somar a ele.',
    actionsHeading: 'Ações próprias',
    actionsDescription:
      'Ações projetadas substituem os dois padrões. As saídas embutidas deixam de disparar.',
    outputsHeading: 'Saídas, não roteamento',
    outputsDescription:
      'O componente nunca roteia. Ele emite goBack e goHome e deixa o destino inteiramente com você.',
    lastEvent: 'Último evento',
    noEvent: 'nada ainda',
    movedTitle: 'Esta página mudou',
    movedDescription: 'Reorganizamos a documentação. Tente o novo endereço.',
    tryAgain: 'Tentar de novo',
    statusPage: 'Ver página de status',
  },
};
