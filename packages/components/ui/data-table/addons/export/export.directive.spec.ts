import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';

// jest's jsdom lacks the object-URL APIs the export-download path spies on —
// polyfill only when absent so vi.spyOn has a method to replace (both runners).
const urlApi = URL as unknown as {
  createObjectURL?: (blob: unknown) => string;
  revokeObjectURL?: (url: string) => void;
};
urlApi.createObjectURL ??= () => 'blob:mock';
urlApi.revokeObjectURL ??= () => undefined;
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DataTableExportDirective, type ExportDataProvider } from './export.directive';
import {
  DataTableAddonHost,
  AddonSlotRegistry,
  type CellActionSlot,
  type HeaderActionSlot,
  type ColumnPin,
  type ColumnDef,
  type DataTableExportOptions,
  type DataTableExportQuery,
  type DataTableLocale,
  type RowActionContext,
  type SortDirection,
} from '../..';

interface Row {
  id: string;
  name: string;
  score: number;
}

/** Minimal in-memory host exposing just the export seam the directive uses. */
class FakeHost<T> extends DataTableAddonHost<T> {
  private readonly cell = new AddonSlotRegistry<CellActionSlot<T>>();
  private readonly header = new AddonSlotRegistry<HeaderActionSlot<T>>();
  columns: ColumnDef<T>[] = [];
  rows: T[] = [];
  query: DataTableExportQuery = {
    globalFilter: '',
    columnFilters: {},
    sort: { column: '', direction: null },
    sortStates: [],
  };
  readonly busyCalls: (string | null)[] = [];
  private _busy: string | null = null;

  getExportData(_options?: DataTableExportOptions, rows?: readonly T[]): string[][] {
    const src = rows ?? this.rows;
    const header = this.columns.map((c) => c.header);
    const body = src.map((r) =>
      this.columns.map((c) => String((r as Record<string, unknown>)[String(c.accessorKey)] ?? '')),
    );
    return [header, ...body];
  }
  getSortedRows(): readonly T[] {
    return this.rows;
  }
  getRawRows(): readonly T[] {
    return this.rows;
  }
  getCellValue(row: T, key: string | keyof T): unknown {
    return (row as Record<string, unknown>)[String(key)];
  }
  queryState(): DataTableExportQuery {
    return this.query;
  }
  setBusy(label: string | null): void {
    this._busy = label;
    this.busyCalls.push(label);
  }
  busyLabel(): string | null {
    return this._busy;
  }

  enhancedColumns(): readonly ColumnDef<T>[] {
    return this.columns;
  }
  getRenderedRowAt(index: number): T | undefined {
    return this.rows[index];
  }
  getRowContext(row: T, index: number): RowActionContext<T> {
    return { row, index, selected: false };
  }
  getSortDirection(): SortDirection {
    return null;
  }
  onSortChange(): void {}
  pinColumn(): void {}
  getColumnPin(): ColumnPin {
    return undefined;
  }
  setColumnVisibility(): void {}
  showAllColumns(): void {}
  getLocale(): DataTableLocale {
    return {} as DataTableLocale;
  }
  registerCellAction(slot: CellActionSlot<T>): () => void {
    return this.cell.register(slot);
  }
  registerHeaderAction(slot: HeaderActionSlot<T>): () => void {
    return this.header.register(slot);
  }
  cellActionSlots(): readonly CellActionSlot<T>[] {
    return this.cell.slots();
  }
  headerActionSlots(): readonly HeaderActionSlot<T>[] {
    return this.header.slots();
  }
}

const COLUMNS: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'score', header: 'Score' },
];

@Component({
  selector: 'ui-test-export-host',
  standalone: true,
  imports: [DataTableExportDirective],
  template: `<div uiDtExport [exportDataProvider]="provider()"></div>`,
})
class TestHostComponent {
  readonly provider = signal<ExportDataProvider<Row> | undefined>(undefined);
}

function setup(host: FakeHost<Row>): {
  fixture: ComponentFixture<TestHostComponent>;
  comp: TestHostComponent;
  directive: DataTableExportDirective<Row>;
} {
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: [{ provide: DataTableAddonHost, useValue: host }],
  });
  const fixture = TestBed.createComponent(TestHostComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const directive = fixture.debugElement
    .query(By.directive(DataTableExportDirective))
    .injector.get<DataTableExportDirective<Row>>(DataTableExportDirective);
  return { fixture, comp, directive };
}

interface Download {
  name: string;
  blob: Blob;
}

/** Stubs the browser download and records each file the user would receive. */
function stubDownload(): Download[] {
  const downloads: Download[] = [];
  let pending: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    pending = blob as Blob;
    return 'blob:fake';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordDownload(this: HTMLAnchorElement) {
    if (pending) downloads.push({ name: this.download, blob: pending });
  });
  return downloads;
}

/** jsdom's Blob has no text()/arrayBuffer(), so read through FileReader (works in both). */
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('blob read failed'));
    reader.readAsArrayBuffer(blob);
  });
}

async function blobText(blob: Blob): Promise<string> {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await readBlob(blob));
}

describe('DataTableExportDirective', () => {
  let host: FakeHost<Row>;

  beforeEach(() => {
    host = new FakeHost<Row>();
    host.columns = COLUMNS;
    host.rows = [{ id: '1', name: 'Alice', score: 30 }];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exportToCsv downloads a BOM-prefixed CSV that quotes commas, quotes and newlines', async () => {
    host.rows = [
      { id: '1', name: 'Smith, John', score: 1 },
      { id: '2', name: 'She said "hi"', score: 2 },
      { id: '3', name: '12 Main St\nSpringfield', score: 3 },
      { id: '4', name: 'Plain', score: 4 },
    ];
    const { directive } = setup(host);
    const downloads = stubDownload();

    await directive.exportToCsv('myfile');

    expect(downloads.map((d) => d.name)).toEqual(['myfile.csv']);
    expect(downloads[0].blob.type).toBe('text/csv;charset=utf-8;');
    expect(await blobText(downloads[0].blob)).toBe(
      '\uFEFFID,Name,Score\r\n1,"Smith, John",1\r\n2,"She said ""hi""",2\r\n3,"12 Main St\nSpringfield",3\r\n4,Plain,4',
    );
    expect(host.busyLabel()).toBeNull();
    vi.restoreAllMocks();
  });

  it('shows the localized busy label during export, then clears it', async () => {
    const { directive } = setup(host);
    stubDownload();
    await directive.exportToCsv();
    expect(host.busyCalls).toEqual(['Exporting…', null]);
    vi.restoreAllMocks();
  });

  it('exports the exportDataProvider rows instead of the table rows', async () => {
    const providerRows: Row[] = [{ id: '99', name: 'Provided', score: 0 }];
    const provider = vi.fn<ExportDataProvider<Row>>(async () => providerRows);
    const { comp, fixture } = setup(host);
    comp.provider.set(provider);
    fixture.detectChanges();
    const directive = fixture.debugElement
      .query(By.directive(DataTableExportDirective))
      .injector.get<DataTableExportDirective<Row>>(DataTableExportDirective);
    const downloads = stubDownload();

    await directive.exportToCsv();
    expect(provider).toHaveBeenCalledWith(host.query);
    const csv = await blobText(downloads[0].blob);
    expect(csv).toBe('\uFEFFID,Name,Score\r\n99,Provided,0');
    expect(csv).not.toContain('Alice');
    vi.restoreAllMocks();
  });

  it('forwards the host query state to a server-side provider on Excel export', async () => {
    host.query = {
      globalFilter: 'Alice',
      columnFilters: { name: 'Bob' },
      sort: { column: 'score', direction: 'desc' },
      sortStates: [],
    };
    const provider = vi.fn<ExportDataProvider<Row>>(async () => []);
    const { comp, fixture } = setup(host);
    comp.provider.set(provider);
    fixture.detectChanges();
    const directive = fixture.debugElement
      .query(By.directive(DataTableExportDirective))
      .injector.get<DataTableExportDirective<Row>>(DataTableExportDirective);
    stubDownload();

    await directive.exportToExcel('server-all');

    expect(provider).toHaveBeenCalledTimes(1);
    const query = provider.mock.calls[0][0];
    expect(query.globalFilter).toBe('Alice');
    expect(query.columnFilters).toEqual({ name: 'Bob' });
    expect(query.sort).toEqual({ column: 'score', direction: 'desc' });
    vi.restoreAllMocks();
  });

  it('exportToExcel downloads an .xlsx zip package and clears busy', async () => {
    const { directive } = setup(host);
    const downloads = stubDownload();

    await directive.exportToExcel('sheet');

    expect(downloads.map((d) => d.name)).toEqual(['sheet.xlsx']);
    expect(downloads[0].blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const bytes = new Uint8Array(await readBlob(downloads[0].blob));
    expect(String.fromCodePoint(bytes[0], bytes[1])).toBe('PK');
    expect(host.busyLabel()).toBeNull();
    vi.restoreAllMocks();
  });
});
