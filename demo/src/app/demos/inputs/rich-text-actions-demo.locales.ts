import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface RichTextActionsDemoLocale extends LocaleMeta {
    heading: string;
    description: string;
    playgroundHeading: string;
    playgroundHint: string;
    editorLabel: string;
    publishedLabel: string;
    eventLogLabel: string;
    emptyLog: string;
    presetsHeading: string;
    presetsHint: string;
    customComponentBadge: string;
    cookbookHeading: string;
    cookbookHint: string;
    copyLabel: string;
    copiedLabel: string;
    tiersHeading: string;
    tiersHint: string;
    tier1Label: string;
    tier1Desc: string;
    tier2Label: string;
    tier2Desc: string;
    tier3Label: string;
    tier3Desc: string;
    tier3EditorLabel: string;
    readonlyHeading: string;
    readonlyHint: string;
    rtlHeading: string;
    rtlHint: string;
    closeLabel: string;
    v2Heading: string;
    v2Hint: string;
    v2StyleLabel: string;
    v2CombinedLabel: string;
    v2CodeTitle: string;
}

const en: RichTextActionsDemoLocale = {
    code: 'en',
    heading: 'Rich Text — Interactive Actions',
    description:
        'Attach premade click and hover actions to text or images. The editor emits inert data-action-* HTML; a ' +
        'framework-free render-side directive fires your callbacks — open a dialog, show a card, track a click, ' +
        'anything. Batteries-included presets are one line; custom actions are your code.',
    playgroundHeading: '1 · Live playground',
    playgroundHint:
        'Edit on the left, see the published output fire real UI on the right. Select any word and use the ⚡ ' +
        'toolbar button to attach an action; hover or click the styled runs to trigger them.',
    editorLabel: 'Editor',
    publishedLabel: 'Published output',
    eventLogLabel: 'Event log',
    emptyLog: 'Hover or click an actioned word above to see events here.',
    presetsHeading: '2 · Batteries included',
    presetsHint:
        'hoverCardAction() and openDialogAction() render real floating UI with a couple of lines — no custom ' +
        'render code. The dialog can even host your own component (here, a pricing card) via the ACTION_PARAMS token.',
    customComponentBadge: 'custom component in dialog',
    cookbookHeading: '3 · Custom actions cookbook',
    cookbookHint:
        'You are never locked in — an action is just an id + your callback. Copy a recipe and adapt it. Both ' +
        'hover and click triggers are supported.',
    copyLabel: 'Copy',
    copiedLabel: 'Copied!',
    tiersHeading: '4 · Three ways to collect params',
    tiersHint:
        'How much control you want over the attach form. Precedence: resolveParams > formComponent > fields.',
    tier1Label: 'Declarative fields',
    tier1Desc: 'Describe fields (text, select, checkbox…) and the addon generates the attach form for you.',
    tier2Label: 'Custom form component',
    tier2Desc: 'Render your own Angular form inside the addon dialog — like the teammate picker in the playground.',
    tier3Label: 'External resolveParams',
    tier3Desc: 'Skip the addon dialog entirely and run your own picker or API call. Try attaching one below.',
    tier3EditorLabel: 'Editor (tier 3)',
    readonlyHeading: '5 · Read-only rendering',
    readonlyHint: 'Actions still fire on published, read-only content — the authoring toolbar is simply gone.',
    rtlHeading: 'Right-to-left',
    rtlHint: 'Actions and preset overlays work in RTL layouts too.',
    closeLabel: 'Close',
    v2Heading: '6 · Starter styling + combined action',
    v2Hint:
        'uiRteActionsStyle seeds the inline style a newly-attached action gets (here, a blue dotted underline), and ' +
        'linkedPreviewDialogAction() is a single "combined" definition — hover shows a preview card, click opens ' +
        'the full dialog, using one popover row in the attach UI instead of two.',
    v2StyleLabel: 'uiRteActionsStyle',
    v2CombinedLabel: 'linkedPreviewDialogAction()',
    v2CodeTitle: 'Starter style + combined preset',
};

const he: RichTextActionsDemoLocale = {
    code: 'he',
    rtl: true,
    heading: 'טקסט עשיר — פעולות אינטראקטיביות',
    description:
        'צירוף פעולות לחיצה וריחוף לטקסט או לתמונות. העורך פולט HTML אינרטי עם data-action-*; הנחיה בצד הרינדור, ' +
        'ללא תלות בפריימוורק, מפעילה את הקולבקים שלכם — פתיחת דיאלוג, הצגת כרטיס, מעקב לחיצה, כל דבר. הגדרות מוכנות ' +
        'מראש בשורה אחת; פעולות מותאמות הן הקוד שלכם.',
    playgroundHeading: '1 · מגרש משחקים חי',
    playgroundHint:
        'ערכו משמאל, וצפו בפלט המפורסם מפעיל ממשק אמיתי מימין. בחרו מילה והשתמשו בכפתור ⚡ כדי לצרף פעולה; ' +
        'רחפו או לחצו על הקטעים המסומנים כדי להפעיל אותם.',
    editorLabel: 'עורך',
    publishedLabel: 'פלט מפורסם',
    eventLogLabel: 'יומן אירועים',
    emptyLog: 'רחפו או לחצו על מילה עם פעולה למעלה כדי לראות אירועים כאן.',
    presetsHeading: '2 · כלול מראש',
    presetsHint:
        'hoverCardAction() ו-openDialogAction() מציגים ממשק צף אמיתי בכמה שורות — ללא קוד רינדור מותאם. הדיאלוג יכול ' +
        'אף לארח רכיב משלכם (כאן, כרטיס תמחור) דרך הטוקן ACTION_PARAMS.',
    customComponentBadge: 'רכיב מותאם בדיאלוג',
    cookbookHeading: '3 · מתכוני פעולות מותאמות',
    cookbookHint:
        'אתם אף פעם לא נעולים — פעולה היא רק מזהה + הקולבק שלכם. העתיקו מתכון והתאימו. נתמכים גם ריחוף וגם לחיצה.',
    copyLabel: 'העתק',
    copiedLabel: 'הועתק!',
    tiersHeading: '4 · שלוש דרכים לאסוף פרמטרים',
    tiersHint: 'כמה שליטה תרצו על טופס הצירוף. קדימות: resolveParams > formComponent > fields.',
    tier1Label: 'שדות מוצהרים',
    tier1Desc: 'תארו שדות (טקסט, בחירה, תיבת סימון…) והתוסף מייצר עבורכם את טופס הצירוף.',
    tier2Label: 'רכיב טופס מותאם',
    tier2Desc: 'הציגו טופס Angular משלכם בתוך הדיאלוג — כמו בורר חברי הצוות במגרש המשחקים.',
    tier3Label: 'resolveParams חיצוני',
    tier3Desc: 'דלגו על הדיאלוג לגמרי והריצו בורר או קריאת API משלכם. נסו לצרף אחד למטה.',
    tier3EditorLabel: 'עורך (שכבה 3)',
    readonlyHeading: '5 · רינדור לקריאה בלבד',
    readonlyHint: 'פעולות עדיין מופעלות בתוכן מפורסם לקריאה בלבד — סרגל העריכה פשוט נעלם.',
    rtlHeading: 'מימין לשמאל',
    rtlHint: 'פעולות ושכבות-על מוכנות עובדות גם בפריסות RTL.',
    closeLabel: 'סגור',
    v2Heading: '6 · עיצוב התחלתי ופעולה משולבת',
    v2Hint:
        'uiRteActionsStyle קובע את הסגנון המוטבע שבו תזכה פעולה חדשה שצורפה (כאן, קו תחתון כחול מנוקד), ו-' +
        'linkedPreviewDialogAction() היא הגדרה "משולבת" אחת — ריחוף מציג כרטיס תצוגה מקדימה, לחיצה פותחת את הדיאלוג ' +
        'המלא, בשורת פופאובר אחת בטופס הצירוף במקום שתיים.',
    v2StyleLabel: 'uiRteActionsStyle',
    v2CombinedLabel: 'linkedPreviewDialogAction()',
    v2CodeTitle: 'סגנון התחלתי + הגדרה משולבת',
};

export const RICH_TEXT_ACTIONS_DEMO_LOCALES: Record<string, RichTextActionsDemoLocale> = { en, he };
