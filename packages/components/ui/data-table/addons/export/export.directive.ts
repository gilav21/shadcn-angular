import { Directive, inject, input } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DataTableAddonHost, type DataTableExportQuery } from '../..';
import { generateXlsx } from '../../../../lib/parsers/xlsx';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { DATA_TABLE_EXPORT_LOCALES, type DataTableExportLocale } from './export.locales';

/**
 * Server-side export hook. Receives the current {@link DataTableExportQuery}
 * (global filter, column filters, sort) so it can fetch ALL matching rows —
 * filtered and sorted across every page. A no-arg provider stays valid (the
 * query is simply ignored).
 */
export type ExportDataProvider<T> = (query: DataTableExportQuery) => Promise<T[]>;

/**
 * Opt-in CSV/Excel export addon for `<ui-data-table>`. Attaches via DI to the
 * `DataTableAddonHost` the base provides, reads the current rows/columns and
 * query through the host, and downloads the file itself — the base ships no
 * export code and no `xlsx` dependency. Grab a template reference
 * (`#exp="uiDtExport"`) and call `exp.exportToCsv()` / `exp.exportToExcel()`.
 */
@Directive({
  selector: '[uiDtExport]',
  standalone: true,
  exportAs: 'uiDtExport',
})
export class DataTableExportDirective<T = unknown> {
  private readonly host = inject<DataTableAddonHost<T>>(DataTableAddonHost);
  private readonly document = inject(DOCUMENT);

  /** Server-side export hook: given the current query, returns all matching rows. */
  readonly exportDataProvider = input<ExportDataProvider<T> | undefined>(undefined);
  /** Locale for the busy label: a registry key (`'en'`/`'he'`) or a full dictionary. */
  readonly uiDtExportLocale = input<LocaleInput<DataTableExportLocale>>();

  private readonly i18n = createLocaleBindings(this.uiDtExportLocale, DATA_TABLE_EXPORT_LOCALES);

  /** Export the current (or provided) rows to a downloaded CSV file. */
  async exportToCsv(filename?: string, customData?: T[]): Promise<void> {
    this.host.setBusy(this.i18n.t().exporting);
    try {
      const rows = await this.resolveRows(customData);
      const data = this.host.getExportData(undefined, rows);
      const csvContent = data
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\r\n');
      const blob = new Blob(['﻿' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      this.downloadBlob(blob, (filename || 'export') + '.csv');
    } finally {
      this.host.setBusy(null);
    }
  }

  /** Export the current (or provided) rows to a downloaded XLSX file. */
  async exportToExcel(filename?: string, customData?: T[]): Promise<void> {
    this.host.setBusy(this.i18n.t().exporting);
    try {
      const rows = await this.resolveRows(customData);
      const data = this.host.getExportData(undefined, rows);
      const xlsxBytes = generateXlsx(data, { boldFirstRow: true });
      const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      this.downloadBlob(blob, (filename || 'export') + '.xlsx');
    } finally {
      this.host.setBusy(null);
    }
  }

  private async resolveRows(customData?: T[]): Promise<readonly T[]> {
    if (customData) return customData;
    const provider = this.exportDataProvider();
    // Server-side: hand the provider the current filter/sort so it can fetch
    // ALL matching rows (every page), not just the loaded page.
    if (provider) return provider(this.host.queryState());
    // Client-side: export what the user sees — filtered AND sorted, all rows.
    return this.host.getSortedRows();
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    this.document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

/** Quote a CSV cell when it contains a delimiter, quote, or newline. */
function escapeCsvCell(cell: string): string {
  if (
    cell.includes(',') ||
    cell.includes('"') ||
    cell.includes('\n') ||
    cell.includes('\r')
  ) {
    return '"' + cell.replaceAll('"', '""') + '"';
  }
  return cell;
}
