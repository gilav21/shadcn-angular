import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface SidebarDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  appName: string;
  navGroup: string;
  navHome: string;
  navInbox: string;
  navCalendar: string;
  navSettings: string;
  version: string;
  mainContent: string;
  mainContentHeader: string;
}

export const SIDEBAR_DEMO_LOCALES: Record<string, SidebarDemoLocale> = {
  en: { code: 'en', heading: 'Sidebar', description: 'A composable sidebar component for application layouts.', appName: 'My App', navGroup: 'Navigation', navHome: 'Home', navInbox: 'Inbox', navCalendar: 'Calendar', navSettings: 'Settings', version: 'v1.0.0', mainContent: 'Main content area. Click the sidebar trigger to toggle.', mainContentHeader: 'Dashboard' },
  he: { code: 'he', rtl: true, heading: 'סרגל צד', description: 'רכיב סרגל צד ניתן להרכבה לפריסות אפליקציה.', appName: 'האפליקציה שלי', navGroup: 'ניווט', navHome: 'בית', navInbox: 'דואר נכנס', navCalendar: 'לוח שנה', navSettings: 'הגדרות', version: 'v1.0.0', mainContent: 'אזור תוכן ראשי. לחץ על הכפתור להחלפת מצב סרגל הצד.', mainContentHeader: 'לוח בקרה' },
  ar: { code: 'ar', rtl: true, heading: 'الشريط الجانبي', description: 'مكوّن شريط جانبي قابل للتركيب لتخطيطات التطبيقات.', appName: 'تطبيقي', navGroup: 'التنقل', navHome: 'الرئيسية', navInbox: 'صندوق الوارد', navCalendar: 'التقويم', navSettings: 'الإعدادات', version: 'v1.0.0', mainContent: 'منطقة المحتوى الرئيسية. انقر على زر الشريط الجانبي للتبديل.', mainContentHeader: 'لوحة التحكم' },
  de: { code: 'de', heading: 'Seitenleiste', description: 'Eine kompositionsfähige Seitenleiste für Anwendungslayouts.', appName: 'Meine App', navGroup: 'Navigation', navHome: 'Startseite', navInbox: 'Posteingang', navCalendar: 'Kalender', navSettings: 'Einstellungen', version: 'v1.0.0', mainContent: 'Hauptinhaltsbereich. Klicken Sie auf den Seitenleisten-Trigger zum Umschalten.', mainContentHeader: 'Dashboard' },
  fr: { code: 'fr', heading: 'Barre latérale', description: 'Un composant de barre latérale composable pour les mises en page d\'application.', appName: 'Mon App', navGroup: 'Navigation', navHome: 'Accueil', navInbox: 'Boîte de réception', navCalendar: 'Calendrier', navSettings: 'Paramètres', version: 'v1.0.0', mainContent: 'Zone de contenu principal. Cliquez sur le déclencheur de la barre latérale pour basculer.', mainContentHeader: 'Tableau de bord' },
  es: { code: 'es', heading: 'Barra lateral', description: 'Un componente de barra lateral componible para diseños de aplicaciones.', appName: 'Mi App', navGroup: 'Navegación', navHome: 'Inicio', navInbox: 'Bandeja de entrada', navCalendar: 'Calendario', navSettings: 'Ajustes', version: 'v1.0.0', mainContent: 'Área de contenido principal. Haga clic en el activador de la barra lateral para alternar.', mainContentHeader: 'Panel' },
  ja: { code: 'ja', heading: 'サイドバー', description: 'アプリケーションレイアウト用の組み合わせ可能なサイドバーコンポーネント。', appName: 'マイアプリ', navGroup: 'ナビゲーション', navHome: 'ホーム', navInbox: '受信トレイ', navCalendar: 'カレンダー', navSettings: '設定', version: 'v1.0.0', mainContent: 'メインコンテンツエリア。サイドバートリガーをクリックして切り替えます。', mainContentHeader: 'ダッシュボード' },
  zh: { code: 'zh', heading: '侧边栏', description: '用于应用程序布局的可组合侧边栏组件。', appName: '我的应用', navGroup: '导航', navHome: '首页', navInbox: '收件箱', navCalendar: '日历', navSettings: '设置', version: 'v1.0.0', mainContent: '主要内容区域。点击侧边栏触发器进行切换。', mainContentHeader: '仪表板' },
  ru: { code: 'ru', heading: 'Боковая панель', description: 'Компонуемый компонент боковой панели для макетов приложений.', appName: 'Моё приложение', navGroup: 'Навигация', navHome: 'Главная', navInbox: 'Входящие', navCalendar: 'Календарь', navSettings: 'Настройки', version: 'v1.0.0', mainContent: 'Основная область контента. Нажмите на триггер боковой панели для переключения.', mainContentHeader: 'Панель управления' },
  pt: { code: 'pt', heading: 'Barra lateral', description: 'Um componente de barra lateral composável para layouts de aplicativos.', appName: 'Meu App', navGroup: 'Navegação', navHome: 'Início', navInbox: 'Caixa de entrada', navCalendar: 'Calendário', navSettings: 'Configurações', version: 'v1.0.0', mainContent: 'Área de conteúdo principal. Clique no gatilho da barra lateral para alternar.', mainContentHeader: 'Painel' },
};
