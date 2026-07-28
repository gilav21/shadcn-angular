export interface PdfReadableCompareDemoLocale {
  title: string;
  description: string;
  pickFile: string;
  readableHeading: string;
  referenceHeading: string;
  empty: string;
  error: string;
}

export const PDF_READABLE_COMPARE_DEMO_LOCALES: Record<string, PdfReadableCompareDemoLocale> = {
  en: {
    title: 'PDF → Readable HTML (side by side)',
    description:
      'Validation harness for the pdf-readable pipeline: the left pane shows clean flowing semantic HTML (what the rich text editor imports), the right pane shows the pixel-perfect reference render of the same PDF.',
    pickFile: 'Choose a PDF',
    readableHeading: 'Readable HTML (flowing, editable)',
    referenceHeading: 'Pixel-perfect reference',
    empty: 'Pick a PDF file to compare both renderings.',
    error: 'Could not parse this PDF: ',
  },
  he: {
    title: 'PDF ל־HTML קריא (השוואה)',
    description:
      'סביבת אימות לצינור pdf-readable: משמאל HTML סמנטי זורם (מה שעורך הטקסט מייבא), מימין רינדור הייחוס המדויק של אותו PDF.',
    pickFile: 'בחרו קובץ PDF',
    readableHeading: 'HTML קריא (זורם, ניתן לעריכה)',
    referenceHeading: 'ייחוס מדויק-פיקסלים',
    empty: 'בחרו קובץ PDF כדי להשוות בין שני הרינדורים.',
    error: 'לא ניתן לנתח את קובץ ה-PDF: ',
  },
};
