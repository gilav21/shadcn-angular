import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TourComponent, type TourStep } from './tour.component';
import { readTourCompleted, writeTourCompleted } from './tour.utils';

/**
 * Feature specs for the additive tour API (`storageKey` persistence and
 * per-step `next` branching). `tour.component.spec.ts` is the untouched
 * backward-compatibility gate.
 */

class ResizeObserverStub {
    constructor(readonly callback: () => void) { }
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}

let addedScrollIntoView = false;

function installStubs(): void {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    const proto = Element.prototype as unknown as { scrollIntoView?: () => void };
    if (typeof proto.scrollIntoView !== 'function') {
        proto.scrollIntoView = () => undefined;
        addedScrollIntoView = true;
    }
}

function restoreStubs(): void {
    if (addedScrollIntoView) {
        delete (Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView;
        addedScrollIntoView = false;
    }
    vi.unstubAllGlobals();
}

const KEY = 'spec-onboarding';

@Component({
    selector: 'app-tour-features-host',
    imports: [TourComponent],
    template: `
        <div id="s0" style="position:fixed;top:10px;left:10px;width:50px;height:20px;">0</div>
        <div id="s1" style="position:fixed;top:40px;left:10px;width:50px;height:20px;">1</div>
        <div id="s2" style="position:fixed;top:70px;left:10px;width:50px;height:20px;">2</div>
        <div id="s3" style="position:fixed;top:100px;left:10px;width:50px;height:20px;">3</div>
        <ui-tour
            [steps]="steps()"
            [storageKey]="storageKey()"
            [(active)]="active"
            (done)="doneCount = doneCount + 1"
        />
    `,
})
class TourFeaturesHostComponent {
    readonly steps = signal<TourStep[]>([
        { target: '#s0', title: 'Zero' },
        { target: '#s1', title: 'One' },
        { target: '#s2', title: 'Two' },
        { target: '#s3', title: 'Three' },
    ]);
    readonly storageKey = signal<string | null>(null);
    readonly active = signal(false);
    doneCount = 0;
}

function getTour(fixture: ComponentFixture<unknown>): TourComponent {
    const el = fixture.debugElement.children.find(c => c.componentInstance instanceof TourComponent);
    return el!.componentInstance as TourComponent;
}

describe('tour.utils — storage helpers', () => {
    beforeEach(() => globalThis.localStorage?.clear());

    it('round-trips the completion flag', () => {
        expect(readTourCompleted(KEY)).toBe(false);
        writeTourCompleted(KEY, true);
        expect(readTourCompleted(KEY)).toBe(true);
        writeTourCompleted(KEY, false);
        expect(readTourCompleted(KEY)).toBe(false);
    });

    it('is a no-op for a null key', () => {
        writeTourCompleted(null, true);
        expect(readTourCompleted(null)).toBe(false);
    });

    it('degrades instead of throwing when localStorage is unavailable', () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get(): Storage { throw new Error('private mode'); },
        });
        try {
            expect(readTourCompleted(KEY)).toBe(false);
            expect(() => writeTourCompleted(KEY, true)).not.toThrow();
        } finally {
            if (original) Object.defineProperty(globalThis, 'localStorage', original);
        }
    });

    it('namespaces its key so it cannot collide with app storage', () => {
        writeTourCompleted(KEY, true);
        expect(globalThis.localStorage.getItem(KEY)).toBeNull();
        expect(globalThis.localStorage.getItem(`ui-tour:${KEY}`)).toBe('done');
    });
});

describe('TourComponent — storageKey persistence', () => {
    let fixture: ComponentFixture<TourFeaturesHostComponent>;
    let host: TourFeaturesHostComponent;

    beforeEach(async () => {
        installStubs();
        globalThis.localStorage?.clear();
        await TestBed.configureTestingModule({ imports: [TourFeaturesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TourFeaturesHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        globalThis.localStorage?.clear();
        TestBed.resetTestingModule();
        restoreStubs();
    });

    it('records completion when the tour finishes', () => {
        host.storageKey.set(KEY);
        fixture.detectChanges();
        host.active.set(true);
        fixture.detectChanges();

        getTour(fixture).goTo(3);
        getTour(fixture).next();
        fixture.detectChanges();

        expect(host.doneCount).toBe(1);
        expect(readTourCompleted(KEY)).toBe(true);
    });

    it('records completion when the tour is skipped', () => {
        host.storageKey.set(KEY);
        fixture.detectChanges();
        host.active.set(true);
        fixture.detectChanges();

        getTour(fixture).skip();
        fixture.detectChanges();

        expect(readTourCompleted(KEY)).toBe(true);
    });

    it('does not replay a completed tour for the same storageKey', () => {
        writeTourCompleted(KEY, true);
        host.storageKey.set(KEY);
        fixture.detectChanges();

        host.active.set(true);
        fixture.detectChanges();

        expect(host.active()).toBe(false);
        expect(host.doneCount).toBe(0);
        expect(fixture.nativeElement.querySelector('[data-slot="tour-card"]')).toBeNull();
    });

    it('still runs a tour whose key differs from the completed one', () => {
        writeTourCompleted(KEY, true);
        host.storageKey.set('onboarding-v2');
        fixture.detectChanges();

        host.active.set(true);
        fixture.detectChanges();

        expect(host.active()).toBe(true);
    });

    it('does NOT burn the flag when no step ever resolved', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        // Every anchor is missing — the app has not rendered them yet.
        host.steps.set([
            { target: '#not-rendered-1', title: 'One' },
            { target: '#not-rendered-2', title: 'Two' },
        ]);
        host.storageKey.set(KEY);
        fixture.detectChanges();

        host.active.set(true);
        fixture.detectChanges();

        expect(host.doneCount).toBe(1);
        expect(readTourCompleted(KEY)).toBe(false);
        warn.mockRestore();
    });

    it('DOES record completion when a live tour that showed a step has its steps emptied', () => {
        host.storageKey.set(KEY);
        fixture.detectChanges();
        host.active.set(true);
        fixture.detectChanges();
        expect(getTour(fixture).currentIndex()).toBe(0);

        // Emptied while still live — `reconcileStepsLength` takes the finish path.
        host.steps.set([]);
        fixture.detectChanges();

        expect(host.active()).toBe(false);
        expect(readTourCompleted(KEY)).toBe(true);
    });

    it('records completion again on a second run once a step did show', () => {
        host.storageKey.set(KEY);
        fixture.detectChanges();
        host.active.set(true);
        fixture.detectChanges();

        getTour(fixture).skip();
        fixture.detectChanges();

        expect(readTourCompleted(KEY)).toBe(true);
    });

    it('writes nothing when no storageKey is set', () => {
        host.active.set(true);
        fixture.detectChanges();
        getTour(fixture).skip();
        fixture.detectChanges();

        expect(globalThis.localStorage).toHaveLength(0);
    });

    it('resetCompletion() lets the tour run again', () => {
        writeTourCompleted(KEY, true);
        host.storageKey.set(KEY);
        fixture.detectChanges();

        const tour = getTour(fixture);
        expect(tour.isCompleted()).toBe(true);
        tour.resetCompletion();
        expect(tour.isCompleted()).toBe(false);

        host.active.set(true);
        fixture.detectChanges();
        expect(host.active()).toBe(true);
    });
});

describe('TourComponent — branching', () => {
    let fixture: ComponentFixture<TourFeaturesHostComponent>;
    let host: TourFeaturesHostComponent;

    beforeEach(async () => {
        installStubs();
        globalThis.localStorage?.clear();
        await TestBed.configureTestingModule({ imports: [TourFeaturesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TourFeaturesHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        globalThis.localStorage?.clear();
        TestBed.resetTestingModule();
        restoreStubs();
    });

    function start(steps: TourStep[]): TourComponent {
        host.steps.set(steps);
        fixture.detectChanges();
        host.active.set(true);
        fixture.detectChanges();
        return getTour(fixture);
    }

    it('routes to the branch target chosen by the predicate', () => {
        const pro = signal(true);
        const tour = start([
            { target: '#s0', title: 'Zero', next: () => (pro() ? 3 : 1) },
            { target: '#s1', title: 'One' },
            { target: '#s2', title: 'Two' },
            { target: '#s3', title: 'Three' },
        ]);

        tour.next();
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(3);
    });

    it('routes the other way when the predicate flips', () => {
        const tour = start([
            { target: '#s0', title: 'Zero', next: () => 2 },
            { target: '#s1', title: 'One' },
            { target: '#s2', title: 'Two' },
            { target: '#s3', title: 'Three' },
        ]);

        tour.next();
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(2);
    });

    it('ends the tour when the predicate returns null', () => {
        const tour = start([
            { target: '#s0', title: 'Zero', next: () => null },
            { target: '#s1', title: 'One' },
        ]);

        tour.next();
        fixture.detectChanges();

        expect(host.doneCount).toBe(1);
        expect(host.active()).toBe(false);
    });

    it('may branch backwards', () => {
        const tour = start([
            { target: '#s0', title: 'Zero' },
            { target: '#s1', title: 'One' },
            { target: '#s2', title: 'Two', next: () => 0 },
        ]);

        tour.goTo(2);
        fixture.detectChanges();
        tour.next();
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(0);
    });

    it('falls back to the default advance when the predicate throws', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const tour = start([
            { target: '#s0', title: 'Zero', next: () => { throw new Error('nope'); } },
            { target: '#s1', title: 'One' },
        ]);

        tour.next();
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(1);
        warn.mockRestore();
    });

    it('falls back to the default advance for an out-of-range target', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const tour = start([
            { target: '#s0', title: 'Zero', next: () => 99 },
            { target: '#s1', title: 'One' },
        ]);

        tour.next();
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(1);
        warn.mockRestore();
    });

    it('leaves steps without a predicate on the default path', () => {
        const tour = start([
            { target: '#s0', title: 'Zero' },
            { target: '#s1', title: 'One' },
        ]);

        tour.next();
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(1);
    });
});
