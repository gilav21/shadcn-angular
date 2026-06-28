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

    it('renders an svg overlay', () => {
        expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();
    });

    it('creates a normalized selection from a left-to-right drag', () => {
        let emitted: { start: number; end: number } | null = null;
        component.selectionChange.subscribe(s => (emitted = s));
        component.beginCreate(10);
        component.pointerMoveTo(60);
        component.end();
        expect(emitted).toEqual({ start: 10, end: 60 });
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

    it('pans an existing selection while preserving its width', () => {
        fixture.componentRef.setInput('selection', { start: 100, end: 200 });
        fixture.detectChanges();
        let emitted: { start: number; end: number } | null = null;
        component.selectionChange.subscribe(s => (emitted = s));
        component.beginMove(150);
        component.pointerMoveTo(170);
        component.end();
        expect(emitted).toEqual({ start: 120, end: 220 });
    });

    it('resizes only the end edge when an end handle is dragged', () => {
        fixture.componentRef.setInput('selection', { start: 100, end: 200 });
        fixture.detectChanges();
        let emitted: { start: number; end: number } | null = null;
        component.selectionChange.subscribe(s => (emitted = s));
        component.beginResize('end', 200);
        component.pointerMoveTo(250);
        component.end();
        expect(emitted).toEqual({ start: 100, end: 250 });
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

    it('reset clears the selection and emits null', () => {
        fixture.componentRef.setInput('selection', { start: 100, end: 200 });
        fixture.detectChanges();
        let emitted: { start: number; end: number } | null | undefined;
        component.selectionChange.subscribe(s => (emitted = s));
        component.reset();
        expect(emitted).toBeNull();
        expect(component.current()).toBeNull();
    });

    it('reflects an external selection input in current()', () => {
        fixture.componentRef.setInput('selection', { start: 50, end: 150 });
        fixture.detectChanges();
        expect(component.current()).toEqual({ start: 50, end: 150 });
    });
});
