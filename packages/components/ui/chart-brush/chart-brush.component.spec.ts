import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChartBrushComponent } from './chart-brush.component';

describe('ChartBrushComponent', () => {
    let component: ChartBrushComponent;
    let fixture: ComponentFixture<ChartBrushComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChartBrushComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ChartBrushComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('width', 400);
        fixture.componentRef.setInput('height', 40);
        fixture.detectChanges();
    });

    it('normalizes a right-to-left drag so start < end', () => {
        let emitted: { start: number; end: number } | null = null;
        component.selectionChange.subscribe(s => (emitted = s));
        component.beginCreate(60);
        component.pointerMoveTo(10);
        component.end();
        expect(emitted).toEqual({ start: 10, end: 60 });
    });

    it('clamps the selection to the brush width', () => {
        let emitted: { start: number; end: number } | null = null;
        component.selectionChange.subscribe(s => (emitted = s));
        component.beginCreate(10);
        component.pointerMoveTo(999);
        component.end();
        expect(emitted).toEqual({ start: 10, end: 400 });
    });

    it('renders a visible reset control when a selection exists and clears it on click', () => {
        fixture.componentRef.setInput('selection', { start: 100, end: 200 });
        fixture.detectChanges();
        let emitted: { start: number; end: number } | null | undefined;
        component.selectionChange.subscribe(s => (emitted = s));
        const btn: HTMLElement | null = fixture.nativeElement.querySelector('[data-slot="chart-brush-reset"]');
        expect(btn).toBeTruthy();
        btn!.click();
        expect(emitted).toBeNull();
        expect(component.current()).toBeNull();
    });

    it('hides the reset control when there is no selection', () => {
        fixture.componentRef.setInput('selection', null);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-slot="chart-brush-reset"]')).toBeNull();
    });

    it('seeds the dragged edge immediately on resize begin', () => {
        fixture.componentRef.setInput('selection', { start: 100, end: 200 });
        fixture.detectChanges();
        component.beginResize('start', 120);
        expect(component.current()).toEqual({ start: 120, end: 200 });
    });
});
