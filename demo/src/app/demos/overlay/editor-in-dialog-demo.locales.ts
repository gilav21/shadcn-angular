// demo/src/app/demos/overlay/editor-in-dialog-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface EditorInDialogDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  ourDialogHeading: string;
  ourDialogHint: string;
  nativeDialogHeading: string;
  nativeDialogHint: string;
  highZHeading: string;
  highZHint: string;
  openOurLabel: string;
  openNativeLabel: string;
  openHighZLabel: string;
  closeLabel: string;
  dialogTitle: string;
  editorPlaceholder: string;
}

export const EDITOR_IN_DIALOG_DEMO_LOCALES: Record<string, EditorInDialogDemoLocale> = {
  en: {
    code: 'en',
    title: 'Rich Text Editor in a Dialog',
    description:
      'Regression demo: a rich-text editor inside three kinds of modal. Open each, then click a toolbar popover (text color, link, table). The popover must render ABOVE the modal in every case.',
    ourDialogHeading: 'Our ui-dialog (inline overlay)',
    ourDialogHint: 'Our dialog renders in the normal layer; toolbar popovers were already above it.',
    nativeDialogHeading: 'Native <dialog> (showModal → top layer)',
    nativeDialogHint:
      'A native modal lives in the browser top layer. This used to push body-portaled toolbar popovers behind it — the case this fix targets.',
    highZHeading: 'Plain z-index:9999 modal',
    highZHint: 'A third-party-style modal in the normal layer with a very high z-index.',
    openOurLabel: 'Open ui-dialog',
    openNativeLabel: 'Open native <dialog>',
    openHighZLabel: 'Open z-index:9999 modal',
    closeLabel: 'Close',
    dialogTitle: 'Compose',
    editorPlaceholder: 'Type here, then open a toolbar popover…',
  },
  he: {
    code: 'he', rtl: true,
    title: 'עורך טקסט עשיר בתוך חלון דו-שיח',
    description:
      'הדגמת רגרסיה: עורך טקסט עשיר בתוך שלושה סוגי חלונות מודאליים. פתח כל אחד ולחץ על פופאובר בסרגל הכלים (צבע טקסט, קישור, טבלה). הפופאובר חייב להופיע מעל החלון בכל מקרה.',
    ourDialogHeading: 'ה-ui-dialog שלנו (שכבת-על מוטמעת)',
    ourDialogHint: 'החלון שלנו מוצג בשכבה הרגילה; הפופאוברים כבר הופיעו מעליו.',
    nativeDialogHeading: 'אלמנט <dialog> מובנה (showModal ← שכבה עליונה)',
    nativeDialogHint:
      'חלון מודאלי מובנה נמצא בשכבה העליונה של הדפדפן. בעבר זה דחף את הפופאוברים מאחוריו — זה המקרה שהתיקון מטפל בו.',
    highZHeading: 'חלון עם z-index:9999',
    highZHint: 'חלון בסגנון ספריית צד-שלישי בשכבה הרגילה עם z-index גבוה מאוד.',
    openOurLabel: 'פתח ui-dialog',
    openNativeLabel: 'פתח <dialog> מובנה',
    openHighZLabel: 'פתח חלון z-index:9999',
    closeLabel: 'סגור',
    dialogTitle: 'כתיבה',
    editorPlaceholder: 'הקלד כאן, ואז פתח פופאובר בסרגל הכלים…',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'محرر النصوص الغني داخل مربع حوار',
    description:
      'عرض الانحدار: محرر نصوص غني داخل ثلاثة أنواع من النوافذ المشروطة. افتح كل واحدة ثم انقر على منبثقة شريط الأدوات (لون النص، رابط، جدول). يجب أن تظهر المنبثقة فوق النافذة في كل الحالات.',
    ourDialogHeading: 'مربع الحوار ui-dialog الخاص بنا (تراكب مضمّن)',
    ourDialogHint: 'يظهر مربعنا في الطبقة العادية؛ كانت المنبثقات فوقه بالفعل.',
    nativeDialogHeading: 'عنصر <dialog> الأصلي (showModal ← الطبقة العليا)',
    nativeDialogHint:
      'توجد النافذة المشروطة الأصلية في الطبقة العليا للمتصفح. كان هذا يدفع المنبثقات خلفها — وهي الحالة التي يعالجها هذا الإصلاح.',
    highZHeading: 'نافذة بـ z-index:9999',
    highZHint: 'نافذة بنمط مكتبة خارجية في الطبقة العادية مع z-index مرتفع جدًا.',
    openOurLabel: 'افتح ui-dialog',
    openNativeLabel: 'افتح <dialog> الأصلي',
    openHighZLabel: 'افتح نافذة z-index:9999',
    closeLabel: 'إغلاق',
    dialogTitle: 'تحرير',
    editorPlaceholder: 'اكتب هنا ثم افتح منبثقة شريط الأدوات…',
  },
  de: {
    code: 'de',
    title: 'Rich-Text-Editor in einem Dialog',
    description:
      'Regressions-Demo: ein Rich-Text-Editor in drei Modal-Typen. Öffne jeden und klicke ein Toolbar-Popover (Textfarbe, Link, Tabelle). Das Popover muss in jedem Fall ÜBER dem Modal erscheinen.',
    ourDialogHeading: 'Unser ui-dialog (Inline-Overlay)',
    ourDialogHint: 'Unser Dialog liegt in der normalen Ebene; Popovers waren bereits darüber.',
    nativeDialogHeading: 'Natives <dialog> (showModal → Top-Layer)',
    nativeDialogHint:
      'Ein natives Modal liegt im Top-Layer des Browsers. Das schob body-portierte Popovers dahinter — der Fall, den dieser Fix behebt.',
    highZHeading: 'Modal mit z-index:9999',
    highZHint: 'Ein Modal im Drittanbieter-Stil in der normalen Ebene mit sehr hohem z-index.',
    openOurLabel: 'ui-dialog öffnen',
    openNativeLabel: 'Natives <dialog> öffnen',
    openHighZLabel: 'z-index:9999-Modal öffnen',
    closeLabel: 'Schließen',
    dialogTitle: 'Verfassen',
    editorPlaceholder: 'Hier tippen, dann ein Toolbar-Popover öffnen…',
  },
  fr: {
    code: 'fr',
    title: 'Éditeur de texte enrichi dans une boîte de dialogue',
    description:
      'Démo de régression : un éditeur de texte enrichi dans trois types de modale. Ouvrez chacune puis cliquez un popover de la barre d’outils (couleur, lien, tableau). Le popover doit s’afficher AU-DESSUS de la modale dans tous les cas.',
    ourDialogHeading: 'Notre ui-dialog (superposition en ligne)',
    ourDialogHint: 'Notre dialogue est dans la couche normale ; les popovers étaient déjà au-dessus.',
    nativeDialogHeading: '<dialog> natif (showModal → couche supérieure)',
    nativeDialogHint:
      'Une modale native vit dans la couche supérieure du navigateur. Cela plaçait les popovers derrière — le cas que ce correctif traite.',
    highZHeading: 'Modale z-index:9999',
    highZHint: 'Une modale de style tiers dans la couche normale avec un z-index très élevé.',
    openOurLabel: 'Ouvrir ui-dialog',
    openNativeLabel: 'Ouvrir <dialog> natif',
    openHighZLabel: 'Ouvrir la modale z-index:9999',
    closeLabel: 'Fermer',
    dialogTitle: 'Rédiger',
    editorPlaceholder: 'Tapez ici, puis ouvrez un popover de la barre d’outils…',
  },
  es: {
    code: 'es',
    title: 'Editor de texto enriquecido en un diálogo',
    description:
      'Demo de regresión: un editor de texto enriquecido dentro de tres tipos de modal. Abre cada uno y haz clic en un popover de la barra de herramientas (color, enlace, tabla). El popover debe mostrarse POR ENCIMA del modal en todos los casos.',
    ourDialogHeading: 'Nuestro ui-dialog (superposición en línea)',
    ourDialogHint: 'Nuestro diálogo está en la capa normal; los popovers ya quedaban encima.',
    nativeDialogHeading: '<dialog> nativo (showModal → capa superior)',
    nativeDialogHint:
      'Un modal nativo vive en la capa superior del navegador. Eso dejaba los popovers detrás — el caso que corrige esta solución.',
    highZHeading: 'Modal con z-index:9999',
    highZHint: 'Un modal estilo terceros en la capa normal con un z-index muy alto.',
    openOurLabel: 'Abrir ui-dialog',
    openNativeLabel: 'Abrir <dialog> nativo',
    openHighZLabel: 'Abrir modal z-index:9999',
    closeLabel: 'Cerrar',
    dialogTitle: 'Redactar',
    editorPlaceholder: 'Escribe aquí y abre un popover de la barra de herramientas…',
  },
  ja: {
    code: 'ja',
    title: 'ダイアログ内のリッチテキストエディター',
    description:
      'リグレッションデモ: 3種類のモーダル内のリッチテキストエディター。それぞれ開いてツールバーのポップオーバー（文字色・リンク・表）をクリックします。ポップオーバーは常にモーダルの前面に表示される必要があります。',
    ourDialogHeading: '当社の ui-dialog（インラインオーバーレイ）',
    ourDialogHint: '当社のダイアログは通常レイヤーにあり、ポップオーバーは既に前面でした。',
    nativeDialogHeading: 'ネイティブ <dialog>（showModal → トップレイヤー）',
    nativeDialogHint:
      'ネイティブモーダルはブラウザのトップレイヤーにあります。これが body にポータルされたポップオーバーを背面に押しやっていました。本修正の対象です。',
    highZHeading: 'z-index:9999 のモーダル',
    highZHint: '通常レイヤーにある、非常に高い z-index のサードパーティ風モーダル。',
    openOurLabel: 'ui-dialog を開く',
    openNativeLabel: 'ネイティブ <dialog> を開く',
    openHighZLabel: 'z-index:9999 モーダルを開く',
    closeLabel: '閉じる',
    dialogTitle: '作成',
    editorPlaceholder: 'ここに入力し、ツールバーのポップオーバーを開きます…',
  },
  zh: {
    code: 'zh',
    title: '对话框中的富文本编辑器',
    description:
      '回归演示：三种模态框中的富文本编辑器。逐个打开并点击工具栏弹出层（文字颜色、链接、表格）。弹出层在每种情况下都必须显示在模态框之上。',
    ourDialogHeading: '我们的 ui-dialog（内联遮罩）',
    ourDialogHint: '我们的对话框位于普通层；弹出层本就在其之上。',
    nativeDialogHeading: '原生 <dialog>（showModal → 顶层）',
    nativeDialogHint:
      '原生模态框位于浏览器顶层。这会把传送到 body 的弹出层压到其后——正是本次修复的场景。',
    highZHeading: 'z-index:9999 的模态框',
    highZHint: '普通层中、z-index 非常高的第三方风格模态框。',
    openOurLabel: '打开 ui-dialog',
    openNativeLabel: '打开原生 <dialog>',
    openHighZLabel: '打开 z-index:9999 模态框',
    closeLabel: '关闭',
    dialogTitle: '撰写',
    editorPlaceholder: '在此输入，然后打开工具栏弹出层…',
  },
  ru: {
    code: 'ru',
    title: 'Редактор форматированного текста в диалоге',
    description:
      'Демо регрессии: редактор внутри трёх видов модальных окон. Откройте каждое и нажмите всплывающий элемент панели (цвет, ссылка, таблица). Всплывающий элемент должен отображаться ПОВЕРХ модального окна во всех случаях.',
    ourDialogHeading: 'Наш ui-dialog (встроенное наложение)',
    ourDialogHint: 'Наш диалог в обычном слое; всплывающие элементы уже были поверх него.',
    nativeDialogHeading: 'Нативный <dialog> (showModal → верхний слой)',
    nativeDialogHint:
      'Нативное модальное окно живёт в верхнем слое браузера. Это уводило всплывающие элементы за него — случай, который исправляет это изменение.',
    highZHeading: 'Модальное окно z-index:9999',
    highZHint: 'Модальное окно в стиле сторонней библиотеки в обычном слое с очень высоким z-index.',
    openOurLabel: 'Открыть ui-dialog',
    openNativeLabel: 'Открыть нативный <dialog>',
    openHighZLabel: 'Открыть модальное окно z-index:9999',
    closeLabel: 'Закрыть',
    dialogTitle: 'Написать',
    editorPlaceholder: 'Введите текст, затем откройте всплывающий элемент панели…',
  },
  pt: {
    code: 'pt',
    title: 'Editor de Texto Rico em uma Caixa de Diálogo',
    description:
      'Demo de regressão: um editor de texto rico dentro de três tipos de modal. Abra cada um e clique em um popover da barra de ferramentas (cor, link, tabela). O popover deve aparecer ACIMA do modal em todos os casos.',
    ourDialogHeading: 'Nosso ui-dialog (sobreposição embutida)',
    ourDialogHint: 'Nosso diálogo fica na camada normal; os popovers já ficavam acima dele.',
    nativeDialogHeading: '<dialog> nativo (showModal → camada superior)',
    nativeDialogHint:
      'Um modal nativo vive na camada superior do navegador. Isso empurrava os popovers para trás — o caso que esta correção resolve.',
    highZHeading: 'Modal com z-index:9999',
    highZHint: 'Um modal estilo terceiros na camada normal com z-index muito alto.',
    openOurLabel: 'Abrir ui-dialog',
    openNativeLabel: 'Abrir <dialog> nativo',
    openHighZLabel: 'Abrir modal z-index:9999',
    closeLabel: 'Fechar',
    dialogTitle: 'Escrever',
    editorPlaceholder: 'Digite aqui e abra um popover da barra de ferramentas…',
  },
};
