import type { LocaleMeta } from '../../lib/i18n';

/**
 * Localized announcement strings emitted by `<ui-sortable>` via the
 * aria-live helper.
 *
 * Functions (not raw strings) because every message interpolates a
 * label, position, total, or reason. Plug into the shared `LocaleMeta`
 * base so the same `createLocaleSelector` / `provideUiLocale` plumbing
 * that the rest of the library uses also wires the sortable.
 */
export interface SortableLocale extends LocaleMeta {
    /** Lifted via keyboard or grab. */
    pickedUp: (label: string, position: number, total: number) => string;
    /** Moved within the same list. */
    moved: (position: number, total: number) => string;
    /** Moved across to a peer in the same group. */
    movedToList: (listLabel: string, position: number, total: number) => string;
    /** Drop committed (final landing). */
    dropped: (position: number) => string;
    /** Drop rejected by accepts(). */
    rejected: (reason: string | null) => string;
    /** Keyboard drag cancelled (Escape) or mid-drag interruption. */
    cancelled: string;
}

export const SORTABLE_LOCALES: Record<string, SortableLocale> = {
    en: {
        code: 'en',
        pickedUp: (label, n, total) => `${label} picked up. Position ${n} of ${total}.`,
        moved: (n, total) => `Moved to position ${n} of ${total}.`,
        movedToList: (listLabel, n, total) => `Moved to ${listLabel}, position ${n} of ${total}.`,
        dropped: (n) => `Dropped at position ${n}.`,
        rejected: (reason) => (reason ? `Cannot drop here. ${reason}.` : 'Cannot drop here.'),
        cancelled: 'Reorder cancelled.',
    },
    he: {
        code: 'he',
        rtl: true,
        pickedUp: (label, n, total) => `${label} הורם. מיקום ${n} מתוך ${total}.`,
        moved: (n, total) => `הועבר למיקום ${n} מתוך ${total}.`,
        movedToList: (listLabel, n, total) => `הועבר ל${listLabel}, מיקום ${n} מתוך ${total}.`,
        dropped: (n) => `שוחרר במיקום ${n}.`,
        rejected: (reason) => (reason ? `לא ניתן לשחרר כאן. ${reason}.` : 'לא ניתן לשחרר כאן.'),
        cancelled: 'הסידור בוטל.',
    },
    ar: {
        code: 'ar',
        rtl: true,
        pickedUp: (label, n, total) => `${label} تم رفعه. الموضع ${n} من ${total}.`,
        moved: (n, total) => `تم النقل إلى الموضع ${n} من ${total}.`,
        movedToList: (listLabel, n, total) => `تم النقل إلى ${listLabel}، الموضع ${n} من ${total}.`,
        dropped: (n) => `تم الإسقاط في الموضع ${n}.`,
        rejected: (reason) => (reason ? `لا يمكن الإسقاط هنا. ${reason}.` : 'لا يمكن الإسقاط هنا.'),
        cancelled: 'تم إلغاء إعادة الترتيب.',
    },
    de: {
        code: 'de',
        pickedUp: (label, n, total) => `${label} aufgenommen. Position ${n} von ${total}.`,
        moved: (n, total) => `Auf Position ${n} von ${total} verschoben.`,
        movedToList: (listLabel, n, total) => `Nach ${listLabel}, Position ${n} von ${total} verschoben.`,
        dropped: (n) => `An Position ${n} abgelegt.`,
        rejected: (reason) => (reason ? `Hier kann nicht abgelegt werden. ${reason}.` : 'Hier kann nicht abgelegt werden.'),
        cancelled: 'Sortierung abgebrochen.',
    },
    fr: {
        code: 'fr',
        pickedUp: (label, n, total) => `${label} pris. Position ${n} sur ${total}.`,
        moved: (n, total) => `Déplacé à la position ${n} sur ${total}.`,
        movedToList: (listLabel, n, total) => `Déplacé vers ${listLabel}, position ${n} sur ${total}.`,
        dropped: (n) => `Déposé à la position ${n}.`,
        rejected: (reason) => (reason ? `Dépôt impossible ici. ${reason}.` : 'Dépôt impossible ici.'),
        cancelled: 'Réorganisation annulée.',
    },
    es: {
        code: 'es',
        pickedUp: (label, n, total) => `${label} levantado. Posición ${n} de ${total}.`,
        moved: (n, total) => `Movido a la posición ${n} de ${total}.`,
        movedToList: (listLabel, n, total) => `Movido a ${listLabel}, posición ${n} de ${total}.`,
        dropped: (n) => `Soltado en la posición ${n}.`,
        rejected: (reason) => (reason ? `No se puede soltar aquí. ${reason}.` : 'No se puede soltar aquí.'),
        cancelled: 'Reordenamiento cancelado.',
    },
};
