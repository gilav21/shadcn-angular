import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface RichTextActionsDemoLocale extends LocaleMeta {
    heading: string;
    description: string;
    editorHeading: string;
    editorHint: string;
    publishedHeading: string;
    publishedHint: string;
    presetsHeading: string;
    presetsHint: string;
    lastFired: string;
}

const en: RichTextActionsDemoLocale = {
    code: 'en',
    heading: 'Rich Text — Interactive Actions',
    description:
        'Attach premade click/hover actions to text and images. The editor emits inert ' +
        'data-action-* HTML; the render-side directive fires your callbacks — here, opening a real dialog.',
    editorHeading: 'Editor (tier-1 fields)',
    editorHint: 'Select a word, then use the ⚡ toolbar button to attach an "Open dialog" action.',
    publishedHeading: 'Published page',
    publishedHint: 'Clicking an actioned run fires the developer callback.',
    presetsHeading: 'Batteries-included presets',
    presetsHint: 'hoverCardAction() + openDialogAction() render real UI with a few lines — no custom handlers.',
    lastFired: 'Last fired',
};

const he: RichTextActionsDemoLocale = {
    code: 'he',
    rtl: true,
    heading: 'טקסט עשיר — פעולות אינטראקטיביות',
    description:
        'צירוף פעולות לחיצה/ריחוף לטקסט ולתמונות. העורך פולט HTML אינרטי עם data-action-*; ' +
        'ההנחיה בצד הרינדור מפעילה את הקולבקים שלכם — כאן, פתיחת דיאלוג אמיתי.',
    editorHeading: 'עורך (שדות שכבה 1)',
    editorHint: 'בחרו מילה, ואז השתמשו בכפתור ⚡ בסרגל כדי לצרף פעולת „פתיחת דיאלוג”.',
    publishedHeading: 'עמוד מפורסם',
    publishedHint: 'לחיצה על קטע עם פעולה מפעילה את קולבק המפתח.',
    presetsHeading: 'הגדרות מוכנות מראש',
    presetsHint: 'hoverCardAction() + openDialogAction() מציגים ממשק אמיתי בכמה שורות — ללא קולבקים מותאמים.',
    lastFired: 'הופעל לאחרונה',
};

export const RICH_TEXT_ACTIONS_DEMO_LOCALES: Record<string, RichTextActionsDemoLocale> = { en, he };
