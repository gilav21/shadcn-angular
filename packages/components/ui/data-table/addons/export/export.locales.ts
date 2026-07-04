import type { LocaleMeta } from '../../../../lib/i18n';

/** Localized strings for the data-table export addon. */
export interface DataTableExportLocale extends LocaleMeta {
  /** Busy-overlay label shown while an export is in progress. */
  exporting: string;
}

const en: DataTableExportLocale = { code: 'en', exporting: 'Exporting…' };
const he: DataTableExportLocale = { code: 'he', rtl: true, exporting: 'מייצא…' };

/** Built-in locale registry for the data-table export addon. */
export const DATA_TABLE_EXPORT_LOCALES: Record<string, DataTableExportLocale> = { en, he };
