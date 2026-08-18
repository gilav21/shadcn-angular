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
  secondBarHeading: string;
  disabledSubHint: string;
  firstItemDisabledHint: string;
  wrapAroundHint: string;
  menuExport: string;
  exportPdf: string;
  exportImage: string;
  exportCloud: string;
  exportCloudDrive: string;
  exportCloudDropbox: string;
  menuHistory: string;
  historyRestore: string;
  historyRecent: string;
  historyClear: string;
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
    secondBarHeading: 'Disabled Sub-Trigger and Disabled First Item',
    disabledSubHint: 'In Export, the dimmed branch refuses to open — hover, click and Enter/ArrowRight all do nothing.',
    firstItemDisabledHint: 'Open History with Enter or ArrowDown — focus lands on the first selectable item, not the disabled one.',
    wrapAroundHint: 'Arrow-key wrap-around stays inside the menubar you started in — it never jumps to the menubar above.',
    menuExport: 'Export', exportPdf: 'Export as PDF', exportImage: 'Export as Image',
    exportCloud: 'Send to Cloud', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: 'History', historyRestore: 'Restore Last Session', historyRecent: 'Recent Tabs', historyClear: 'Clear History',
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
    secondBarHeading: 'מפעיל תפריט משנה מושבת ופריט ראשון מושבת',
    disabledSubHint: 'בתפריט ייצוא, הענף המעומעם מסרב להיפתח — ריחוף, לחיצה ו-Enter/חץ שמאלה אינם עושים דבר.',
    firstItemDisabledHint: 'פתחו את היסטוריה עם Enter או חץ למטה — המיקוד נוחת על הפריט הראשון הניתן לבחירה, לא על המושבת.',
    wrapAroundHint: 'מעבר מחזורי בחצים נשאר בתוך שורת התפריט שממנה התחלתם — הוא לעולם לא קופץ לשורה שמעל.',
    menuExport: 'ייצוא', exportPdf: 'ייצוא כ-PDF', exportImage: 'ייצוא כתמונה',
    exportCloud: 'שליחה לענן', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: 'היסטוריה', historyRestore: 'שחזור הפעלה אחרונה', historyRecent: 'כרטיסיות אחרונות', historyClear: 'ניקוי היסטוריה',
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
    secondBarHeading: 'مُشغِّل قائمة فرعية معطَّل وعنصر أول معطَّل',
    disabledSubHint: 'في قائمة التصدير، الفرع الباهت يرفض الفتح — التمرير والنقر وEnter/السهم الأيسر لا تفعل شيئًا.',
    firstItemDisabledHint: 'افتح السجل بمفتاح Enter أو السهم لأسفل — يستقر التركيز على أول عنصر قابل للتحديد وليس على المعطَّل.',
    wrapAroundHint: 'يبقى التنقل الدائري بالأسهم داخل شريط القوائم الذي بدأت منه — ولا ينتقل أبدًا إلى الشريط الذي فوقه.',
    menuExport: 'تصدير', exportPdf: 'تصدير كملف PDF', exportImage: 'تصدير كصورة',
    exportCloud: 'إرسال إلى السحابة', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: 'السجل', historyRestore: 'استعادة الجلسة الأخيرة', historyRecent: 'علامات التبويب الأخيرة', historyClear: 'مسح السجل',
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
    secondBarHeading: 'Deaktivierter Unter-Auslöser und deaktiviertes erstes Element',
    disabledSubHint: 'In Exportieren lässt sich der abgeblendete Zweig nicht öffnen — Hover, Klick und Enter/Pfeil-rechts bleiben wirkungslos.',
    firstItemDisabledHint: 'Verlauf mit Enter oder Pfeil-nach-unten öffnen — der Fokus landet auf dem ersten auswählbaren Element, nicht auf dem deaktivierten.',
    wrapAroundHint: 'Der Pfeiltasten-Umlauf bleibt in der Menüleiste, in der Sie begonnen haben — er springt nie zur Leiste darüber.',
    menuExport: 'Exportieren', exportPdf: 'Als PDF exportieren', exportImage: 'Als Bild exportieren',
    exportCloud: 'In die Cloud senden', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: 'Verlauf', historyRestore: 'Letzte Sitzung wiederherstellen', historyRecent: 'Zuletzt geöffnete Tabs', historyClear: 'Verlauf löschen',
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
    secondBarHeading: 'Sous-déclencheur désactivé et premier élément désactivé',
    disabledSubHint: 'Dans Exporter, la branche grisée refuse de s\'ouvrir — survol, clic et Entrée/Flèche droite ne font rien.',
    firstItemDisabledHint: 'Ouvrez Historique avec Entrée ou Flèche bas — le focus se pose sur le premier élément sélectionnable, pas sur celui désactivé.',
    wrapAroundHint: 'Le bouclage au clavier reste dans la barre de menus où vous avez commencé — il ne saute jamais à celle du dessus.',
    menuExport: 'Exporter', exportPdf: 'Exporter en PDF', exportImage: 'Exporter en image',
    exportCloud: 'Envoyer vers le cloud', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: 'Historique', historyRestore: 'Restaurer la dernière session', historyRecent: 'Onglets récents', historyClear: 'Effacer l\'historique',
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
    secondBarHeading: 'Subdisparador deshabilitado y primer elemento deshabilitado',
    disabledSubHint: 'En Exportar, la rama atenuada no se abre — pasar el ratón, hacer clic y Enter/Flecha derecha no hacen nada.',
    firstItemDisabledHint: 'Abre Historial con Enter o Flecha abajo — el foco cae en el primer elemento seleccionable, no en el deshabilitado.',
    wrapAroundHint: 'El ciclo con las flechas se queda dentro de la barra de menús donde empezaste — nunca salta a la barra de arriba.',
    menuExport: 'Exportar', exportPdf: 'Exportar como PDF', exportImage: 'Exportar como imagen',
    exportCloud: 'Enviar a la nube', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: 'Historial', historyRestore: 'Restaurar la última sesión', historyRecent: 'Pestañas recientes', historyClear: 'Borrar historial',
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
    secondBarHeading: '無効なサブトリガーと無効な先頭項目',
    disabledSubHint: 'エクスポート内の淡色表示の項目は開きません — ホバー、クリック、Enter / 右矢印のいずれも効きません。',
    firstItemDisabledHint: '履歴を Enter または下矢印で開くと、無効な項目ではなく最初の選択可能な項目にフォーカスが移ります。',
    wrapAroundHint: '矢印キーの循環は操作を始めたメニューバー内にとどまり、上のメニューバーへ移ることはありません。',
    menuExport: 'エクスポート', exportPdf: 'PDF としてエクスポート', exportImage: '画像としてエクスポート',
    exportCloud: 'クラウドに送信', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: '履歴', historyRestore: '前回のセッションを復元', historyRecent: '最近のタブ', historyClear: '履歴を消去',
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
    secondBarHeading: '禁用的子触发器与禁用的首项',
    disabledSubHint: '在“导出”中，变暗的分支无法展开 — 悬停、点击以及 Enter/右箭头都不起作用。',
    firstItemDisabledHint: '用 Enter 或向下箭头打开“历史记录” — 焦点会落在第一个可选项上，而不是被禁用的那一项。',
    wrapAroundHint: '方向键的循环始终停留在你开始操作的菜单栏内 — 永远不会跳到上面那条菜单栏。',
    menuExport: '导出', exportPdf: '导出为 PDF', exportImage: '导出为图片',
    exportCloud: '发送到云端', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: '历史记录', historyRestore: '恢复上次会话', historyRecent: '最近的标签页', historyClear: '清除历史记录',
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
    secondBarHeading: 'Отключённый подтриггер и отключённый первый пункт',
    disabledSubHint: 'В меню «Экспорт» приглушённая ветка не открывается — наведение, клик и Enter/стрелка вправо не действуют.',
    firstItemDisabledHint: 'Откройте «Историю» клавишей Enter или стрелкой вниз — фокус встанет на первый доступный пункт, а не на отключённый.',
    wrapAroundHint: 'Циклический переход стрелками остаётся внутри той строки меню, с которой вы начали, и никогда не перескакивает на строку выше.',
    menuExport: 'Экспорт', exportPdf: 'Экспорт в PDF', exportImage: 'Экспорт в изображение',
    exportCloud: 'Отправить в облако', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: 'История', historyRestore: 'Восстановить последний сеанс', historyRecent: 'Недавние вкладки', historyClear: 'Очистить историю',
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
    secondBarHeading: 'Subgatilho desativado e primeiro item desativado',
    disabledSubHint: 'Em Exportar, o ramo esmaecido não abre — passar o mouse, clicar e Enter/Seta direita não fazem nada.',
    firstItemDisabledHint: 'Abra o Histórico com Enter ou Seta para baixo — o foco cai no primeiro item selecionável, não no desativado.',
    wrapAroundHint: 'O ciclo com as setas permanece na barra de menus em que você começou — nunca salta para a barra acima.',
    menuExport: 'Exportar', exportPdf: 'Exportar como PDF', exportImage: 'Exportar como imagem',
    exportCloud: 'Enviar para a nuvem', exportCloudDrive: 'Drive', exportCloudDropbox: 'Dropbox',
    menuHistory: 'Histórico', historyRestore: 'Restaurar a última sessão', historyRecent: 'Guias recentes', historyClear: 'Limpar histórico',
  },
};
