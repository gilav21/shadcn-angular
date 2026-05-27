// demo/src/app/demos/overlay/alert-dialog-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface AlertDialogDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  triggerLabel: string;
  dialogTitle: string;
  dialogDescription: string;
  cancelLabel: string;
  continueLabel: string;
}

export const ALERT_DIALOG_DEMO_LOCALES: Record<string, AlertDialogDemoLocale> = {
  en: {
    code: 'en',
    title: 'Alert Dialog',
    description: 'A modal dialog that interrupts the user with important content.',
    triggerLabel: 'Show Alert Dialog',
    dialogTitle: 'Are you absolutely sure?',
    dialogDescription: 'This action cannot be undone. This will permanently delete your account and remove your data from our servers.',
    cancelLabel: 'Cancel',
    continueLabel: 'Continue',
  },
  he: {
    code: 'he', rtl: true,
    title: 'תיבת דו-שיח התראה',
    description: 'חלון מודאלי שמפריע למשתמש עם תוכן חשוב.',
    triggerLabel: 'הצג תיבת התראה',
    dialogTitle: 'האם אתה בטוח לגמרי?',
    dialogDescription: 'לא ניתן לבטל פעולה זו. היא תמחק לצמיתות את חשבונך ותסיר את הנתונים שלך מהשרתים שלנו.',
    cancelLabel: 'ביטול',
    continueLabel: 'המשך',
  },
  ar: {
    code: 'ar', rtl: true,
    title: 'مربع حوار التنبيه',
    description: 'مربع حوار مشروط يقاطع المستخدم بمحتوى مهم.',
    triggerLabel: 'عرض مربع التنبيه',
    dialogTitle: 'هل أنت متأكد تمامًا؟',
    dialogDescription: 'لا يمكن التراجع عن هذا الإجراء. سيؤدي ذلك إلى حذف حسابك نهائيًا وإزالة بياناتك من خوادمنا.',
    cancelLabel: 'إلغاء',
    continueLabel: 'متابعة',
  },
  de: {
    code: 'de',
    title: 'Bestätigungsdialog',
    description: 'Ein modaler Dialog, der den Benutzer mit wichtigen Inhalten unterbricht.',
    triggerLabel: 'Bestätigungsdialog anzeigen',
    dialogTitle: 'Sind Sie absolut sicher?',
    dialogDescription: 'Diese Aktion kann nicht rückgängig gemacht werden. Ihr Konto wird dauerhaft gelöscht und Ihre Daten werden von unseren Servern entfernt.',
    cancelLabel: 'Abbrechen',
    continueLabel: 'Fortfahren',
  },
  fr: {
    code: 'fr',
    title: 'Boîte de dialogue d\'alerte',
    description: 'Une boîte de dialogue modale qui interrompt l\'utilisateur avec un contenu important.',
    triggerLabel: 'Afficher la boîte d\'alerte',
    dialogTitle: 'Êtes-vous absolument sûr ?',
    dialogDescription: 'Cette action est irréversible. Votre compte sera définitivement supprimé et vos données seront retirées de nos serveurs.',
    cancelLabel: 'Annuler',
    continueLabel: 'Continuer',
  },
  es: {
    code: 'es',
    title: 'Diálogo de alerta',
    description: 'Un diálogo modal que interrumpe al usuario con contenido importante.',
    triggerLabel: 'Mostrar diálogo de alerta',
    dialogTitle: '¿Estás completamente seguro?',
    dialogDescription: 'Esta acción no se puede deshacer. Se eliminará permanentemente tu cuenta y tus datos serán borrados de nuestros servidores.',
    cancelLabel: 'Cancelar',
    continueLabel: 'Continuar',
  },
  ja: {
    code: 'ja',
    title: '警告ダイアログ',
    description: '重要なコンテンツでユーザーを中断するモーダルダイアログです。',
    triggerLabel: '警告ダイアログを表示',
    dialogTitle: '本当によろしいですか？',
    dialogDescription: 'この操作は元に戻せません。アカウントが完全に削除され、データがサーバーから削除されます。',
    cancelLabel: 'キャンセル',
    continueLabel: '続行',
  },
  zh: {
    code: 'zh',
    title: '警告对话框',
    description: '一个用重要内容打断用户的模态对话框。',
    triggerLabel: '显示警告对话框',
    dialogTitle: '您确定要继续吗？',
    dialogDescription: '此操作无法撤销。这将永久删除您的账户并从我们的服务器中移除您的数据。',
    cancelLabel: '取消',
    continueLabel: '继续',
  },
  ru: {
    code: 'ru',
    title: 'Диалог подтверждения',
    description: 'Модальный диалог, прерывающий пользователя важным содержимым.',
    triggerLabel: 'Показать диалог',
    dialogTitle: 'Вы абсолютно уверены?',
    dialogDescription: 'Это действие нельзя отменить. Ваш аккаунт будет удалён навсегда, а данные — стёрты с наших серверов.',
    cancelLabel: 'Отмена',
    continueLabel: 'Продолжить',
  },
  pt: {
    code: 'pt',
    title: 'Caixa de diálogo de alerta',
    description: 'Um diálogo modal que interrompe o usuário com conteúdo importante.',
    triggerLabel: 'Mostrar caixa de alerta',
    dialogTitle: 'Tem certeza absoluta?',
    dialogDescription: 'Esta ação não pode ser desfeita. Sua conta será excluída permanentemente e seus dados serão removidos dos nossos servidores.',
    cancelLabel: 'Cancelar',
    continueLabel: 'Continuar',
  },
};
