import { beforeEach, describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { parseNlFilterSpec } from './data-table.utils';
import { DataTableComponent } from './data-table.component';
import { ColumnDef } from './data-table.types';
import type { AiRequest } from '../../lib/ai';

const KEYS = ['status', 'amount', 'clientName'];

describe('parseNlFilterSpec (table AI)', () => {
  it('parses globalFilter and known columnFilters', () => {
    const raw = JSON.stringify({ globalFilter: 'acme', columnFilters: { status: ['success'], amount: '>500' } });
    expect(parseNlFilterSpec(raw, KEYS)).toEqual({
      globalFilter: 'acme',
      columnFilters: { status: ['success'], amount: '>500' },
    });
  });

  it('drops columnFilters for unknown columns', () => {
    const raw = JSON.stringify({ columnFilters: { status: ['failed'], bogus: 'x' } });
    expect(parseNlFilterSpec(raw, KEYS)).toEqual({ columnFilters: { status: ['failed'] } });
  });

  it('omits columnFilters entirely when none are valid', () => {
    const raw = JSON.stringify({ columnFilters: { bogus: 'x' } });
    expect(parseNlFilterSpec(raw, KEYS)).toEqual({});
  });

  it('ignores a non-string globalFilter', () => {
    const raw = JSON.stringify({ globalFilter: 42 });
    expect(parseNlFilterSpec(raw, KEYS)).toEqual({});
  });

  it('returns an empty spec for invalid JSON or non-objects', () => {
    expect(parseNlFilterSpec('not json', KEYS)).toEqual({});
    expect(parseNlFilterSpec('"a string"', KEYS)).toEqual({});
    expect(parseNlFilterSpec('null', KEYS)).toEqual({});
  });
});

interface AiRow {
  id: string;
  name: string;
  status: string;
  note: string;
}

describe('DataTableComponent AI (table-side)', () => {
  let component: DataTableComponent<AiRow>;
  let fixture: ComponentFixture<DataTableComponent<AiRow>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(DataTableComponent<AiRow>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', [
      { id: '1', name: 'Alice', status: 'active', note: '' },
      { id: '2', name: 'Bob', status: 'inactive', note: '' },
    ]);
    fixture.componentRef.setInput('columns', [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'note', header: 'Note', valueSetter: (r: AiRow, v: unknown) => ({ ...r, note: v as string }) },
    ] as ColumnDef<AiRow>[]);
    fixture.detectChanges();
  });

  it('compiles a NL query into filter models and emits nlFilter', async () => {
    fixture.componentRef.setInput('aiProvider', () =>
      JSON.stringify({ globalFilter: 'ali', columnFilters: { status: 'active' } }),
    );
    let emitted: unknown = null;
    component.nlFilter.subscribe((e) => (emitted = e));
    await component.applyNaturalLanguageFilter('show active alice');
    expect(component.globalFilter()).toBe('ali');
    expect(component.columnFilters()).toEqual({ status: 'active' });
    expect(emitted).toMatchObject({ query: 'show active alice' });
  });

  it('no-ops NL filtering without a provider', async () => {
    await component.applyNaturalLanguageFilter('anything');
    expect(component.globalFilter()).toBe('');
  });

  it('AI-fills a column via valueSetter for each filtered row', async () => {
    fixture.componentRef.setInput('aiProvider', (req: AiRequest) => `note for ${JSON.parse(req.input).name}`);
    let done: unknown = null;
    component.aiFillComplete.subscribe((e) => (done = e));
    await component.aiFillColumn('note', 'write a note');
    expect(component.data().map((r) => r.note)).toEqual(['note for Alice', 'note for Bob']);
    expect(done).toEqual({ columnKey: 'note', count: 2 });
  });

  it('no-ops AI-fill for a column without a valueSetter', async () => {
    fixture.componentRef.setInput('aiProvider', () => 'x');
    await component.aiFillColumn('name', 'p');
    expect(component.data().map((r) => r.name)).toEqual(['Alice', 'Bob']);
  });

  it('runs the toolbar NL-filter query through the provider', async () => {
    fixture.componentRef.setInput('aiProvider', () => JSON.stringify({ globalFilter: 'bob' }));
    component.aiFilterQuery.set('show bob');
    await component.runAiFilter();
    expect(component.globalFilter()).toBe('bob');
    expect(component.aiFilterRunning()).toBe(false);
  });

  it('shows the NL-filter input only with a provider + visible toolbar', () => {
    fixture.componentRef.setInput('showToolbar', true);
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('[data-slot="table-nl-filter"]'))).toHaveLength(0);
    fixture.componentRef.setInput('aiProvider', () => '{}');
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('[data-slot="table-nl-filter"]'))).toHaveLength(1);
  });
});
