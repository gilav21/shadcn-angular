import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface MenubarDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  menuFile: string;
  menuEdit: string;
  menuView: string;
  menuProfiles: string;
  fileNewTab: string;
  fileNewWindow: string;
  fileNewIncognito: string;
  fileShare: string;
  fileShareEmail: string;
  fileShareEmailPersonal: string;
  fileShareEmailWork: string;
  fileShareMessages: string;
  fileShareNotes: string;
  filePrint: string;
  editUndo: string;
  editRedo: string;
  editCut: string;
  editCopy: string;
  editPaste: string;
  editSelectAll: string;
  viewReload: string;
  viewForceReload: string;
  viewToggleFullscreen: string;
  viewHideSidebar: string;
  profile1: string;
  profile2: string;
  profile3: string;
  profileEdit: string;
  profileAdd: string;
}

export const MENUBAR_DEMO_LOCALES: Record<string, MenubarDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Menubar', description: 'A horizontal menu bar with dropdown menus.',
    menuFile: 'File', menuEdit: 'Edit', menuView: 'View', menuProfiles: 'Profiles',
    fileNewTab: 'New Tab', fileNewWindow: 'New Window', fileNewIncognito: 'New Incognito Window',
    fileShare: 'Share', fileShareEmail: 'Email', fileShareEmailPersonal: 'Personal', fileShareEmailWork: 'Work',
    fileShareMessages: 'Messages', fileShareNotes: 'Notes', filePrint: 'Print',
    editUndo: 'Undo', editRedo: 'Redo', editCut: 'Cut', editCopy: 'Copy', editPaste: 'Paste', editSelectAll: 'Select All',
    viewReload: 'Reload', viewForceReload: 'Force Reload', viewToggleFullscreen: 'Toggle Fullscreen', viewHideSidebar: 'Hide Sidebar',
    profile1: 'Andy', profile2: 'Benoit', profile3: 'Luis', profileEdit: 'Edit...', profileAdd: 'Add Profile...',
  },
  he: {
    code: 'he', rtl: true,
    heading: 'שורת תפריט', description: 'שורת תפריט אופקית עם תפריטים נפתחים.',
    menuFile: 'קובץ', menuEdit: 'עריכה', menuView: 'תצוגה', menuProfiles: 'פרופילים',
    fileNewTab: 'כרטיסייה חדשה', fileNewWindow: 'חלון חדש', fileNewIncognito: 'חלון גלישה פרטית חדש',
    fileShare: 'שיתוף', fileShareEmail: 'אימייל', fileShareEmailPersonal: 'אישי', fileShareEmailWork: 'עבודה',
    fileShareMessages: 'הודעות', fileShareNotes: 'הערות', filePrint: 'הדפסה',
    editUndo: 'בטל', editRedo: 'בצע שוב', editCut: 'גזור', editCopy: 'העתק', editPaste: 'הדבק', editSelectAll: 'בחר הכל',
    viewReload: 'טען מחדש', viewForceReload: 'טעינה מחדש מאולצת', viewToggleFullscreen: 'מסך מלא', viewHideSidebar: 'הסתר סרגל צד',
    profile1: 'עמיר', profile2: 'מיכל', profile3: 'יוסי', profileEdit: 'עריכה...', profileAdd: 'הוסף פרופיל...',
  },
  ar: {
    code: 'ar', rtl: true,
    heading: 'شريط القوائم', description: 'شريط قوائم أفقي مع قوائم منسدلة.',
    menuFile: 'ملف', menuEdit: 'تحرير', menuView: 'عرض', menuProfiles: 'الملفات الشخصية',
    fileNewTab: 'علامة تبويب جديدة', fileNewWindow: 'نافذة جديدة', fileNewIncognito: 'نافذة تصفح خاص جديدة',
    fileShare: 'مشاركة', fileShareEmail: 'بريد إلكتروني', fileShareEmailPersonal: 'شخصي', fileShareEmailWork: 'عمل',
    fileShareMessages: 'رسائل', fileShareNotes: 'ملاحظات', filePrint: 'طباعة',
    editUndo: 'تراجع', editRedo: 'إعادة', editCut: 'قص', editCopy: 'نسخ', editPaste: 'لصق', editSelectAll: 'تحديد الكل',
    viewReload: 'إعادة تحميل', viewForceReload: 'إعادة تحميل إجبارية', viewToggleFullscreen: 'ملء الشاشة', viewHideSidebar: 'إخفاء الشريط الجانبي',
    profile1: 'أحمد', profile2: 'فاطمة', profile3: 'محمد', profileEdit: 'تعديل...', profileAdd: 'إضافة ملف شخصي...',
  },
  de: {
    code: 'de',
    heading: 'Menüleiste', description: 'Eine horizontale Menüleiste mit Dropdown-Menüs.',
    menuFile: 'Datei', menuEdit: 'Bearbeiten', menuView: 'Ansicht', menuProfiles: 'Profile',
    fileNewTab: 'Neuer Tab', fileNewWindow: 'Neues Fenster', fileNewIncognito: 'Neues Inkognito-Fenster',
    fileShare: 'Teilen', fileShareEmail: 'E-Mail', fileShareEmailPersonal: 'Privat', fileShareEmailWork: 'Arbeit',
    fileShareMessages: 'Nachrichten', fileShareNotes: 'Notizen', filePrint: 'Drucken',
    editUndo: 'Rückgängig', editRedo: 'Wiederholen', editCut: 'Ausschneiden', editCopy: 'Kopieren', editPaste: 'Einfügen', editSelectAll: 'Alles auswählen',
    viewReload: 'Neu laden', viewForceReload: 'Erzwungenes Neuladen', viewToggleFullscreen: 'Vollbild umschalten', viewHideSidebar: 'Seitenleiste ausblenden',
    profile1: 'Andreas', profile2: 'Beate', profile3: 'Lars', profileEdit: 'Bearbeiten...', profileAdd: 'Profil hinzufügen...',
  },
  fr: {
    code: 'fr',
    heading: 'Barre de menus', description: 'Une barre de menus horizontale avec des menus déroulants.',
    menuFile: 'Fichier', menuEdit: 'Éditer', menuView: 'Affichage', menuProfiles: 'Profils',
    fileNewTab: 'Nouvel onglet', fileNewWindow: 'Nouvelle fenêtre', fileNewIncognito: 'Nouvelle fenêtre de navigation privée',
    fileShare: 'Partager', fileShareEmail: 'E-mail', fileShareEmailPersonal: 'Personnel', fileShareEmailWork: 'Professionnel',
    fileShareMessages: 'Messages', fileShareNotes: 'Notes', filePrint: 'Imprimer',
    editUndo: 'Annuler', editRedo: 'Rétablir', editCut: 'Couper', editCopy: 'Copier', editPaste: 'Coller', editSelectAll: 'Tout sélectionner',
    viewReload: 'Actualiser', viewForceReload: 'Forcer l\'actualisation', viewToggleFullscreen: 'Plein écran', viewHideSidebar: 'Masquer la barre latérale',
    profile1: 'Antoine', profile2: 'Béatrice', profile3: 'Louis', profileEdit: 'Modifier...', profileAdd: 'Ajouter un profil...',
  },
  es: {
    code: 'es',
    heading: 'Barra de menús', description: 'Una barra de menús horizontal con menús desplegables.',
    menuFile: 'Archivo', menuEdit: 'Editar', menuView: 'Ver', menuProfiles: 'Perfiles',
    fileNewTab: 'Nueva pestaña', fileNewWindow: 'Nueva ventana', fileNewIncognito: 'Nueva ventana de incógnito',
    fileShare: 'Compartir', fileShareEmail: 'Correo electrónico', fileShareEmailPersonal: 'Personal', fileShareEmailWork: 'Trabajo',
    fileShareMessages: 'Mensajes', fileShareNotes: 'Notas', filePrint: 'Imprimir',
    editUndo: 'Deshacer', editRedo: 'Rehacer', editCut: 'Cortar', editCopy: 'Copiar', editPaste: 'Pegar', editSelectAll: 'Seleccionar todo',
    viewReload: 'Recargar', viewForceReload: 'Forzar recarga', viewToggleFullscreen: 'Pantalla completa', viewHideSidebar: 'Ocultar barra lateral',
    profile1: 'Andrés', profile2: 'Beatriz', profile3: 'Luis', profileEdit: 'Editar...', profileAdd: 'Añadir perfil...',
  },
  ja: {
    code: 'ja',
    heading: 'メニューバー', description: 'ドロップダウンメニュー付きの水平メニューバー。',
    menuFile: 'ファイル', menuEdit: '編集', menuView: '表示', menuProfiles: 'プロフィール',
    fileNewTab: '新しいタブ', fileNewWindow: '新しいウィンドウ', fileNewIncognito: 'シークレットウィンドウ',
    fileShare: '共有', fileShareEmail: 'メール', fileShareEmailPersonal: '個人', fileShareEmailWork: '仕事',
    fileShareMessages: 'メッセージ', fileShareNotes: 'メモ', filePrint: '印刷',
    editUndo: '元に戻す', editRedo: 'やり直す', editCut: '切り取り', editCopy: 'コピー', editPaste: '貼り付け', editSelectAll: 'すべて選択',
    viewReload: '再読み込み', viewForceReload: '強制再読み込み', viewToggleFullscreen: 'フルスクリーン', viewHideSidebar: 'サイドバーを隠す',
    profile1: '太郎', profile2: '花子', profile3: '次郎', profileEdit: '編集...', profileAdd: 'プロフィールを追加...',
  },
  zh: {
    code: 'zh',
    heading: '菜单栏', description: '带有下拉菜单的水平菜单栏。',
    menuFile: '文件', menuEdit: '编辑', menuView: '视图', menuProfiles: '个人资料',
    fileNewTab: '新建标签页', fileNewWindow: '新建窗口', fileNewIncognito: '新建隐私窗口',
    fileShare: '分享', fileShareEmail: '电子邮件', fileShareEmailPersonal: '个人', fileShareEmailWork: '工作',
    fileShareMessages: '消息', fileShareNotes: '备注', filePrint: '打印',
    editUndo: '撤销', editRedo: '重做', editCut: '剪切', editCopy: '复制', editPaste: '粘贴', editSelectAll: '全选',
    viewReload: '重新加载', viewForceReload: '强制重新加载', viewToggleFullscreen: '切换全屏', viewHideSidebar: '隐藏侧边栏',
    profile1: '伟明', profile2: '美玲', profile3: '建国', profileEdit: '编辑...', profileAdd: '添加个人资料...',
  },
  ru: {
    code: 'ru',
    heading: 'Строка меню', description: 'Горизонтальная строка меню с выпадающими меню.',
    menuFile: 'Файл', menuEdit: 'Правка', menuView: 'Вид', menuProfiles: 'Профили',
    fileNewTab: 'Новая вкладка', fileNewWindow: 'Новое окно', fileNewIncognito: 'Новое окно инкогнито',
    fileShare: 'Поделиться', fileShareEmail: 'Эл. почта', fileShareEmailPersonal: 'Личная', fileShareEmailWork: 'Рабочая',
    fileShareMessages: 'Сообщения', fileShareNotes: 'Заметки', filePrint: 'Печать',
    editUndo: 'Отменить', editRedo: 'Повторить', editCut: 'Вырезать', editCopy: 'Копировать', editPaste: 'Вставить', editSelectAll: 'Выделить всё',
    viewReload: 'Перезагрузить', viewForceReload: 'Принудительная перезагрузка', viewToggleFullscreen: 'Полный экран', viewHideSidebar: 'Скрыть боковую панель',
    profile1: 'Андрей', profile2: 'Екатерина', profile3: 'Михаил', profileEdit: 'Изменить...', profileAdd: 'Добавить профиль...',
  },
  pt: {
    code: 'pt',
    heading: 'Barra de menus', description: 'Uma barra de menus horizontal com menus suspensos.',
    menuFile: 'Arquivo', menuEdit: 'Editar', menuView: 'Ver', menuProfiles: 'Perfis',
    fileNewTab: 'Nova guia', fileNewWindow: 'Nova janela', fileNewIncognito: 'Nova janela anônima',
    fileShare: 'Compartilhar', fileShareEmail: 'E-mail', fileShareEmailPersonal: 'Pessoal', fileShareEmailWork: 'Trabalho',
    fileShareMessages: 'Mensagens', fileShareNotes: 'Notas', filePrint: 'Imprimir',
    editUndo: 'Desfazer', editRedo: 'Refazer', editCut: 'Recortar', editCopy: 'Copiar', editPaste: 'Colar', editSelectAll: 'Selecionar tudo',
    viewReload: 'Recarregar', viewForceReload: 'Forçar recarga', viewToggleFullscreen: 'Alternar tela cheia', viewHideSidebar: 'Ocultar barra lateral',
    profile1: 'André', profile2: 'Beatriz', profile3: 'Luís', profileEdit: 'Editar...', profileAdd: 'Adicionar perfil...',
  },
};
