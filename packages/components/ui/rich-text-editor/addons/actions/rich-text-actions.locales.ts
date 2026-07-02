import type { LocaleMeta } from '../../../../lib/i18n';

/** Localized strings for the rich-text-actions addon UI. */
export interface RichTextActionsLocale extends LocaleMeta {
    dialog: {
        attachToText: string;
        attachToImage: string;
        editTitle: string;
        searchPlaceholder: string;
        searchLabel: string;
        noActions: string;
        replacesExisting: string;
        cancel: string;
        attach: string;
        replace: string;
    };
    popover: {
        unavailable: string;
        edit: string;
        remove: string;
        add: string;
    };
    form: {
        /** `{field}` is interpolated with the field label. */
        required: string;
    };
}

const en: RichTextActionsLocale = {
    code: 'en',
    dialog: {
        attachToText: 'Attach action to “{text}”',
        attachToImage: 'Attach action to image',
        editTitle: 'Edit action',
        searchPlaceholder: 'Search actions…',
        searchLabel: 'Search actions',
        noActions: 'No actions available.',
        replacesExisting: '(replaces existing)',
        cancel: 'Cancel',
        attach: 'Attach',
        replace: 'Replace',
    },
    popover: {
        unavailable: '(unavailable)',
        edit: 'Edit',
        remove: 'Remove',
        add: '+ Add action',
    },
    form: {
        required: '{field} is required',
    },
};

const he: RichTextActionsLocale = {
    code: 'he',
    rtl: true,
    dialog: {
        attachToText: 'צירוף פעולה ל־„{text}”',
        attachToImage: 'צירוף פעולה לתמונה',
        editTitle: 'עריכת פעולה',
        searchPlaceholder: 'חיפוש פעולות…',
        searchLabel: 'חיפוש פעולות',
        noActions: 'אין פעולות זמינות.',
        replacesExisting: '(מחליף קיים)',
        cancel: 'ביטול',
        attach: 'צרף',
        replace: 'החלף',
    },
    popover: {
        unavailable: '(לא זמין)',
        edit: 'עריכה',
        remove: 'הסרה',
        add: '+ הוספת פעולה',
    },
    form: {
        required: '{field} הוא שדה חובה',
    },
};

/** Built-in locale registry for the rich-text-actions addon. */
export const RICH_TEXT_ACTIONS_LOCALES: Record<string, RichTextActionsLocale> = { en, he };
