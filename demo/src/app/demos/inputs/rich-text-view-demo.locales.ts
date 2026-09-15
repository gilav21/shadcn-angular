import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface RichTextViewDemoLocale extends LocaleMeta {
    heading: string;
    description: string;
    authorHeading: string;
    authorDescription: string;
    editorLabel: string;
    viewLabel: string;
    modeHtml: string;
    modeMarkdown: string;
    publishHeading: string;
    publishDescription: string;
    publishedPost: string;
    dialogTitle: string;
    dialogBody: string;
    closeLabel: string;
    sizesHeading: string;
    sizesDescription: string;
    snippetsHeading: string;
    snippetsDescription: string;
    policyHeading: string;
    policyDescription: string;
    policyNoneLabel: string;
    policySetLabel: string;
    policyNote: string;
}

export const RICH_TEXT_VIEW_DEMO_LOCALES: Record<string, RichTextViewDemoLocale> = {
    en: {
        code: 'en',
        heading: 'Rich Text View',
        description:
            'A read-only renderer for what the editor produced. Same sanitizer, same markdown parser, same typography — no editor on the page.',
        authorHeading: 'Author here, render there',
        authorDescription:
            'One model string, bound to an editor and a view at once. Type on the left and the published rendering follows.',
        editorLabel: 'Editor',
        viewLabel: 'View',
        modeHtml: 'HTML',
        modeMarkdown: 'Markdown',
        publishHeading: 'Published content with actions',
        publishDescription:
            'No editor anywhere on this page. The view is the delegation container, and [uiRichTextActions] keeps the data-action-* attributes alive through sanitization.',
        publishedPost:
            '<h2>Pricing</h2><p>Our plans start at $9 a month. <span data-action-click="open-pricing" data-action-click-params=\'{"plan":"pro"}\' style="color: rgb(37, 99, 235); text-decoration: underline;">See the Pro plan</span> for team features.</p>',
        dialogTitle: 'Action fired',
        dialogBody: 'The view delivered a click action with no editor on the page.',
        closeLabel: 'Close',
        sizesHeading: 'Sizes and direction',
        sizesDescription: 'The editor\'s size presets, plus dir for right-to-left content.',
        snippetsHeading: 'Copy-paste',
        snippetsDescription: 'The three things you will actually type.',
        policyHeading: 'Remote images and tracking',
        policyDescription:
            'A remote image is a request every reader\u2019s browser makes on render, so a host named in a document learns who opened it. A policy on the editor governs what an author can insert \u2014 it is not stored in the document, so set it here too.',
        policyNoneLabel: 'No policy \u2014 loads any host',
        policySetLabel: 'Only cdn.trusted.com',
        policyNote:
            'The blocked image keeps its alt and its place, and retains the original URL, so allowing the host later restores it.',
    },
    he: {
        code: 'he',
        rtl: true,
        heading: 'תצוגת טקסט עשיר',
        description:
            'מציג לקריאה בלבד של מה שהעורך הפיק. אותו מנקה, אותו מפענח Markdown, אותה טיפוגרפיה — בלי עורך בעמוד.',
        authorHeading: 'כותבים כאן, מציגים שם',
        authorDescription:
            'מחרוזת אחת, קשורה בו-זמנית לעורך ולתצוגה. הקלידו משמאל והתצוגה מתעדכנת.',
        editorLabel: 'עורך',
        viewLabel: 'תצוגה',
        modeHtml: 'HTML',
        modeMarkdown: 'Markdown',
        publishHeading: 'תוכן מפורסם עם פעולות',
        publishDescription:
            'אין עורך בעמוד הזה. התצוגה היא מכל האירועים, ו-[uiRichTextActions] שומר על מאפייני data-action-* לאורך הניקוי.',
        publishedPost:
            '<h2>תמחור</h2><p>התוכניות מתחילות ב-9$ לחודש. <span data-action-click="open-pricing" data-action-click-params=\'{"plan":"pro"}\' style="color: rgb(37, 99, 235); text-decoration: underline;">ראו את תוכנית Pro</span> לתכונות צוות.</p>',
        dialogTitle: 'הפעולה הופעלה',
        dialogBody: 'התצוגה מסרה פעולת לחיצה בלי עורך בעמוד.',
        closeLabel: 'סגירה',
        sizesHeading: 'גדלים וכיוון',
        sizesDescription: 'הגדלים של העורך, בתוספת dir לתוכן מימין לשמאל.',
        snippetsHeading: 'העתק-הדבק',
        snippetsDescription: 'שלושת הדברים שבאמת תכתבו.',
        policyHeading: '\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05E8\u05D5\u05D7\u05E7\u05D5\u05EA \u05D5\u05DE\u05E2\u05E7\u05D1',
        policyDescription:
            '\u05EA\u05DE\u05D5\u05E0\u05D4 \u05DE\u05E8\u05D5\u05D7\u05E7\u05EA \u05D4\u05D9\u05D0 \u05D1\u05E7\u05E9\u05D4 \u05E9\u05D4\u05D3\u05E4\u05D3\u05E4\u05DF \u05E9\u05DC \u05DB\u05DC \u05E7\u05D5\u05E8\u05D0 \u05E9\u05D5\u05DC\u05D7 \u05D1\u05E2\u05EA \u05D4\u05E6\u05D2\u05D4. \u05DE\u05D3\u05D9\u05E0\u05D9\u05D5\u05EA \u05E9\u05E0\u05E7\u05D1\u05E2\u05D4 \u05D1\u05E2\u05D5\u05E8\u05DA \u05D0\u05D9\u05E0\u05D4 \u05E0\u05E9\u05DE\u05E8\u05EA \u05D1\u05DE\u05E1\u05DE\u05DA \u2014 \u05D9\u05E9 \u05DC\u05D4\u05D2\u05D3\u05D9\u05E8 \u05D0\u05D5\u05EA\u05D4 \u05D2\u05DD \u05DB\u05D0\u05DF.',
        policyNoneLabel: '\u05DC\u05DC\u05D0 \u05DE\u05D3\u05D9\u05E0\u05D9\u05D5\u05EA',
        policySetLabel: '\u05E8\u05E7 cdn.trusted.com',
        policyNote:
            '\u05D4\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D4\u05D7\u05E1\u05D5\u05DE\u05D4 \u05E9\u05D5\u05DE\u05E8\u05EA \u05E2\u05DC \u05DE\u05E7\u05D5\u05DE\u05D4 \u05D5\u05E2\u05DC \u05D4\u05DB\u05EA\u05D5\u05D1\u05EA \u05D4\u05DE\u05E7\u05D5\u05E8\u05D9\u05EA, \u05DB\u05DA \u05E9\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05DE\u05D0\u05E8\u05D7 \u05DE\u05D0\u05D5\u05D7\u05E8 \u05D9\u05E9\u05D7\u05D6\u05E8 \u05D0\u05D5\u05EA\u05D4.',
    },
};
