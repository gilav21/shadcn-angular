import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TableComponent, TableHeaderComponent, TableRowComponent, TableHeadComponent } from './index';

/** Real-browser check: header alignment is computed style, which jsdom does not resolve. */
@Component({
  template: `
    <div [dir]="dir()">
      <ui-table>
        <ui-table-header>
          <ui-table-row>
            <ui-table-head>Invoice</ui-table-head>
          </ui-table-row>
        </ui-table-header>
      </ui-table>
    </div>
  `,
  imports: [TableComponent, TableHeaderComponent, TableRowComponent, TableHeadComponent],
})
class AlignHost {
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('Table head alignment (browser)', () => {
  it.each([
    { dir: 'ltr', align: 'left' },
    { dir: 'rtl', align: 'right' },
  ] as const)('aligns header text to the $align under dir="$dir"', ({ dir, align }) => {
    TestBed.configureTestingModule({ imports: [AlignHost] });
    const fixture = TestBed.createComponent(AlignHost);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();

    const head = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="table-head"]');
    expect(getComputedStyle(head!).textAlign).toBe(align);
  });
});
