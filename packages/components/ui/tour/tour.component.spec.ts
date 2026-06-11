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
            addListener: () => { },
            removeListener: () => { },
            addEventListener: () => { },
            removeEventListener: () => { },
            dispatchEvent: () => false,
        }),
    });
}

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

    it('should remove highlight on teardown', async () => {
        host.active.set(true);
        await flush(fixture);

        host.active.set(false);
        fixture.detectChanges();

        const target = document.getElementById('step1');
        expect(target?.hasAttribute('data-ui-tour-highlight')).toBe(false);
        expect(target?.style.outline).toBe('');
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
                previous: 'X-PREV', next: 'X-NEXT', finish: 'X-FIN', skip: 'X-SKIP', loading: 'L',
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
        // skip still falls through to the locale dictionary
        expect(card.textContent).toContain('דלג');
    });
});
