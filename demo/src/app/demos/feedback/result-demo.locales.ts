import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface ResultDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  statusesHeading: string;
  statusesDescription: string;
  actionsHeading: string;
  actionsDescription: string;
  detailHeading: string;
  detailDescription: string;
  a11yHeading: string;
  a11yDescription: string;
  successTitle: string;
  successDescription: string;
  errorTitle: string;
  errorDescription: string;
  warningTitle: string;
  warningDescription: string;
  infoTitle: string;
  infoDescription: string;
  orderTitle: string;
  orderDescription: string;
  trackOrder: string;
  viewInvoice: string;
  keepShopping: string;
  importFailedTitle: string;
  importFailedDescription: string;
  tryAgain: string;
  contactSupport: string;
  nothingTitle: string;
  nothingDescription: string;
}

export const RESULT_DEMO_LOCALES: Record<string, ResultDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Result',
    description:
      'A centred outcome panel for after an operation completes — a form submit, a checkout, a bulk action.',
    statusesHeading: 'Statuses',
    statusesDescription:
      'Four outcomes, each with its own glyph and colour. All four are announced politely: an assertive live region would cut a screen reader off mid-sentence, which a result is not worth.',
    actionsHeading: 'With actions',
    actionsDescription:
      'Anything you project lands in the actions row — centred, and wrapping rather than overflowing on a narrow screen.',
    detailHeading: 'With detail',
    detailDescription:
      'Project a result-detail for anything too bulky for the actions row. It is pulled out of the default slot and rendered above the buttons, start-aligned, because centred code is unreadable.',
    a11yHeading: 'Without actions',
    a11yDescription:
      'With nothing projected, the actions row collapses entirely and leaves no gap behind it.',
    successTitle: 'Payment received',
    successDescription: 'We emailed your receipt to ada@example.com.',
    errorTitle: 'Payment failed',
    errorDescription: 'Your card was declined. No money has left your account.',
    warningTitle: 'Partially imported',
    warningDescription: '18 of 20 rows were imported. Two had missing SKUs.',
    infoTitle: 'Request queued',
    infoDescription: "We'll email you as soon as it finishes.",
    orderTitle: 'Order placed',
    orderDescription: 'Your order will arrive on Thursday.',
    trackOrder: 'Track order',
    viewInvoice: 'View invoice',
    keepShopping: 'Keep shopping',
    importFailedTitle: 'Import failed',
    importFailedDescription: 'We could not parse the file you uploaded.',
    tryAgain: 'Try again',
    contactSupport: 'Contact support',
    nothingTitle: 'Nothing to do',
    nothingDescription: 'Every invoice in this period is already reconciled.',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'תוצאה',
    description:
      'פאנל תוצאה ממורכז שמוצג לאחר סיום פעולה — שליחת טופס, תשלום או פעולה קבוצתית.',
    statusesHeading: 'מצבים',
    statusesDescription:
      'ארבע תוצאות, לכל אחת סמל וצבע משלה. כולן מוכרזות בעדינות: אזור חי תקיף היה קוטע את קורא המסך באמצע משפט.',
    actionsHeading: 'עם פעולות',
    actionsDescription:
      'כל תוכן שתקרין מגיע לשורת הפעולות — ממורכז, ועובר שורה במקום לגלוש במסך צר.',
    detailHeading: 'עם פירוט',
    detailDescription:
      'הקרן result-detail לכל תוכן גדול מדי לשורת הפעולות. הוא נשלף מהחריץ הרגיל ומוצג מעל הכפתורים, מיושר לתחילת השורה.',
    a11yHeading: 'ללא פעולות',
    a11yDescription: 'ללא תוכן מוקרן, שורת הפעולות נעלמת לגמרי ולא משאירה רווח.',
    successTitle: 'התשלום התקבל',
    successDescription: 'שלחנו את הקבלה לכתובת ada@example.com.',
    errorTitle: 'התשלום נכשל',
    errorDescription: 'הכרטיס נדחה. לא חויבת בכלל.',
    warningTitle: 'יובא חלקית',
    warningDescription: '18 מתוך 20 שורות יובאו. בשתיים חסר מק"ט.',
    infoTitle: 'הבקשה בתור',
    infoDescription: 'נעדכן אותך במייל ברגע שזה יסתיים.',
    orderTitle: 'ההזמנה בוצעה',
    orderDescription: 'ההזמנה שלך תגיע ביום חמישי.',
    trackOrder: 'מעקב אחר הזמנה',
    viewInvoice: 'צפייה בחשבונית',
    keepShopping: 'המשך קנייה',
    importFailedTitle: 'הייבוא נכשל',
    importFailedDescription: 'לא הצלחנו לפענח את הקובץ שהעלית.',
    tryAgain: 'נסה שוב',
    contactSupport: 'פנייה לתמיכה',
    nothingTitle: 'אין מה לעשות',
    nothingDescription: 'כל החשבוניות בתקופה הזו כבר הותאמו.',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'النتيجة',
    description:
      'لوحة نتيجة متمركزة تظهر بعد اكتمال عملية — إرسال نموذج أو دفع أو إجراء جماعي.',
    statusesHeading: 'الحالات',
    statusesDescription:
      'أربع نتائج، لكل منها رمزها ولونها. جميعها تُعلَن بلطف: المنطقة الحية الحازمة تقاطع قارئ الشاشة في منتصف الجملة.',
    actionsHeading: 'مع الإجراءات',
    actionsDescription:
      'كل ما تعرضه يصل إلى صف الإجراءات — متمركزًا، وينتقل لسطر جديد بدل أن يفيض على الشاشات الضيقة.',
    detailHeading: 'مع التفاصيل',
    detailDescription:
      'اعرض result-detail لأي محتوى أكبر من صف الإجراءات. يُسحَب من الفتحة الافتراضية ويظهر فوق الأزرار بمحاذاة البداية.',
    a11yHeading: 'بدون إجراءات',
    a11yDescription: 'بدون محتوى معروض، ينطوي صف الإجراءات تمامًا ولا يترك فراغًا.',
    successTitle: 'تم استلام الدفعة',
    successDescription: 'أرسلنا الإيصال إلى ada@example.com.',
    errorTitle: 'فشل الدفع',
    errorDescription: 'رُفضت بطاقتك. لم يُخصم أي مبلغ.',
    warningTitle: 'استيراد جزئي',
    warningDescription: 'تم استيراد 18 من 20 صفًا. صفّان بلا رمز تخزين.',
    infoTitle: 'الطلب في الانتظار',
    infoDescription: 'سنراسلك فور الانتهاء.',
    orderTitle: 'تم تقديم الطلب',
    orderDescription: 'سيصل طلبك يوم الخميس.',
    trackOrder: 'تتبّع الطلب',
    viewInvoice: 'عرض الفاتورة',
    keepShopping: 'متابعة التسوّق',
    importFailedTitle: 'فشل الاستيراد',
    importFailedDescription: 'تعذّر تحليل الملف الذي رفعته.',
    tryAgain: 'حاول مجددًا',
    contactSupport: 'اتصل بالدعم',
    nothingTitle: 'لا شيء للقيام به',
    nothingDescription: 'كل فواتير هذه الفترة مطابَقة بالفعل.',
  },
  de: {
    code: 'de',
    heading: 'Ergebnis',
    description:
      'Ein zentriertes Ergebnispanel für den Moment nach einer Aktion — Formular, Bezahlung oder Massenvorgang.',
    statusesHeading: 'Status',
    statusesDescription:
      'Vier Ergebnisse, jedes mit eigenem Symbol und eigener Farbe. Alle werden höflich angekündigt: ein assertiver Live-Bereich unterbräche den Screenreader mitten im Satz.',
    actionsHeading: 'Mit Aktionen',
    actionsDescription:
      'Alles Projizierte landet in der Aktionszeile — zentriert und umbrechend statt überlaufend.',
    detailHeading: 'Mit Details',
    detailDescription:
      'Projizieren Sie ein result-detail für alles, was für die Aktionszeile zu sperrig ist. Es wird über den Schaltflächen linksbündig gerendert.',
    a11yHeading: 'Ohne Aktionen',
    a11yDescription:
      'Ohne projizierten Inhalt verschwindet die Aktionszeile vollständig und hinterlässt keine Lücke.',
    successTitle: 'Zahlung erhalten',
    successDescription: 'Wir haben die Quittung an ada@example.com geschickt.',
    errorTitle: 'Zahlung fehlgeschlagen',
    errorDescription: 'Ihre Karte wurde abgelehnt. Es wurde nichts abgebucht.',
    warningTitle: 'Teilweise importiert',
    warningDescription: '18 von 20 Zeilen importiert. Zwei ohne Artikelnummer.',
    infoTitle: 'Anfrage in Warteschlange',
    infoDescription: 'Wir melden uns per E-Mail, sobald sie fertig ist.',
    orderTitle: 'Bestellung aufgegeben',
    orderDescription: 'Ihre Bestellung kommt am Donnerstag an.',
    trackOrder: 'Bestellung verfolgen',
    viewInvoice: 'Rechnung ansehen',
    keepShopping: 'Weiter einkaufen',
    importFailedTitle: 'Import fehlgeschlagen',
    importFailedDescription: 'Die hochgeladene Datei konnte nicht gelesen werden.',
    tryAgain: 'Erneut versuchen',
    contactSupport: 'Support kontaktieren',
    nothingTitle: 'Nichts zu tun',
    nothingDescription: 'Alle Rechnungen dieses Zeitraums sind bereits abgeglichen.',
  },
  fr: {
    code: 'fr',
    heading: 'Résultat',
    description:
      'Un panneau de résultat centré affiché après une opération — envoi de formulaire, paiement, action groupée.',
    statusesHeading: 'Statuts',
    statusesDescription:
      'Quatre issues, chacune avec son icône et sa couleur. Toutes sont annoncées poliment : une région assertive couperait le lecteur d’écran en pleine phrase.',
    actionsHeading: 'Avec actions',
    actionsDescription:
      'Tout contenu projeté arrive dans la rangée d’actions — centré, et passant à la ligne plutôt que de déborder.',
    detailHeading: 'Avec détail',
    detailDescription:
      'Projetez un result-detail pour tout ce qui est trop volumineux pour la rangée d’actions. Il s’affiche au-dessus des boutons, aligné au début.',
    a11yHeading: 'Sans actions',
    a11yDescription:
      'Sans contenu projeté, la rangée d’actions disparaît entièrement et ne laisse aucun espace.',
    successTitle: 'Paiement reçu',
    successDescription: 'Nous avons envoyé le reçu à ada@example.com.',
    errorTitle: 'Paiement refusé',
    errorDescription: 'Votre carte a été refusée. Rien n’a été débité.',
    warningTitle: 'Importation partielle',
    warningDescription: '18 lignes sur 20 importées. Deux sans référence.',
    infoTitle: 'Demande en file d’attente',
    infoDescription: 'Nous vous écrirons dès que ce sera terminé.',
    orderTitle: 'Commande passée',
    orderDescription: 'Votre commande arrivera jeudi.',
    trackOrder: 'Suivre la commande',
    viewInvoice: 'Voir la facture',
    keepShopping: 'Continuer les achats',
    importFailedTitle: 'Échec de l’importation',
    importFailedDescription: 'Impossible d’analyser le fichier envoyé.',
    tryAgain: 'Réessayer',
    contactSupport: 'Contacter le support',
    nothingTitle: 'Rien à faire',
    nothingDescription: 'Toutes les factures de cette période sont déjà rapprochées.',
  },
  es: {
    code: 'es',
    heading: 'Resultado',
    description:
      'Un panel de resultado centrado para después de completar una operación: un envío de formulario, un pago, una acción masiva.',
    statusesHeading: 'Estados',
    statusesDescription:
      'Cuatro resultados, cada uno con su icono y su color. Todos se anuncian con cortesía: una región asertiva cortaría al lector de pantalla a mitad de frase.',
    actionsHeading: 'Con acciones',
    actionsDescription:
      'Todo lo que proyectes llega a la fila de acciones: centrado y ajustándose en vez de desbordarse.',
    detailHeading: 'Con detalle',
    detailDescription:
      'Proyecta un result-detail para lo que no quepa en la fila de acciones. Se muestra sobre los botones, alineado al inicio.',
    a11yHeading: 'Sin acciones',
    a11yDescription:
      'Sin contenido proyectado, la fila de acciones se colapsa por completo y no deja hueco.',
    successTitle: 'Pago recibido',
    successDescription: 'Enviamos tu recibo a ada@example.com.',
    errorTitle: 'Pago rechazado',
    errorDescription: 'Tu tarjeta fue rechazada. No se ha cobrado nada.',
    warningTitle: 'Importación parcial',
    warningDescription: 'Se importaron 18 de 20 filas. Dos sin SKU.',
    infoTitle: 'Solicitud en cola',
    infoDescription: 'Te avisaremos por correo en cuanto termine.',
    orderTitle: 'Pedido realizado',
    orderDescription: 'Tu pedido llegará el jueves.',
    trackOrder: 'Seguir pedido',
    viewInvoice: 'Ver factura',
    keepShopping: 'Seguir comprando',
    importFailedTitle: 'Error de importación',
    importFailedDescription: 'No pudimos analizar el archivo que subiste.',
    tryAgain: 'Reintentar',
    contactSupport: 'Contactar con soporte',
    nothingTitle: 'Nada que hacer',
    nothingDescription: 'Todas las facturas de este periodo ya están conciliadas.',
  },
  ja: {
    code: 'ja',
    heading: '結果',
    description:
      '操作の完了後に表示する中央寄せの結果パネル — フォーム送信、決済、一括処理など。',
    statusesHeading: 'ステータス',
    statusesDescription:
      '4 つの結果それぞれに専用のアイコンと色があります。いずれも穏やかに通知します。強い読み上げはスクリーンリーダーを文の途中で遮ってしまいます。',
    actionsHeading: 'アクション付き',
    actionsDescription:
      '投影した内容はアクション行に入ります。中央寄せで、狭い画面でもあふれずに折り返します。',
    detailHeading: '詳細付き',
    detailDescription:
      'アクション行に収まらない内容は result-detail に投影します。ボタンの上に、行頭寄せで表示されます。',
    a11yHeading: 'アクションなし',
    a11yDescription: '何も投影しなければ、アクション行は完全に消えて余白も残しません。',
    successTitle: '支払いを受け付けました',
    successDescription: '領収書を ada@example.com に送信しました。',
    errorTitle: '支払いに失敗しました',
    errorDescription: 'カードが拒否されました。請求は発生していません。',
    warningTitle: '一部のみ取り込みました',
    warningDescription: '20 行中 18 行を取り込みました。2 行は SKU 欠落です。',
    infoTitle: 'リクエストは順番待ちです',
    infoDescription: '完了しだいメールでお知らせします。',
    orderTitle: '注文を受け付けました',
    orderDescription: 'ご注文は木曜日に到着します。',
    trackOrder: '注文を追跡',
    viewInvoice: '請求書を表示',
    keepShopping: '買い物を続ける',
    importFailedTitle: '取り込みに失敗しました',
    importFailedDescription: 'アップロードされたファイルを解析できませんでした。',
    tryAgain: '再試行',
    contactSupport: 'サポートに問い合わせる',
    nothingTitle: '対応は不要です',
    nothingDescription: 'この期間の請求書はすべて消込済みです。',
  },
  zh: {
    code: 'zh',
    heading: '结果',
    description: '操作完成后显示的居中结果面板——表单提交、支付或批量操作。',
    statusesHeading: '状态',
    statusesDescription:
      '四种结果各有自己的图标与颜色。全部以温和方式播报：强制播报会打断读屏软件的当前句子。',
    actionsHeading: '带操作按钮',
    actionsDescription: '投影的内容会进入操作行——居中显示，窄屏时换行而不是溢出。',
    detailHeading: '带详情',
    detailDescription:
      '操作行放不下的内容请投影到 result-detail。它会渲染在按钮上方，并按行首对齐。',
    a11yHeading: '不带操作按钮',
    a11yDescription: '没有投影内容时，操作行会整体折叠，不留空隙。',
    successTitle: '已收到付款',
    successDescription: '收据已发送至 ada@example.com。',
    errorTitle: '支付失败',
    errorDescription: '您的银行卡被拒绝，未产生任何扣款。',
    warningTitle: '部分导入',
    warningDescription: '20 行中导入了 18 行，2 行缺少 SKU。',
    infoTitle: '请求已排队',
    infoDescription: '完成后我们会发邮件通知您。',
    orderTitle: '下单成功',
    orderDescription: '您的订单将于周四送达。',
    trackOrder: '跟踪订单',
    viewInvoice: '查看发票',
    keepShopping: '继续购物',
    importFailedTitle: '导入失败',
    importFailedDescription: '无法解析您上传的文件。',
    tryAgain: '重试',
    contactSupport: '联系客服',
    nothingTitle: '无需处理',
    nothingDescription: '本期所有发票均已对账。',
  },
  ru: {
    code: 'ru',
    heading: 'Результат',
    description:
      'Центрированная панель результата после завершения операции — отправки формы, оплаты, массового действия.',
    statusesHeading: 'Статусы',
    statusesDescription:
      'Четыре исхода, у каждого свой значок и цвет. Все объявляются вежливо: настойчивая живая область прервала бы скринридер на полуслове.',
    actionsHeading: 'С действиями',
    actionsDescription:
      'Всё спроецированное попадает в строку действий — по центру и с переносом вместо переполнения.',
    detailHeading: 'С подробностями',
    detailDescription:
      'Спроецируйте result-detail для всего, что не помещается в строку действий. Он выводится над кнопками с выравниванием по началу строки.',
    a11yHeading: 'Без действий',
    a11yDescription:
      'Без спроецированного содержимого строка действий полностью схлопывается и не оставляет пустоты.',
    successTitle: 'Платёж получен',
    successDescription: 'Мы отправили чек на ada@example.com.',
    errorTitle: 'Платёж не прошёл',
    errorDescription: 'Карта отклонена. Деньги не списаны.',
    warningTitle: 'Импортировано частично',
    warningDescription: 'Импортировано 18 из 20 строк. В двух нет артикула.',
    infoTitle: 'Запрос в очереди',
    infoDescription: 'Напишем на почту, как только всё закончится.',
    orderTitle: 'Заказ оформлен',
    orderDescription: 'Заказ прибудет в четверг.',
    trackOrder: 'Отследить заказ',
    viewInvoice: 'Посмотреть счёт',
    keepShopping: 'Продолжить покупки',
    importFailedTitle: 'Импорт не удался',
    importFailedDescription: 'Не удалось разобрать загруженный файл.',
    tryAgain: 'Повторить',
    contactSupport: 'Связаться с поддержкой',
    nothingTitle: 'Делать нечего',
    nothingDescription: 'Все счета за этот период уже сверены.',
  },
  pt: {
    code: 'pt',
    heading: 'Resultado',
    description:
      'Um painel de resultado centralizado para depois de concluir uma operação — envio de formulário, pagamento, ação em massa.',
    statusesHeading: 'Estados',
    statusesDescription:
      'Quatro desfechos, cada um com seu ícone e sua cor. Todos são anunciados com delicadeza: uma região assertiva cortaria o leitor de tela no meio da frase.',
    actionsHeading: 'Com ações',
    actionsDescription:
      'Tudo o que você projetar vai para a linha de ações — centralizado e quebrando linha em vez de transbordar.',
    detailHeading: 'Com detalhe',
    detailDescription:
      'Projete um result-detail para o que não couber na linha de ações. Ele aparece acima dos botões, alinhado ao início.',
    a11yHeading: 'Sem ações',
    a11yDescription:
      'Sem conteúdo projetado, a linha de ações some por completo e não deixa espaço.',
    successTitle: 'Pagamento recebido',
    successDescription: 'Enviamos seu recibo para ada@example.com.',
    errorTitle: 'Pagamento recusado',
    errorDescription: 'Seu cartão foi recusado. Nada foi cobrado.',
    warningTitle: 'Importação parcial',
    warningDescription: '18 de 20 linhas importadas. Duas sem SKU.',
    infoTitle: 'Solicitação na fila',
    infoDescription: 'Avisaremos por e-mail assim que terminar.',
    orderTitle: 'Pedido realizado',
    orderDescription: 'Seu pedido chega na quinta-feira.',
    trackOrder: 'Acompanhar pedido',
    viewInvoice: 'Ver fatura',
    keepShopping: 'Continuar comprando',
    importFailedTitle: 'Falha na importação',
    importFailedDescription: 'Não foi possível interpretar o arquivo enviado.',
    tryAgain: 'Tentar de novo',
    contactSupport: 'Falar com o suporte',
    nothingTitle: 'Nada a fazer',
    nothingDescription: 'Todas as faturas deste período já estão conciliadas.',
  },
};
