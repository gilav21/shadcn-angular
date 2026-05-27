import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface NavigationMenuDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  gettingStarted: string;
  introTitle: string;
  introDesc: string;
  installTitle: string;
  installDesc: string;
  typographyTitle: string;
  typographyDesc: string;
  components: string;
  alertDialogTitle: string;
  alertDialogDesc: string;
  hoverCardTitle: string;
  hoverCardDesc: string;
  progressTitle: string;
  progressDesc: string;
  tooltipTitle: string;
  tooltipDesc: string;
  documentation: string;
}

export const NAVIGATION_MENU_DEMO_LOCALES: Record<string, NavigationMenuDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Navigation Menu', description: 'A navigation menu for site-wide navigation.',
    gettingStarted: 'Getting Started',
    introTitle: 'Introduction', introDesc: 'Re-usable components built with Angular and Tailwind CSS.',
    installTitle: 'Installation', installDesc: 'How to install and set up the library.',
    typographyTitle: 'Typography', typographyDesc: 'Styles for headings, paragraphs, lists, etc.',
    components: 'Components',
    alertDialogTitle: 'Alert Dialog', alertDialogDesc: 'A modal dialog that interrupts the user.',
    hoverCardTitle: 'Hover Card', hoverCardDesc: 'For sighted users to preview content.',
    progressTitle: 'Progress', progressDesc: 'Displays completion progress of a task.',
    tooltipTitle: 'Tooltip', tooltipDesc: 'A popup that displays information.',
    documentation: 'Documentation',
  },
  he: {
    code: 'he', rtl: true,
    heading: 'תפריט ניווט', description: 'תפריט ניווט לאתר שלם.',
    gettingStarted: 'תחילת עבודה',
    introTitle: 'מבוא', introDesc: 'רכיבים לשימוש חוזר הבנויים עם Angular ו-Tailwind CSS.',
    installTitle: 'התקנה', installDesc: 'כיצד להתקין ולהגדיר את הספרייה.',
    typographyTitle: 'טיפוגרפיה', typographyDesc: 'סגנונות לכותרות, פסקאות, רשימות וכדומה.',
    components: 'רכיבים',
    alertDialogTitle: 'תיבת אזהרה', alertDialogDesc: 'תיבת דו-שיח מודאלית שמפריעה למשתמש.',
    hoverCardTitle: 'כרטיס ריחוף', hoverCardDesc: 'לצפייה מקדימה של תוכן למשתמשים רואים.',
    progressTitle: 'התקדמות', progressDesc: 'מציג את התקדמות ביצוע משימה.',
    tooltipTitle: 'עצת כלי', tooltipDesc: 'חלון קופץ המציג מידע.',
    documentation: 'תיעוד',
  },
  ar: {
    code: 'ar', rtl: true,
    heading: 'قائمة التنقل', description: 'قائمة تنقل لملاحة الموقع بأكمله.',
    gettingStarted: 'البدء',
    introTitle: 'مقدمة', introDesc: 'مكونات قابلة لإعادة الاستخدام مبنية بـ Angular وTailwind CSS.',
    installTitle: 'التثبيت', installDesc: 'كيفية تثبيت المكتبة وإعدادها.',
    typographyTitle: 'الطباعة', typographyDesc: 'أنماط للعناوين والفقرات والقوائم وما إلى ذلك.',
    components: 'المكونات',
    alertDialogTitle: 'مربع حوار التنبيه', alertDialogDesc: 'مربع حوار مشروط يقاطع المستخدم.',
    hoverCardTitle: 'بطاقة التمرير', hoverCardDesc: 'لمعاينة المحتوى للمستخدمين المبصرين.',
    progressTitle: 'التقدم', progressDesc: 'يعرض تقدم إكمال المهمة.',
    tooltipTitle: 'تلميح الأداة', tooltipDesc: 'نافذة منبثقة تعرض المعلومات.',
    documentation: 'التوثيق',
  },
  de: {
    code: 'de',
    heading: 'Navigationsmenü', description: 'Ein Navigationsmenü für die gesamte Website.',
    gettingStarted: 'Erste Schritte',
    introTitle: 'Einführung', introDesc: 'Wiederverwendbare Komponenten mit Angular und Tailwind CSS.',
    installTitle: 'Installation', installDesc: 'Wie die Bibliothek installiert und eingerichtet wird.',
    typographyTitle: 'Typografie', typographyDesc: 'Stile für Überschriften, Absätze, Listen usw.',
    components: 'Komponenten',
    alertDialogTitle: 'Warnungsdialog', alertDialogDesc: 'Ein modaler Dialog, der den Benutzer unterbricht.',
    hoverCardTitle: 'Hover-Karte', hoverCardDesc: 'Zur Inhaltsvorschau für sehende Benutzer.',
    progressTitle: 'Fortschritt', progressDesc: 'Zeigt den Abschlussfortschritt einer Aufgabe.',
    tooltipTitle: 'Tooltip', tooltipDesc: 'Ein Popup, das Informationen anzeigt.',
    documentation: 'Dokumentation',
  },
  fr: {
    code: 'fr',
    heading: 'Menu de navigation', description: 'Un menu de navigation pour tout le site.',
    gettingStarted: 'Démarrage',
    introTitle: 'Introduction', introDesc: 'Composants réutilisables construits avec Angular et Tailwind CSS.',
    installTitle: 'Installation', installDesc: 'Comment installer et configurer la bibliothèque.',
    typographyTitle: 'Typographie', typographyDesc: 'Styles pour les titres, paragraphes, listes, etc.',
    components: 'Composants',
    alertDialogTitle: 'Boîte de dialogue d\'alerte', alertDialogDesc: 'Une boîte de dialogue modale qui interrompt l\'utilisateur.',
    hoverCardTitle: 'Carte au survol', hoverCardDesc: 'Pour prévisualiser le contenu.',
    progressTitle: 'Progression', progressDesc: 'Affiche la progression d\'une tâche.',
    tooltipTitle: 'Infobulle', tooltipDesc: 'Une fenêtre contextuelle qui affiche des informations.',
    documentation: 'Documentation',
  },
  es: {
    code: 'es',
    heading: 'Menú de navegación', description: 'Un menú de navegación para todo el sitio.',
    gettingStarted: 'Primeros pasos',
    introTitle: 'Introducción', introDesc: 'Componentes reutilizables construidos con Angular y Tailwind CSS.',
    installTitle: 'Instalación', installDesc: 'Cómo instalar y configurar la biblioteca.',
    typographyTitle: 'Tipografía', typographyDesc: 'Estilos para encabezados, párrafos, listas, etc.',
    components: 'Componentes',
    alertDialogTitle: 'Cuadro de diálogo de alerta', alertDialogDesc: 'Un cuadro de diálogo modal que interrumpe al usuario.',
    hoverCardTitle: 'Tarjeta emergente', hoverCardDesc: 'Para previsualizar contenido.',
    progressTitle: 'Progreso', progressDesc: 'Muestra el progreso de finalización de una tarea.',
    tooltipTitle: 'Información emergente', tooltipDesc: 'Una ventana emergente que muestra información.',
    documentation: 'Documentación',
  },
  ja: {
    code: 'ja',
    heading: 'ナビゲーションメニュー', description: 'サイト全体のナビゲーションメニュー。',
    gettingStarted: 'はじめに',
    introTitle: 'はじめに', introDesc: 'AngularとTailwind CSSで構築した再利用可能なコンポーネント。',
    installTitle: 'インストール', installDesc: 'ライブラリのインストールとセットアップ方法。',
    typographyTitle: 'タイポグラフィ', typographyDesc: '見出し、段落、リストなどのスタイル。',
    components: 'コンポーネント',
    alertDialogTitle: 'アラートダイアログ', alertDialogDesc: 'ユーザーを中断するモーダルダイアログ。',
    hoverCardTitle: 'ホバーカード', hoverCardDesc: '視覚ユーザー向けコンテンツのプレビュー。',
    progressTitle: 'プログレス', progressDesc: 'タスクの完了進捗を表示。',
    tooltipTitle: 'ツールチップ', tooltipDesc: '情報を表示するポップアップ。',
    documentation: 'ドキュメント',
  },
  zh: {
    code: 'zh',
    heading: '导航菜单', description: '用于全站导航的导航菜单。',
    gettingStarted: '入门',
    introTitle: '介绍', introDesc: '使用 Angular 和 Tailwind CSS 构建的可复用组件。',
    installTitle: '安装', installDesc: '如何安装和设置库。',
    typographyTitle: '排版', typographyDesc: '标题、段落、列表等的样式。',
    components: '组件',
    alertDialogTitle: '警告对话框', alertDialogDesc: '中断用户操作的模态对话框。',
    hoverCardTitle: '悬停卡片', hoverCardDesc: '供视力正常用户预览内容。',
    progressTitle: '进度', progressDesc: '显示任务的完成进度。',
    tooltipTitle: '工具提示', tooltipDesc: '显示信息的弹出窗口。',
    documentation: '文档',
  },
  ru: {
    code: 'ru',
    heading: 'Меню навигации', description: 'Меню навигации для всего сайта.',
    gettingStarted: 'Начало работы',
    introTitle: 'Введение', introDesc: 'Переиспользуемые компоненты, созданные с Angular и Tailwind CSS.',
    installTitle: 'Установка', installDesc: 'Как установить и настроить библиотеку.',
    typographyTitle: 'Типографика', typographyDesc: 'Стили для заголовков, абзацев, списков и т.д.',
    components: 'Компоненты',
    alertDialogTitle: 'Диалог предупреждения', alertDialogDesc: 'Модальный диалог, прерывающий пользователя.',
    hoverCardTitle: 'Карточка наведения', hoverCardDesc: 'Для предварительного просмотра контента.',
    progressTitle: 'Прогресс', progressDesc: 'Отображает прогресс выполнения задачи.',
    tooltipTitle: 'Подсказка', tooltipDesc: 'Всплывающее окно с информацией.',
    documentation: 'Документация',
  },
  pt: {
    code: 'pt',
    heading: 'Menu de navegação', description: 'Um menu de navegação para todo o site.',
    gettingStarted: 'Primeiros passos',
    introTitle: 'Introdução', introDesc: 'Componentes reutilizáveis construídos com Angular e Tailwind CSS.',
    installTitle: 'Instalação', installDesc: 'Como instalar e configurar a biblioteca.',
    typographyTitle: 'Tipografia', typographyDesc: 'Estilos para títulos, parágrafos, listas, etc.',
    components: 'Componentes',
    alertDialogTitle: 'Diálogo de alerta', alertDialogDesc: 'Um diálogo modal que interrompe o usuário.',
    hoverCardTitle: 'Cartão flutuante', hoverCardDesc: 'Para visualizar conteúdo.',
    progressTitle: 'Progresso', progressDesc: 'Exibe o progresso de conclusão de uma tarefa.',
    tooltipTitle: 'Dica de ferramenta', tooltipDesc: 'Um pop-up que exibe informações.',
    documentation: 'Documentação',
  },
};
