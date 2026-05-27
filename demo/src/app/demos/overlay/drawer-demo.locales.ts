// demo/src/app/demos/overlay/drawer-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface DrawerDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  openBottomLabel: string;
  drawerTitle: string;
  drawerDescription: string;
  drawerContent: string;
  saveLabel: string;
  cancelLabel: string;
}

export const DRAWER_DEMO_LOCALES: Record<string, DrawerDemoLocale> = {
  en: {
    code: 'en',
    title: 'Drawer',
    description: 'A panel that slides in from the edge of the screen.',
    openBottomLabel: 'Open Bottom Drawer',
    drawerTitle: 'Edit Profile',
    drawerDescription: 'Make changes to your profile here.',
    drawerContent: 'Drawer content goes here...',
    saveLabel: 'Save changes',
    cancelLabel: 'Cancel',
  },
  he: {
    code: 'he', rtl: true,
    title: 'מגירה',
    description: 'פאנל שמחליק מקצה המסך.',
    openBottomLabel: 'פתח מגירה תחתונה',
    drawerTitle: 'ערוך פרופיל',
    drawerDescription: 'ערוך כאן את הפרופיל שלך.',
    drawerContent: 'תוכן המגירה כאן...',
    saveLabel: 'שמור שינויים',
    cancelLabel: 'ביטול',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'الدرج',
    description: 'لوحة تنزلق من حافة الشاشة.',
    openBottomLabel: 'فتح الدرج السفلي',
    drawerTitle: 'تعديل الملف الشخصي',
    drawerDescription: 'أجرِ تغييرات على ملفك الشخصي هنا.',
    drawerContent: 'محتوى الدرج هنا...',
    saveLabel: 'حفظ التغييرات',
    cancelLabel: 'إلغاء',
  },
  de: {
    code: 'de',
    title: 'Schublade',
    description: 'Ein Panel, das vom Bildschirmrand hereinschiebt.',
    openBottomLabel: 'Untere Schublade öffnen',
    drawerTitle: 'Profil bearbeiten',
    drawerDescription: 'Nehmen Sie hier Änderungen an Ihrem Profil vor.',
    drawerContent: 'Schubladeninhalt hier...',
    saveLabel: 'Änderungen speichern',
    cancelLabel: 'Abbrechen',
  },
  fr: {
    code: 'fr',
    title: 'Tiroir',
    description: 'Un panneau qui glisse depuis le bord de l\'écran.',
    openBottomLabel: 'Ouvrir le tiroir inférieur',
    drawerTitle: 'Modifier le profil',
    drawerDescription: 'Apportez des modifications à votre profil ici.',
    drawerContent: 'Le contenu du tiroir va ici...',
    saveLabel: 'Enregistrer les modifications',
    cancelLabel: 'Annuler',
  },
  es: {
    code: 'es',
    title: 'Cajón',
    description: 'Un panel que se desliza desde el borde de la pantalla.',
    openBottomLabel: 'Abrir cajón inferior',
    drawerTitle: 'Editar perfil',
    drawerDescription: 'Realiza cambios en tu perfil aquí.',
    drawerContent: 'El contenido del cajón va aquí...',
    saveLabel: 'Guardar cambios',
    cancelLabel: 'Cancelar',
  },
  ja: {
    code: 'ja',
    title: 'ドロワー',
    description: '画面の端からスライドインするパネルです。',
    openBottomLabel: '下部ドロワーを開く',
    drawerTitle: 'プロフィールを編集',
    drawerDescription: 'ここでプロフィールを変更してください。',
    drawerContent: 'ドロワーのコンテンツはここに...',
    saveLabel: '変更を保存',
    cancelLabel: 'キャンセル',
  },
  zh: {
    code: 'zh',
    title: '抽屉',
    description: '从屏幕边缘滑入的面板。',
    openBottomLabel: '打开底部抽屉',
    drawerTitle: '编辑个人资料',
    drawerDescription: '在此处对您的个人资料进行更改。',
    drawerContent: '抽屉内容在此处...',
    saveLabel: '保存更改',
    cancelLabel: '取消',
  },
  ru: {
    code: 'ru',
    title: 'Выдвижная панель',
    description: 'Панель, выдвигающаяся с края экрана.',
    openBottomLabel: 'Открыть нижнюю панель',
    drawerTitle: 'Редактировать профиль',
    drawerDescription: 'Внесите изменения в свой профиль здесь.',
    drawerContent: 'Содержимое панели здесь...',
    saveLabel: 'Сохранить изменения',
    cancelLabel: 'Отмена',
  },
  pt: {
    code: 'pt',
    title: 'Gaveta',
    description: 'Um painel que desliza a partir da borda da tela.',
    openBottomLabel: 'Abrir gaveta inferior',
    drawerTitle: 'Editar perfil',
    drawerDescription: 'Faça alterações no seu perfil aqui.',
    drawerContent: 'O conteúdo da gaveta vai aqui...',
    saveLabel: 'Salvar alterações',
    cancelLabel: 'Cancelar',
  },
};
