import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TourComponent, TourStep, TourEndReason, TourSkippedEvent } from './tour.component';

interface MutableRect {
    top: number;
    left: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
    x: number;
    y: number;
    toJSON(): void;
}

function makeRect(top: number, left: number, width: number, height: number): DOMRect {
    const rect: MutableRect = {
        top,
        left,
        width,
        height,
        bottom: top + height,
        right: left + width,
        x: left,
        y: top,
        toJSON: () => undefined,
    };
    return rect as unknown as DOMRect;
}

const DEFAULT_TARGET_RECT = makeRect(100, 100, 200, 50);
const CARD_OFFSET_WIDTH = 300;
const CARD_OFFSET_HEIGHT = 150;

class ResizeObserverStub {
    constructor(readonly callback: () => void) { }
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}

interface StubbableElementProto {
    scrollIntoView?: (arg?: unknown) => void;
}

let rectSpy: ReturnType<typeof vi.spyOn>;
let addedScrollIntoView = false;
const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;
let savedInnerWidth: PropertyDescriptor | undefined;
let savedInnerHeight: PropertyDescriptor | undefined;

function installBrowserStubs(): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    }));
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);

    const proto = Element.prototype as unknown as StubbableElementProto;
    if (typeof proto.scrollIntoView !== 'function') {
        proto.scrollIntoView = () => undefined;
        addedScrollIntoView = true;
    }

    rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DEFAULT_TARGET_RECT);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(CARD_OFFSET_WIDTH);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(CARD_OFFSET_HEIGHT);

    // window.innerWidth/Height are plain data properties (not accessors) under
    // jsdom, so spyOn(..., 'get') throws — override the descriptor directly.
    savedInnerWidth = Object.getOwnPropertyDescriptor(globalThis.window, 'innerWidth');
    savedInnerHeight = Object.getOwnPropertyDescriptor(globalThis.window, 'innerHeight');
    Object.defineProperty(globalThis.window, 'innerWidth', { value: VIEWPORT_WIDTH, configurable: true });
    Object.defineProperty(globalThis.window, 'innerHeight', { value: VIEWPORT_HEIGHT, configurable: true });
}

function restoreBrowserStubs(): void {
    if (addedScrollIntoView) {
        delete (Element.prototype as unknown as StubbableElementProto).scrollIntoView;
        addedScrollIntoView = false;
    }
    if (savedInnerWidth) Object.defineProperty(globalThis.window, 'innerWidth', savedInnerWidth);
    if (savedInnerHeight) Object.defineProperty(globalThis.window, 'innerHeight', savedInnerHeight);
    vi.unstubAllGlobals();
}

beforeEach(() => {
    installBrowserStubs();
});

afterEach(() => {
    // Angular only destroys fixtures when the *next* test resets the module, so
    // the file's last test would otherwise hand a live tour to whichever file
    // this worker picks up next — window listeners, a pending target poll and
    // its timer included. Destroy them here instead. (Hygiene, not a flake fix:
    // measured over several full runs it did not move the failure rate.)
    TestBed.resetTestingModule();
    restoreBrowserStubs();
});

async function flush(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
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

function getTour(fixture: ComponentFixture<unknown>): TourComponent {
    const tourEl = fixture.debugElement.children.find(el => el.componentInstance instanceof TourComponent);
    return tourEl!.componentInstance as TourComponent;
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

    it('should render spotlight and card when active and ready', async () => {
        host.active.set(true);
        await flush(fixture);

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        const spotlight = fixture.nativeElement.querySelector('[data-slot="tour-spotlight"]');
        expect(card).not.toBeNull();
        expect(spotlight).not.toBeNull();
    });

    it('should expose isReady as false before activation', () => {
        const tour = getTour(fixture);
        expect(tour.isReady()).toBe(false);
    });

    it('should become ready after async readiness pass', async () => {
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);
        expect(tour.isReady()).toBe(true);
    });

    it('should show step title and description', async () => {
        host.active.set(true);
        await flush(fixture);

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('Step 1');
        expect(card.textContent).toContain('First step description');
    });

    it('should show step counter', async () => {
        host.active.set(true);
        await flush(fixture);

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

        const tour = getTour(fixture);
        tour.next();

        expect(tour.currentIndex()).toBe(1);
        expect(host.lastStepChange).toBe(1);
    });

    it('should go back to previous step on previous()', async () => {
        host.active.set(true);
        await flush(fixture);

        const tour = getTour(fixture);
        tour.next();
        await flush(fixture);
        tour.previous();
        await flush(fixture);

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('Step 1');
        expect(host.lastStepChange).toBe(0);
    });

    it('should emit done and set active=false on skip()', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tour = getTour(fixture);
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

    it('should reset to step 0 when re-activating', async () => {
        host.active.set(true);
        await flush(fixture);

        const tour = getTour(fixture);
        tour.next();
        await flush(fixture);

        host.active.set(false);
        fixture.detectChanges();

        host.active.set(true);
        await flush(fixture);

        expect(tour.currentIndex()).toBe(0);
    });

    it('should handle Escape key to cancel tour', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tour = getTour(fixture);
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        tour.onKeydown(event);
        fixture.detectChanges();

        expect(host.active()).toBe(false);
        expect(host.doneCount).toBe(1);
    });

    it('should handle ArrowRight key to advance', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tour = getTour(fixture);
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
        tour.onKeydown(event);

        expect(tour.currentIndex()).toBe(1);
    });

    it('should handle Enter key to advance', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tour = getTour(fixture);
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        tour.onKeydown(event);

        expect(tour.currentIndex()).toBe(1);
    });

    it('should ignore unrelated keys', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tour = getTour(fixture);
        const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
        tour.onKeydown(event);

        expect(tour.currentIndex()).toBe(0);
        expect(event.defaultPrevented).toBe(false);
    });

    it('should handle ArrowLeft key to go back', async () => {
        host.active.set(true);
        await flush(fixture);

        const tour = getTour(fixture);
        tour.next();
        await flush(fixture);

        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
        tour.onKeydown(event);
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(0);
    });

    it('should not go before step 0 on previous() at first step', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tour = getTour(fixture);
        tour.previous();
        fixture.detectChanges();

        expect(tour.currentIndex()).toBe(0);
    });

    it('should highlight target while active (data attribute + outline)', async () => {
        host.active.set(true);
        await flush(fixture);

        const target = document.getElementById('step1');
        expect(target?.hasAttribute('data-ui-tour-highlight')).toBe(true);
        expect(target?.style.outline).toContain('2px');
    });

    it('should re-read the target rect on scroll and resize reposition', async () => {
        host.active.set(true);
        await flush(fixture);

        rectSpy.mockReturnValue(makeRect(250, 150, 200, 50));
        globalThis.window.dispatchEvent(new Event('scroll'));
        globalThis.window.dispatchEvent(new Event('resize'));
        await flush(fixture);

        const tour = getTour(fixture);
        expect(tour.isReady()).toBe(true);
    });

    it('should move highlight from previous target when advancing', async () => {
        host.active.set(true);
        await flush(fixture);

        const tour = getTour(fixture);
        tour.next();
        await flush(fixture);

        const previousTarget = document.getElementById('step1');
        const currentTarget = document.getElementById('step2');
        expect(previousTarget?.hasAttribute('data-ui-tour-highlight')).toBe(false);
        expect(currentTarget?.hasAttribute('data-ui-tour-highlight')).toBe(true);
    });

    it('should save and restore original inline styles on teardown', async () => {
        const target = document.getElementById('step1');
        target!.style.outline = '1px dotted red';
        target!.style.borderRadius = '99px';
        const savedOutline = target!.style.outline;
        const savedRadius = target!.style.borderRadius;

        host.active.set(true);
        await flush(fixture);

        expect(target?.style.outline).toContain('2px');
        expect(target?.style.borderRadius).toBe('6px');

        host.active.set(false);
        fixture.detectChanges();

        expect(target?.style.outline).toBe(savedOutline);
        expect(target?.style.borderRadius).toBe(savedRadius);
    });

    it('should remove highlight on teardown', async () => {
        host.active.set(true);
        await flush(fixture);

        host.active.set(false);
        fixture.detectChanges();

        const target = document.getElementById('step1');
        expect(target?.hasAttribute('data-ui-tour-highlight')).toBe(false);
        expect(target?.style.outline).toBe('');
    });

    it('should clean up highlight when the component is destroyed', async () => {
        host.active.set(true);
        await flush(fixture);

        fixture.destroy();

        const target = document.getElementById('step1');
        expect(target?.hasAttribute('data-ui-tour-highlight')).toBe(false);
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

    it('should show Done button on last step', async () => {
        host.active.set(true);
        await flush(fixture);

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('Done');
    });

    it('should emit done and set active=false when next() called on last step', () => {
        host.active.set(true);
        fixture.detectChanges();

        const tour = getTour(fixture);
        tour.next();
        fixture.detectChanges();

        expect(host.active()).toBe(false);
        expect(host.doneCount).toBe(1);
    });

    it('should not show Skip button on last step by default', async () => {
        host.active.set(true);
        await flush(fixture);

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).not.toContain('Skip');
    });
});

@Component({
    selector: 'app-pos-host',
    imports: [TourComponent],
    template: `
        <div id="pt">Positioning Target</div>
        <ui-tour [steps]="steps()" [(active)]="active" />
    `,
})
class PositioningHostComponent {
    readonly steps = signal<TourStep[]>([{ target: '#pt', title: 'Pos' }]);
    readonly active = signal(false);
}

describe('TourComponent — positioning', () => {
    let fixture: ComponentFixture<PositioningHostComponent>;
    let host: PositioningHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PositioningHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PositioningHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    async function activateWithRect(rect: DOMRect): Promise<TourComponent> {
        // Stub the rect on the target element itself rather than through the
        // file-level `Element.prototype` spy. The prototype spy is shared state:
        // when it is not in effect the component measures the live element
        // instead (a 414x24 box — 414 is the default viewport width), which
        // silently turns these into assertions about real layout. That is the
        // whole failure — with the spy bypassed these tests produce exactly the
        // `36` and `57` seen in full-suite runs. An own property shadows the
        // prototype, so this holds whether or not the spy is installed, and it
        // dies with the fixture rather than leaking to another file.
        const target = document.querySelector('#pt') as HTMLElement;
        Object.defineProperty(target, 'getBoundingClientRect', {
            configurable: true,
            value: () => rect,
        });
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);
        // The card measures itself once rendered, and `flush` above is a fixed
        // number of detectChanges/whenStable rounds — enough on an idle machine,
        // but under a loaded full-suite run the measurement lands later and the
        // assertions below read the pre-measurement position.
        //
        // Waiting on `cardPos` cannot detect that: with the target rect still at
        // its {0,0,0,0} default, `computeCardPos` already returns a clamped
        // {top: 12, left: 8}, so a `top + left > 0` predicate passes before
        // anything has been measured. `isReady` is the real signal — `goToStep`
        // clears it and it is set only after the target rect and card size have
        // both been read.
        await vi.waitFor(() => {
            fixture.detectChanges();
            expect(tour.isReady()).toBe(true);
        });
        return tour;
    }

    it('places the card below a top-anchored target (default rect)', async () => {
        const tour = await activateWithRect(makeRect(100, 100, 200, 50));
        expect(tour.cardPos().top).toBeGreaterThan(150);
    });

    it('places the card above a bottom-anchored target', async () => {
        const tour = await activateWithRect(makeRect(600, 400, 100, 100));
        expect(tour.cardPos().top).toBeLessThan(600);
    });

    it('places the card to the right when there is horizontal room only', async () => {
        const target = makeRect(100, 100, 100, 600);
        const tour = await activateWithRect(target);
        expect(tour.cardPos().left).toBeGreaterThan(target.right);
    });

    it('places the card to the left when only left room remains', async () => {
        const target = makeRect(100, 800, 100, 600);
        const tour = await activateWithRect(target);
        expect(tour.cardPos().left).toBeLessThan(target.left);
    });

    it('clamps into the viewport when the target fills the screen', async () => {
        const tour = await activateWithRect(makeRect(0, 0, 1024, 768));
        const pos = tour.cardPos();
        expect(pos.top).toBeGreaterThanOrEqual(8);
        expect(pos.top).toBeLessThanOrEqual(768 - CARD_OFFSET_HEIGHT - 8);
    });

    it('honours an explicit side override on the step', async () => {
        host.steps.set([{ target: '#pt', title: 'Pos', side: 'bottom' }]);
        fixture.detectChanges();
        const target = makeRect(100, 100, 200, 50);
        const tour = await activateWithRect(target);
        expect(tour.cardPos().top).toBeGreaterThan(target.bottom - CARD_OFFSET_HEIGHT);
    });

    it('applies position:relative to a statically-positioned target', async () => {
        await activateWithRect(makeRect(100, 100, 200, 50));
        const target = document.getElementById('pt');
        expect(target?.style.position).toBe('relative');
    });
});

@Component({
    selector: 'app-test-host-skipahead',
    imports: [TourComponent],
    template: `
        <div id="present" style="position:fixed;top:100px;left:100px;width:200px;height:50px;">Present</div>
        <ui-tour [steps]="steps" [(active)]="active" (stepChange)="onStepChange($event)" />
    `,
})
class TestHostSkipAheadComponent {
    readonly steps: TourStep[] = [
        { target: '#absent', title: 'Missing First' },
        { target: '#present', title: 'Present Second' },
    ];
    readonly active = signal(false);
    lastStepChange = -1;

    onStepChange(index: number): void {
        this.lastStepChange = index;
    }
}

describe('TourComponent — skip missing target', () => {
    it('warns and advances to the next resolvable step', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        await TestBed.configureTestingModule({
            imports: [TestHostSkipAheadComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(TestHostSkipAheadComponent);
        const host = fixture.componentInstance;
        fixture.detectChanges();

        host.active.set(true);
        await flush(fixture);

        const tour = getTour(fixture);
        expect(tour.currentIndex()).toBe(1);
        expect(host.lastStepChange).toBe(1);
        expect(host.active()).toBe(true);
        expect(warnSpy).toHaveBeenCalled();
    });
});

@Component({
    selector: 'app-test-host-missing',
    imports: [TourComponent],
    template: `
        <ui-tour [steps]="steps" [(active)]="active" (done)="onDone()" />
    `,
})
class TestHostMissingTargetComponent {
    readonly steps: TourStep[] = [
        { target: '#never-exists', title: 'Ghost Step', description: 'No target' },
    ];
    readonly active = signal(false);
    doneCount = 0;

    onDone(): void {
        this.doneCount++;
    }
}

describe('TourComponent — missing target', () => {
    let fixture: ComponentFixture<TestHostMissingTargetComponent>;
    let host: TestHostMissingTargetComponent;

    beforeEach(async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await TestBed.configureTestingModule({
            imports: [TestHostMissingTargetComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostMissingTargetComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should finish immediately when no valid step exists', () => {
        host.active.set(true);
        fixture.detectChanges();

        expect(host.active()).toBe(false);
        expect(host.doneCount).toBe(1);
    });
});

@Component({
    selector: 'app-test-host-gap',
    imports: [TourComponent],
    template: `
        <div id="gap-first" style="position:fixed;top:100px;left:100px;width:200px;height:50px;">First</div>
        @if (showMiddle()) {
            <div id="gap-middle" style="position:fixed;top:200px;left:100px;width:200px;height:50px;">Middle</div>
        }
        <div id="gap-last" style="position:fixed;top:300px;left:100px;width:200px;height:50px;">Last</div>
        <ui-tour
            [steps]="steps"
            [(active)]="active"
            (done)="lastDone = $event"
            (stepSkipped)="skipped.push($event)"
        />
    `,
})
class TestHostGapComponent {
    readonly steps: TourStep[] = [
        { target: '#gap-first', title: 'First' },
        { target: '#gap-middle', title: 'Middle' },
        { target: '#gap-last', title: 'Last' },
    ];
    readonly showMiddle = signal(false);
    readonly active = signal(false);
    readonly skipped: TourSkippedEvent[] = [];
    lastDone: TourEndReason | null = null;
}

describe('TourComponent — skipping a missing step backwards', () => {
    let fixture: ComponentFixture<TestHostGapComponent>;
    let host: TestHostGapComponent;

    beforeEach(async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await TestBed.configureTestingModule({ imports: [TestHostGapComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostGapComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('reaches an earlier resolvable step instead of bouncing forward', async () => {
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);

        tour.next();
        await flush(fixture);
        expect(tour.currentIndex()).toBe(2);

        tour.previous();
        await flush(fixture);

        expect(tour.currentIndex()).toBe(0);
        expect(host.active()).toBe(true);
        expect(host.skipped).toContainEqual({ index: 1, reason: 'missing-target' });
    });

    it('does not end the tour when a backwards move finds nothing earlier', async () => {
        host.steps.splice(0, 1);
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);
        expect(tour.currentIndex()).toBe(1);

        tour.previous();
        await flush(fixture);

        expect(host.active()).toBe(true);
        expect(host.lastDone).toBeNull();
        expect(tour.currentIndex()).toBe(1);
    });

    it('hides the Back button once every earlier step is known unreachable', async () => {
        host.steps.splice(0, 1);
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);
        expect(tour.currentIndex()).toBe(1);

        expect(tour.canGoBack()).toBe(false);
        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).not.toContain('Previous');
    });

    it('leaves Back available when an earlier step is still reachable', async () => {
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);
        tour.next();
        await flush(fixture);

        expect(tour.currentIndex()).toBe(2);
        expect(tour.canGoBack()).toBe(true);
        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('Previous');
    });

    it('drops skipped steps from the counter instead of promising unreachable ones', async () => {
        host.steps.splice(0, 1);
        host.active.set(true);
        await flush(fixture);

        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('1 / 1');
        expect(card.textContent).not.toContain('2 / 2');
    });

    it('shows Done rather than Next when no later step is reachable', async () => {
        host.steps.splice(0, 1);
        host.active.set(true);
        await flush(fixture);

        const tour = getTour(fixture);
        expect(tour.isLastStep()).toBe(true);
        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.textContent).toContain('Done');
    });

    it('shrinks the counter only once a step has actually been tried', async () => {
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);

        // Nothing tried past step 0 yet, so all three are still on offer.
        expect(tour.reachableCount()).toBe(3);
        expect(tour.reachablePosition()).toBe(1);

        tour.next();
        await flush(fixture);

        // Step 1 turned out to be missing — it stops counting.
        expect(tour.currentIndex()).toBe(2);
        expect(tour.reachableCount()).toBe(2);
        expect(tour.reachablePosition()).toBe(2);
    });

    it('re-tests skipped steps on a fresh run', async () => {
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);
        tour.next();
        await flush(fixture);
        expect(tour.reachableCount()).toBe(2);

        host.active.set(false);
        fixture.detectChanges();
        host.showMiddle.set(true);
        host.active.set(true);
        await flush(fixture);

        expect(tour.reachableCount()).toBe(3);
        tour.next();
        await flush(fixture);
        expect(tour.currentIndex()).toBe(1);
    });

    it('reports the end reason on done', async () => {
        host.showMiddle.set(true);
        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);

        tour.skip();
        await flush(fixture);
        expect(host.lastDone).toBe('skipped');

        host.lastDone = null;
        host.active.set(true);
        await flush(fixture);
        tour.goTo(2);
        await flush(fixture);
        tour.next();
        await flush(fixture);
        expect(host.lastDone).toBe('finished');
    });
});

@Component({
    selector: 'app-test-host-hidden',
    imports: [TourComponent],
    template: `
        <div id="hidden-target" style="display:none;">Hidden</div>
        <div id="visible-target" style="position:fixed;top:100px;left:100px;width:200px;height:50px;">Visible</div>
        <ui-tour [steps]="steps" [(active)]="active" (stepSkipped)="skipped.push($event)" />
    `,
})
class TestHostHiddenComponent {
    readonly steps: TourStep[] = [
        { target: '#hidden-target', title: 'Hidden' },
        { target: '#visible-target', title: 'Visible' },
    ];
    readonly active = signal(false);
    readonly skipped: TourSkippedEvent[] = [];
}

describe('TourComponent — unrendered target', () => {
    it('skips a target that exists but is display:none', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await TestBed.configureTestingModule({ imports: [TestHostHiddenComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostHiddenComponent);
        const host = fixture.componentInstance;
        fixture.detectChanges();

        host.active.set(true);
        await flush(fixture);

        expect(getTour(fixture).currentIndex()).toBe(1);
        expect(host.skipped).toContainEqual({ index: 0, reason: 'missing-target' });
    });
});

@Component({
    selector: 'app-test-host-hooks',
    imports: [TourComponent],
    template: `
        <div id="hook-first" style="position:fixed;top:100px;left:100px;width:200px;height:50px;">First</div>
        @if (panelOpen()) {
            <div id="hook-panel" style="position:fixed;top:200px;left:100px;width:200px;height:50px;">Panel</div>
        }
        <ui-tour
            [steps]="steps"
            [(active)]="active"
            [targetTimeout]="1000"
            (stepSkipped)="skipped.push($event)"
        />
    `,
})
class TestHostHooksComponent {
    readonly panelOpen = signal(false);
    readonly active = signal(false);
    readonly skipped: TourSkippedEvent[] = [];
    readonly log: string[] = [];
    includePanel = true;
    holdHook = false;
    hookError: Error | null = null;
    private release: (() => void) | null = null;

    releaseHook(): void {
        this.release?.();
        this.release = null;
    }

    readonly steps: TourStep[] = [
        {
            target: '#hook-first',
            title: 'First',
            afterDeactivate: ctx => {
                this.log.push(`after:0:${ctx.direction}`);
            },
        },
        {
            target: '#hook-panel',
            title: 'Panel',
            when: () => this.includePanel,
            beforeActivate: async ctx => {
                this.log.push(`before:1:${ctx.direction}`);
                if (this.hookError) throw this.hookError;
                if (this.holdHook) await new Promise<void>(resolve => { this.release = resolve; });
                await Promise.resolve();
                this.panelOpen.set(true);
            },
            afterDeactivate: ctx => {
                this.log.push(`after:1:${ctx.direction}`);
                this.panelOpen.set(false);
            },
        },
    ];
}

describe('TourComponent — async step hooks', () => {
    let fixture: ComponentFixture<TestHostHooksComponent>;
    let host: TestHostHooksComponent;

    beforeEach(async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await TestBed.configureTestingModule({ imports: [TestHostHooksComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostHooksComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    /**
     * A tour with hooks resolves its steps asynchronously, so settling is not a
     * fixed number of change-detection rounds — wait for the tour to stop
     * being pending instead.
     */
    async function settle(tour: TourComponent): Promise<void> {
        await vi.waitFor(() => {
            fixture.detectChanges();
            expect(tour.isPending()).toBe(false);
        });
        await flush(fixture);
    }

    async function activate(): Promise<TourComponent> {
        host.active.set(true);
        fixture.detectChanges();
        const tour = getTour(fixture);
        await settle(tour);
        return tour;
    }

    async function advance(tour: TourComponent): Promise<void> {
        tour.next();
        await settle(tour);
    }

    it('awaits beforeActivate and waits for the element it renders', async () => {
        const tour = await activate();
        expect(tour.currentIndex()).toBe(0);

        await advance(tour);

        expect(tour.currentIndex()).toBe(1);
        expect(host.panelOpen()).toBe(true);
        expect(document.getElementById('hook-panel')?.hasAttribute('data-ui-tour-highlight')).toBe(true);
    });

    it('runs afterDeactivate before the next step activates, with the travel direction', async () => {
        const tour = await activate();

        await advance(tour);

        expect(host.log).toEqual(['after:0:forward', 'before:1:forward']);
    });

    it('marks itself pending while the hook runs', async () => {
        const tour = await activate();

        tour.next();
        expect(tour.isPending()).toBe(true);
        fixture.detectChanges();
        const card = fixture.nativeElement.querySelector('[data-slot="tour-card"]');
        expect(card.hasAttribute('data-pending')).toBe(true);

        // The viewport stays dimmed by a full-screen scrim, so the page does
        // not flash undimmed while the hook navigates.
        expect(fixture.nativeElement.querySelector('[data-slot="tour-scrim"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-slot="tour-spotlight"]')).toBeNull();

        await vi.waitFor(() => {
            fixture.detectChanges();
            expect(tour.isPending()).toBe(false);
        });
    });

    it('skips a step whose when() is falsy', async () => {
        host.includePanel = false;
        const tour = await activate();

        tour.next();
        await settle(tour);

        expect(host.skipped).toContainEqual({ index: 1, reason: 'condition' });
        expect(host.active()).toBe(false);
    });

    it('skips a step whose beforeActivate rejects instead of wedging the tour', async () => {
        host.hookError = new Error('boom');
        const tour = await activate();

        tour.next();
        await vi.waitFor(() => {
            fixture.detectChanges();
            expect(host.skipped.length).toBeGreaterThan(0);
        });

        expect(host.skipped).toContainEqual({ index: 1, reason: 'hook-error' });
        expect(host.active()).toBe(false);
    });

    it('discards a hook that resolves after the tour was closed', async () => {
        const tour = await activate();
        host.holdHook = true;

        tour.next();
        await vi.waitFor(() => {
            expect(host.log).toContain('before:1:forward');
        });
        tour.skip();
        host.releaseHook();

        await vi.waitFor(() => {
            fixture.detectChanges();
            expect(host.panelOpen()).toBe(true);
        });
        await flush(fixture);

        expect(host.active()).toBe(false);
        expect(tour.currentIndex()).toBe(0);
        expect(document.getElementById('hook-panel')?.hasAttribute('data-ui-tour-highlight')).toBe(false);
    });

    it('aborts a queued step before its hook runs when the tour closes', async () => {
        const tour = await activate();

        tour.next();
        tour.skip();
        await flush(fixture);

        expect(host.active()).toBe(false);
        expect(host.log).not.toContain('before:1:forward');
    });
});

@Component({
    selector: 'app-test-host-shrink',
    imports: [TourComponent],
    template: `
        <div id="shrink-a" style="position:fixed;top:100px;left:100px;width:200px;height:50px;">A</div>
        <div id="shrink-b" style="position:fixed;top:200px;left:100px;width:200px;height:50px;">B</div>
        <ui-tour [steps]="steps()" [(active)]="active" (done)="lastDone = $event" />
    `,
})
class TestHostShrinkComponent {
    readonly steps = signal<TourStep[]>([
        { target: '#shrink-a', title: 'A' },
        { target: '#shrink-b', title: 'B' },
    ]);
    readonly active = signal(false);
    lastDone: TourEndReason | null = null;
}

describe('TourComponent — steps changing mid-tour', () => {
    it('falls back to the last step when steps shrink past the current index', async () => {
        await TestBed.configureTestingModule({ imports: [TestHostShrinkComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostShrinkComponent);
        const host = fixture.componentInstance;
        fixture.detectChanges();

        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);
        tour.next();
        await flush(fixture);
        expect(tour.currentIndex()).toBe(1);

        host.steps.set([{ target: '#shrink-a', title: 'A' }]);
        await flush(fixture);

        expect(tour.currentIndex()).toBe(0);
        expect(host.active()).toBe(true);
    });

    it('ends the tour when steps empty out mid-tour', async () => {
        await TestBed.configureTestingModule({ imports: [TestHostShrinkComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostShrinkComponent);
        const host = fixture.componentInstance;
        fixture.detectChanges();

        host.active.set(true);
        await flush(fixture);

        host.steps.set([]);
        await flush(fixture);

        expect(host.active()).toBe(false);
        expect(host.lastDone).toBe('finished');
    });
});

describe('TourComponent — target lost mid-step', () => {
    it('advances when the highlighted element is removed from the DOM', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await TestBed.configureTestingModule({ imports: [TestHostShrinkComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostShrinkComponent);
        const host = fixture.componentInstance;
        fixture.detectChanges();

        host.active.set(true);
        await flush(fixture);
        const tour = getTour(fixture);
        expect(tour.currentIndex()).toBe(0);

        document.getElementById('shrink-a')?.remove();
        globalThis.window.dispatchEvent(new Event('scroll'));
        await flush(fixture);

        expect(tour.currentIndex()).toBe(1);
        expect(host.active()).toBe(true);
    });
});

describe('TourComponent — i18n integration', () => {
    @Component({
        selector: 'app-tour-i18n-host',
        standalone: true,
        imports: [TourComponent],
        template: `
            <div id="tour-target-1">Target</div>
            <ui-tour [(active)]="active" [steps]="steps" [locale]="locale" />
        `,
    })
    class TourI18nHost {
        readonly active = signal(true);
        readonly steps: TourStep[] = [
            { target: '#tour-target-1', title: 'Step 1' },
            { target: '#tour-target-1', title: 'Step 2' },
        ];
        locale: string | undefined = undefined;
    }

    async function setup(opts: { locale?: string; providerLocale?: string } = {}): Promise<ComponentFixture<TourI18nHost>> {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [TourI18nHost],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(TourI18nHost);
        if (opts.locale) fixture.componentInstance.locale = opts.locale;
        await flush(fixture);
        return fixture;
    }

    it('defaults Skip/Previous/Next/Finish to English', async () => {
        await setup();
        const card = document.querySelector('[data-slot="tour-card"]') as HTMLElement;
        expect(card.textContent).toContain('Skip');
        expect(card.textContent).toContain('Next');
    });

    it('localises Skip/Previous/Next/Finish when locale="he" and applies dir="rtl"', async () => {
        await setup({ locale: 'he' });
        const card = document.querySelector('[data-slot="tour-card"]') as HTMLElement;
        expect(card.getAttribute('dir')).toBe('rtl');
        expect(card.textContent).toContain('דלג');
        expect(card.textContent).toContain('הבא');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        await setup({ providerLocale: 'fr' });
        const card = document.querySelector('[data-slot="tour-card"]') as HTMLElement;
        expect(card.textContent).toContain('Passer');
        expect(card.textContent).toContain('Suivant');
    });

    it('accepts a fully custom CommonLocale object as locale input', async () => {
        @Component({
            selector: 'app-tour-custom-host',
            standalone: true,
            imports: [TourComponent],
            template: `
                <div id="tour-target-1">Target</div>
                <ui-tour [(active)]="active" [steps]="steps" [locale]="loc" />
            `,
        })
        class TourCustomHost {
            readonly active = signal(true);
            readonly steps: TourStep[] = [
                { target: '#tour-target-1', title: 'Step 1' },
                { target: '#tour-target-1', title: 'Step 2' },
            ];
            readonly loc = {
                code: 'xx',
                rtl: true,
                close: 'C', cancel: 'C', confirm: 'C', continue: 'C', save: 'S', delete: 'D', edit: 'E',
                search: 'S', searchPlaceholder: 'S', selectPlaceholder: 'S', noResults: 'N',
                previous: 'X-PREV', next: 'X-NEXT', finish: 'X-FIN', skip: 'X-SKIP', loading: 'L', copied: 'C',
            };
        }

        await TestBed.configureTestingModule({ imports: [TourCustomHost] }).compileComponents();
        const fixture = TestBed.createComponent(TourCustomHost);
        await flush(fixture);
        const card = document.querySelector('[data-slot="tour-card"]') as HTMLElement;
        expect(card.getAttribute('dir')).toBe('rtl');
        expect(card.textContent).toContain('X-SKIP');
        expect(card.textContent).toContain('X-NEXT');
    });

    it('explicit nextLabel input wins over the locale', async () => {
        @Component({
            selector: 'app-tour-override-host',
            standalone: true,
            imports: [TourComponent],
            template: `
                <div id="tour-target-1">Target</div>
                <ui-tour [(active)]="active" [steps]="steps" locale="he" nextLabel="CUSTOM_NEXT" />
            `,
        })
        class TourOverrideHost {
            readonly active = signal(true);
            readonly steps: TourStep[] = [
                { target: '#tour-target-1', title: 'Step 1' },
                { target: '#tour-target-1', title: 'Step 2' },
            ];
        }

        await TestBed.configureTestingModule({ imports: [TourOverrideHost] }).compileComponents();
        const fixture = TestBed.createComponent(TourOverrideHost);
        await flush(fixture);
        const card = document.querySelector('[data-slot="tour-card"]') as HTMLElement;
        expect(card.textContent).toContain('CUSTOM_NEXT');
        expect(card.textContent).toContain('דלג');
    });
});
