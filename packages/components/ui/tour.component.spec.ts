import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { TourComponent, TourStep } from './tour.component';

if (typeof globalThis.window !== 'undefined' && typeof globalThis.window.matchMedia === 'undefined') {
    Object.defineProperty(globalThis.window, 'matchMedia', {
        writable: true,
        value: (_query: string) => ({
            matches: false,
            media: _query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    });
}

@Component({
    selector: 'app-test-host',
    imports: [TourComponent],
    template: `
        <div id="step1" style="position:fixed;top:100px;left:100px;width:200px;height:50px;">Step 1 Target</div>
        <div id="step2" style="position:fixed;top:300px;left:100px;width:200px;height:50px;">Step 2 Target</div>
        <ui-tour [steps]="steps" [(active)]="active" (done)="onDone()" (stepChange)="onStepChange($event)" />
    `,
})
class TestHostComponent {
    readonly steps: TourStep[] = [
        { target: '#step1', title: 'Step 1', description: 'First step description' },
        { target: '#step2', title: 'Step 2', description: 'Second step description' },
    ];
    readonly active = signal(false);
    doneCount = 0;
    lastStepChange = -1;

    onDone(): void {
        this.doneCount++;
    }

    onStepChange(index: number): void {
        this.lastStepChange = index;
    }
}

@Component({
    selector: 'app-test-host-single',
    imports: [TourComponent],
    template: `
        <div id="solo" style="position:fixed;top:100px;left:100px;width:200px;height:50px;">Solo Target</div>
        <ui-tour [steps]="steps" [(active)]="active" (done)="onDone()" />
    `,
})
class TestHostSingleComponent {
    readonly steps: TourStep[] = [
        { target: '#solo', title: 'Only Step', description: 'Only one step' },
    ];
    readonly active = signal(false);
    doneCount = 0;

    onDone(): void {
        this.doneCount++;
    }
}

describe('TourComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should not render spotlight or card when inactive', () => {
        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        const spotlight = fixture.nativeElement.querySelector('[data-slot="tour-spotlight"]');
        expect(card).toBeNull();
        expect(spotlight).toBeNull();
    });

    it('should render spotlight and card when active', () => {
        host.active.set(true);
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        const spotlight = fixture.nativeElement.querySelector('[data-slot="tour-spotlight"]');
        expect(card).not.toBeNull();
        expect(spotlight).not.toBeNull();
    });

    it('should show step title and description', () => {
        host.active.set(true);
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('Step 1');
        expect(card.textContent).toContain('First step description');
    });

    it('should show step counter', () => {
        host.active.set(true);
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('1 / 2');
    });

    it('should emit stepChange(0) when tour starts', () => {
        host.active.set(true);
        fixture.detectChanges();

        expect(host.lastStepChange).toBe(0);
    });

    it('should advance to index 1 on next()', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        tour.next();

        expect(tour.currentIndex()).toBe(1);
        expect(host.lastStepChange).toBe(1);
    });

    it('should go back to previous step on previous()', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        tour.next();
        fixture.detectChanges();
        tour.previous();
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('Step 1');
        expect(host.lastStepChange).toBe(0);
    });

    it('should emit done and set active=false on skip()', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        tour.skip();
        fixture.detectChanges();

        expect(host.active()).toBe(false);
        expect(host.doneCount).toBe(1);
    });

    it('should NOT emit done when parent externally sets active=false', () => {
        host.active.set(true);
        fixture.detectChanges();

        host.active.set(false);
        fixture.detectChanges();

        expect(host.doneCount).toBe(0);
    });

    it('should reset to step 0 when re-activating', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        tour.next();
        fixture.detectChanges();

        host.active.set(false);
        fixture.detectChanges();

        host.active.set(true);
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(0);
    });

    it('should handle Escape key to cancel tour', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        tour.onKeydown(event);
        fixture.detectChanges();

        expect(host.active()).toBe(false);
        expect(host.doneCount).toBe(1);
    });

    it('should handle ArrowRight key to advance', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
        tour.onKeydown(event);

        expect(tour.currentIndex()).toBe(1);
    });

    it('should handle ArrowLeft key to go back', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        tour.next();
        fixture.detectChanges();

        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
        tour.onKeydown(event);
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(0);
    });

    it('should not go before step 0 on previous() at first step', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        tour.previous();
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(0);
    });
});

describe('TourComponent — single step', () => {
    let fixture: ComponentFixture<TestHostSingleComponent>;
    let host: TestHostSingleComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostSingleComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostSingleComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should show Done button on last step', () => {
        host.active.set(true);
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('Done');
    });

    it('should emit done and set active=false when next() called on last step', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
        const tour = tourEl!.componentInstance as TourComponent;
        tour.next();
        fixture.detectChanges();

        expect(host.active()).toBe(false);
        expect(host.doneCount).toBe(1);
    });

    it('should not show Skip button on last step by default', () => {
        host.active.set(true);
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).not.toContain('Skip');
    });
});
