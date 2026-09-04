export interface RichTextEditorAddonsDemoLocale {
  heading: string;
  description: string;
  presetsLabel: string;
  presetCore: string;
  presetWriting: string;
  presetMedia: string;
  presetStyling: string;
  presetEverything: string;
  groupFormatting: string;
  groupInsert: string;
  groupOverlays: string;
  groupIntelligence: string;
  addonEmoji: string;
  addonColors: string;
  addonTypography: string;
  addonTables: string;
  addonLinks: string;
  addonImages: string;
  addonFileImport: string;
  addonHistory: string;
  addonOutline: string;
  addonAi: string;
  addonMentions: string;
  addonSlashCommands: string;
  addonActions: string;
  editorHeading: string;
  editorPlaceholder: string;
  aiHint: string;
  mentionsHint: string;
  actionsHint: string;
  slashHint: string;
  codePanelSummary: string;
  templateLabel: string;
  commandsLabel: string;
  commandsBaseNote: string;
  footprintLabel: string;
  footprintBaseWord: string;
  filesWord: string;
  addonFilesWord: string;
  addonsWord: string;
  allOffNote: string;
}

export const RICH_TEXT_EDITOR_ADDONS_DEMO_LOCALES: Record<string, RichTextEditorAddonsDemoLocale> = {
  en: {
    heading: 'Rich Text Editor — live addons',
    description:
      'One editor, thirteen opt-in addons. Toggle any of them and watch the feature appear or vanish on the same editor instance — the toolbar buttons, overlays, and listeners are added and torn down live. The code panel below always shows the exact template and install commands for your current selection.',
    presetsLabel: 'Preset kits',
    presetCore: 'Core (none)',
    presetWriting: 'Writing',
    presetMedia: 'Media',
    presetStyling: 'Styling',
    presetEverything: 'Everything',
    groupFormatting: 'Formatting',
    groupInsert: 'Insert',
    groupOverlays: 'Overlays',
    groupIntelligence: 'Intelligence',
    addonEmoji: 'Emoji',
    addonColors: 'Colours',
    addonTypography: 'Typography',
    addonTables: 'Tables',
    addonLinks: 'Links',
    addonImages: 'Images',
    addonFileImport: 'File import',
    addonHistory: 'History',
    addonOutline: 'Outline',
    addonAi: 'AI assist',
    addonMentions: 'Mentions & tags',
    addonSlashCommands: 'Slash commands',
    addonActions: 'Actions',
    editorHeading: 'The editor',
    editorPlaceholder: 'Toggle addons above, then type here. Try @ for mentions, / for commands…',
    aiHint: 'Select some text, then click the ✨ Ask AI chip. This demo wires a mock provider (no network).',
    mentionsHint: 'Type @ to mention a component or # to add a tag — both are canned demo lists.',
    actionsHint: 'Select text, then use the ⚡ Attach action toolbar button to attach the demo "Tooltip" action.',
    slashHint: 'Type / at the start of a line to open the command menu.',
    codePanelSummary: 'Template & install commands for this selection',
    templateLabel: 'Template',
    commandsLabel: 'Install commands',
    commandsBaseNote: '# one command installs the base editor and the selected addons:',
    footprintLabel: 'Footprint',
    footprintBaseWord: 'base',
    filesWord: 'files',
    addonFilesWord: 'addon files',
    addonsWord: 'addons',
    allOffNote: 'All addons are off — this is the base editor: bold, italic, lists, and markdown, nothing else.',
  },
  he: {
    heading: 'עורך טקסט עשיר — תוספים חיים',
    description:
      'עורך אחד, שלושה-עשר תוספים לבחירה. הפעל או כבה כל אחד מהם וצפה בתכונה מופיעה או נעלמת על אותו מופע עורך — כפתורי הסרגל, החלוניות וההאזנות נוספים ומפורקים בזמן אמת. פאנל הקוד למטה תמיד מציג את התבנית ופקודות ההתקנה המדויקות לבחירה הנוכחית.',
    presetsLabel: 'ערכות מוכנות',
    presetCore: 'בסיס (ללא)',
    presetWriting: 'כתיבה',
    presetMedia: 'מדיה',
    presetStyling: 'עיצוב',
    presetEverything: 'הכול',
    groupFormatting: 'עיצוב טקסט',
    groupInsert: 'הוספה',
    groupOverlays: 'חלוניות',
    groupIntelligence: 'בינה',
    addonEmoji: 'אמוג\'י',
    addonColors: 'צבעים',
    addonTypography: 'טיפוגרפיה',
    addonTables: 'טבלאות',
    addonLinks: 'קישורים',
    addonImages: 'תמונות',
    addonFileImport: 'ייבוא קבצים',
    addonHistory: 'היסטוריה',
    addonOutline: 'תוכן עניינים',
    addonAi: 'עוזר בינה',
    addonMentions: 'אזכורים ותגיות',
    addonSlashCommands: 'פקודות לוכסן',
    addonActions: 'פעולות',
    editorHeading: 'העורך',
    editorPlaceholder: 'הפעל תוספים למעלה, ואז הקלד כאן. נסה @ לאזכור, / לפקודות…',
    aiHint: 'בחר טקסט ולחץ על שבב ✨ שאל בינה. הדגמה זו מחווטת לספק מדומה (ללא רשת).',
    mentionsHint: 'הקלד @ כדי לאזכר רכיב או # כדי להוסיף תגית — שתי הרשימות הן דוגמאות מוכנות.',
    actionsHint: 'בחר טקסט ואז השתמש בכפתור ⚡ צרף פעולה כדי לצרף את פעולת ה"טולטיפ" לדוגמה.',
    slashHint: 'הקלד / בתחילת שורה כדי לפתוח את תפריט הפקודות.',
    codePanelSummary: 'תבנית ופקודות התקנה לבחירה זו',
    templateLabel: 'תבנית',
    commandsLabel: 'פקודות התקנה',
    commandsBaseNote: '# פקודה אחת מתקינה את העורך הבסיסי ואת התוספים שנבחרו:',
    footprintLabel: 'טביעת רגל',
    footprintBaseWord: 'בסיס',
    filesWord: 'קבצים',
    addonFilesWord: 'קבצי תוסף',
    addonsWord: 'תוספים',
    allOffNote: 'כל התוספים כבויים — זהו העורך הבסיסי: מודגש, נטוי, רשימות ו-markdown, שום דבר נוסף.',
  },
};
