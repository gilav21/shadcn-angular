import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { BentoGridComponent, BentoGridItemComponent, DashboardItem } from './bento-grid.component';

@Component({
    template: `
        <ui-bento-grid
            [items]="items()"
            [cols]="cols()"
            [rowHeight]="rowHeight()"
            [gap]="gap()"
            [showBorders]="showBorders()"
            [editable]="editable()"
        />
    `,
    imports: [BentoGridComponent]
})
class BentoGridTestHostComponent {
    items = signal<DashboardItem[]>([
        { id: '1', x: 1, y: 1, cols: 2, rows: 1, content: 'Item 1' },
        { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: 'Item 2' },
        { id: '3', x: 1, y: 2, cols: 1, rows: 1, content: 'Item 3' },
    ]);
    cols = signal(4);
    rowHeight = signal('120px');
    gap = signal('1rem');
    showBorders = signal(true);
    editable = signal(false);
}

describe('BentoGridComponent', () => {
    let fixture: ComponentFixture<BentoGridTestHostComponent>;
    let component: BentoGridTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BentoGridTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BentoGridTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        const grid = fixture.debugElement.query(By.directive(BentoGridComponent));
        expect(grid).toBeTruthy();
    });

    it('should render a grid element', () => {
        const gridEl = fixture.debugElement.query(By.css('.grid'));
        expect(gridEl).toBeTruthy();
    });

    it('should render items as bento-item elements', () => {
        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items.length).toBe(3);
    });

    it('should display string content in items', () => {
        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items[0].nativeElement.textContent).toContain('Item 1');
        expect(items[1].nativeElement.textContent).toContain('Item 2');
    });

    it('should apply border class when showBorders is true', () => {
        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items[0].nativeElement.classList.contains('border')).toBe(true);
    });

    it('should not apply border class when showBorders and editable are both false', async () => {
        component.showBorders.set(false);
        component.editable.set(false);
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items[0].nativeElement.classList.contains('border')).toBe(false);
    });

    it('should set grid-auto-rows style from rowHeight input', () => {
        const gridEl = fixture.debugElement.query(By.css('.grid'));
        expect(gridEl.nativeElement.style.gridAutoRows).toBe('120px');
    });

    it('should set gap style from gap input', () => {
        const gridEl = fixture.debugElement.query(By.css('.grid'));
        expect(gridEl.nativeElement.style.gap).toBe('1rem');
    });

    it('should update items when input changes', async () => {
        component.items.set([
            { id: 'a', x: 1, y: 1, cols: 1, rows: 1, content: 'New Item' },
        ]);
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items.length).toBe(1);
        expect(items[0].nativeElement.textContent).toContain('New Item');
    });
});

describe('BentoGridItemComponent', () => {
    let fixture: ComponentFixture<BentoGridItemComponent>;
    let component: BentoGridItemComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BentoGridItemComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BentoGridItemComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have default span of 1', () => {
        expect(component.span()).toBe(1);
    });

    it('should have default rowSpan of 1', () => {
        expect(component.rowSpan()).toBe(1);
    });

    it('should apply grid-column span style', () => {
        fixture.componentRef.setInput('span', 2);
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.style.gridColumn).toBe('span 2');
    });

    it('should apply grid-row span style', () => {
        fixture.componentRef.setInput('rowSpan', 3);
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.style.gridRow).toBe('span 3');
    });

    it('should apply base styling classes', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('rounded-xl');
        expect(div.nativeElement.className).toContain('border');
    });
});
