import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface EmptyDemoLocale extends LocaleMeta {
  heading: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  buttonLabel: string;
}

export const EMPTY_DEMO_LOCALES: Record<string, EmptyDemoLocale> = {
  en: {
    code: 'en',
    heading: 'Empty',
    description: 'A unified empty state component for lists, tables, and other data displays.',
    emptyTitle: 'No messages',
    emptyDescription: "You haven't received any messages yet.",
    buttonLabel: 'Send Message',
  },
  he: {
    code: 'he',
    rtl: true,
    heading: 'ריק',
    description: 'רכיב מצב ריק אחיד לרשימות, טבלאות ותצוגות נתונים אחרות.',
    emptyTitle: 'אין הודעות',
    emptyDescription: 'עדיין לא קיבלת הודעות.',
    buttonLabel: 'שלח הודעה',
  },
  ar: {
    code: 'ar',
    rtl: true,
    heading: 'فارغ',
    description: 'مكون حالة فارغة موحد للقوائم والجداول وعروض البيانات الأخرى.',
    emptyTitle: 'لا رسائل',
    emptyDescription: 'لم تستلم أي رسائل بعد.',
    buttonLabel: 'إرسال رسالة',
  },
  de: {
    code: 'de',
    heading: 'Leer',
    description: 'Eine einheitliche Leer-Zustand-Komponente für Listen, Tabellen und andere Datenanzeigen.',
    emptyTitle: 'Keine Nachrichten',
    emptyDescription: 'Sie haben noch keine Nachrichten erhalten.',
    buttonLabel: 'Nachricht senden',
  },
  fr: {
    code: 'fr',
    heading: 'Vide',
    description: 'Un composant d\'état vide unifié pour les listes, tableaux et autres affichages de données.',
    emptyTitle: 'Aucun message',
    emptyDescription: "Vous n'avez pas encore reçu de messages.",
    buttonLabel: 'Envoyer un message',
  },
  es: {
    code: 'es',
    heading: 'Vacío',
    description: 'Un componente de estado vacío unificado para listas, tablas y otras visualizaciones de datos.',
    emptyTitle: 'Sin mensajes',
    emptyDescription: 'Todavía no has recibido ningún mensaje.',
    buttonLabel: 'Enviar mensaje',
  },
  ja: {
    code: 'ja',
    heading: '空',
    description: 'リスト、テーブル、その他のデータ表示用の統合された空状態コンポーネント。',
    emptyTitle: 'メッセージなし',
    emptyDescription: 'まだメッセージを受け取っていません。',
    buttonLabel: 'メッセージを送る',
  },
  zh: {
    code: 'zh',
    heading: '空状态',
    description: '用于列表、表格和其他数据显示的统一空状态组件。',
    emptyTitle: '没有消息',
    emptyDescription: '您还没有收到任何消息。',
    buttonLabel: '发送消息',
  },
  ru: {
    code: 'ru',
    heading: 'Пусто',
    description: 'Унифицированный компонент пустого состояния для списков, таблиц и других отображений данных.',
    emptyTitle: 'Нет сообщений',
    emptyDescription: 'Вы ещё не получили ни одного сообщения.',
    buttonLabel: 'Отправить сообщение',
  },
  pt: {
    code: 'pt',
    heading: 'Vazio',
    description: 'Um componente de estado vazio unificado para listas, tabelas e outras exibições de dados.',
    emptyTitle: 'Nenhuma mensagem',
    emptyDescription: 'Você ainda não recebeu nenhuma mensagem.',
    buttonLabel: 'Enviar mensagem',
  },
};
