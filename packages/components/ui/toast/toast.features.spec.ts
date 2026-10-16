import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastComponent, ToastService, type ToastVariant } from './toast.component';
import { ToasterComponent } from './sub/toaster.component';

/**
 * Feature specs for the additive toast API (`update`, `loading`, `info`,
 * `warning`, `promise`). The pre-existing suite in `toast.component.spec.ts`
 * is deliberately left untouched — it is the backward-compatibility gate.
 */
describe('ToastService — update()', () => {
    let service: ToastService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ToastService);
        service.dismissAll();
    });

    afterEach(() => service.dismissAll());

    it('patches an existing toast in place, keeping its id and position', () => {
        const first = service.toast({ title: 'First' });
        const id = service.toast({ title: 'Before' });
        service.toast({ title: 'Last' });

        service.update(id, { title: 'After', description: 'now with a body' });

        const toasts = service.toasts();
        expect(toasts).toHaveLength(3);
        expect(toasts[1].id).toBe(id);
        expect(toasts[1].title).toBe('After');
        expect(toasts[1].description).toBe('now with a body');
        expect(toasts[0].id).toBe(first);
    });

    it('leaves untouched fields alone', () => {
        const id = service.toast({ title: 'Keep me', description: 'body', variant: 'success' });
        service.update(id, { title: 'Renamed' });

        expect(service.toasts()[0].description).toBe('body');
        expect(service.toasts()[0].variant).toBe('success');
    });

    it('ignores an unknown id', () => {
        service.toast({ title: 'Only' });
        service.update('toast-does-not-exist', { title: 'Nope' });

        expect(service.toasts()).toHaveLength(1);
        expect(service.toasts()[0].title).toBe('Only');
    });
});

describe('ToastService — update() timers (fake timers)', () => {
    let service: ToastService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        TestBed.configureTestingModule({});
        service = TestBed.inject(ToastService);
        service.dismissAll();
    });

    afterEach(() => {
        service.dismissAll();
        vi.useRealTimers();
    });

    it('restarts the auto-dismiss timer when duration is patched', () => {
        const id = service.loading('Working');
        expect(service.toasts()).toHaveLength(1);

        vi.advanceTimersByTime(10_000);
        expect(service.toasts()).toHaveLength(1);

        service.update(id, { title: 'Done', duration: 1000 });
        vi.advanceTimersByTime(999);
        expect(service.toasts()).toHaveLength(1);

        vi.advanceTimersByTime(2);
        expect(service.toasts()).toHaveLength(0);
    });

    it('does not restart the timer when duration is not part of the patch', () => {
        service.toast({ title: 'Timed', duration: 1000 });
        vi.advanceTimersByTime(600);
        service.update(service.toasts()[0].id, { title: 'Still timed' });

        vi.advanceTimersByTime(500);
        expect(service.toasts()).toHaveLength(0);
    });

    it('re-seeds the countdown when a countdown toast is patched', () => {
        const id = service.toast({ title: 'Tick', duration: 5000, showCountdown: true });
        expect(service.toasts()[0].countdownSeconds).toBe(5);

        service.update(id, { duration: 9000, showCountdown: true });
        expect(service.toasts()[0].countdownSeconds).toBe(9);
    });
});

describe('ToastService — loading / info / warning', () => {
    let service: ToastService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ToastService);
        service.dismissAll();
    });

    afterEach(() => service.dismissAll());

    it('info() and warning() behave like success()/error()', () => {
        const infoId = service.info('Heads up', 'a detail');
        const warnId = service.warning('Careful');

        expect(infoId).toMatch(/^toast-/);
        expect(warnId).toMatch(/^toast-/);
        expect(service.toasts()[0].variant).toBe('info');
        expect(service.toasts()[0].description).toBe('a detail');
        expect(service.toasts()[1].variant).toBe('warning');
    });

    it('loading() is sticky and marked as loading', () => {
        const id = service.loading('Saving…');
        const entry = service.toasts()[0];

        expect(entry.id).toBe(id);
        expect(entry.duration).toBe(0);
        expect(entry.loading).toBe(true);
    });

    it('all shorthands return a dismissable id', () => {
        const ids = [service.info('a'), service.warning('b'), service.loading('c')];
        ids.forEach(id => service.dismiss(id));
        expect(service.toasts()).toHaveLength(0);
    });
});

describe('ToastService — promise()', () => {
    let service: ToastService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ToastService);
        service.dismissAll();
    });

    afterEach(() => service.dismissAll());

    it('mutates the same toast id through to resolution', async () => {
        let resolveIt!: (value: string) => void;
        const pending = new Promise<string>(resolve => { resolveIt = resolve; });

        const run = service.promise(pending, {
            loading: 'Saving…',
            success: value => `Saved ${value}`,
            error: 'Failed',
        });

        expect(service.toasts()).toHaveLength(1);
        const id = service.toasts()[0].id;
        expect(service.toasts()[0].title).toBe('Saving…');
        expect(service.toasts()[0].loading).toBe(true);

        resolveIt('Ada');
        await expect(run).resolves.toBe('Ada');

        expect(service.toasts()).toHaveLength(1);
        expect(service.toasts()[0].id).toBe(id);
        expect(service.toasts()[0].title).toBe('Saved Ada');
        expect(service.toasts()[0].variant).toBe('success');
        expect(service.toasts()[0].loading).toBe(false);
    });

    it('shows the error variant on rejection', async () => {
        const failure = Promise.reject(new Error('boom'));

        const run = service.promise(failure, {
            loading: 'Saving…',
            success: 'Saved',
            error: err => `Failed: ${(err as Error).message}`,
        });

        const id = service.toasts()[0].id;
        await expect(run).rejects.toThrow('boom');

        expect(service.toasts()).toHaveLength(1);
        expect(service.toasts()[0].id).toBe(id);
        expect(service.toasts()[0].title).toBe('Failed: boom');
        expect(service.toasts()[0].variant).toBe('destructive');
    });

    it('accepts plain strings for success and error', async () => {
        await service.promise(Promise.resolve(1), { loading: 'L', success: 'S', error: 'E' });
        expect(service.toasts()[0].title).toBe('S');
    });

    it('does nothing to a toast the caller dismissed mid-flight', async () => {
        let resolveIt!: (value: number) => void;
        const pending = new Promise<number>(resolve => { resolveIt = resolve; });
        const run = service.promise(pending, { loading: 'L', success: 'S', error: 'E' });

        service.dismiss(service.toasts()[0].id);
        resolveIt(7);
        await run;

        expect(service.toasts()).toHaveLength(0);
    });

    it('honours an explicit result duration', async () => {
        await service.promise(Promise.resolve(1), {
            loading: 'L',
            success: 'S',
            error: 'E',
            duration: 1234,
        });
        expect(service.toasts()[0].duration).toBe(1234);
    });

    it('shows a plain-string error message on rejection', async () => {
        const settled = Promise.reject(new Error('was already dead'));
        await expect(
            service.promise(settled, { loading: 'L', success: 'S', error: 'E' })
        ).rejects.toThrow('was already dead');

        expect(service.toasts()).toHaveLength(1);
        expect(service.toasts()[0].title).toBe('E');
        expect(service.toasts()[0].variant).toBe('destructive');
    });
});

describe('ToastComponent — rendering the new state', () => {
    @Component({
        imports: [ToastComponent],
        template: '<ui-toast [variant]="variant()" [loading]="loading()" title="Working" />',
    })
    class ToastRenderHostComponent {
        readonly variant = signal<ToastVariant>('default');
        readonly loading = signal<boolean | undefined>(false);
    }

    afterEach(() => TestBed.resetTestingModule());

    function render(): ComponentFixture<ToastRenderHostComponent> {
        TestBed.configureTestingModule({ imports: [ToastRenderHostComponent] });
        const fixture = TestBed.createComponent(ToastRenderHostComponent);
        fixture.detectChanges();
        return fixture;
    }

    it('renders the spinner only while loading', () => {
        const fixture = render();
        expect(fixture.nativeElement.querySelector('[data-slot="toast-spinner"]')).toBeNull();

        fixture.componentInstance.loading.set(true);
        fixture.detectChanges();

        const spinner = fixture.nativeElement.querySelector('[data-slot="toast-spinner"]');
        expect(spinner).not.toBeNull();
        expect(spinner.getAttribute('aria-hidden')).toBe('true');
    });

    it('keeps the title alongside the spinner rather than replacing it', () => {
        const fixture = render();
        fixture.componentInstance.loading.set(true);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[data-slot="toast-title"]').textContent).toContain('Working');
    });

    it('announces info and warning politely, unlike destructive', () => {
        const fixture = render();
        const root = (): HTMLElement => fixture.nativeElement.querySelector('[data-slot="toast"]');

        for (const variant of ['info', 'warning'] as const) {
            fixture.componentInstance.variant.set(variant);
            fixture.detectChanges();
            expect(root().getAttribute('role')).toBe('status');
            expect(root().getAttribute('aria-live')).toBe('polite');
        }

        fixture.componentInstance.variant.set('destructive');
        fixture.detectChanges();
        expect(root().getAttribute('aria-live')).toBe('assertive');
    });

    it('gives info and warning their own contrast-tuned styling', () => {
        const fixture = render();
        fixture.componentInstance.variant.set('info');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-slot="toast"]').className).toContain('bg-blue-600');

        fixture.componentInstance.variant.set('warning');
        fixture.detectChanges();
        const warning = fixture.nativeElement.querySelector('[data-slot="toast"]').className;
        expect(warning).toContain('bg-amber-500');
        expect(warning).toContain('text-amber-950');
    });
});

describe('ui-toaster — auto-dismiss pauses while the user is on the stack', () => {
    @Component({ imports: [ToasterComponent], template: '<ui-toaster />' })
    class ToasterHostComponent { }

    let service: ToastService;
    let fixture: ComponentFixture<ToasterHostComponent>;
    let region: HTMLElement;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        TestBed.configureTestingModule({ imports: [ToasterHostComponent] });
        service = TestBed.inject(ToastService);
        service.dismissAll();
        fixture = TestBed.createComponent(ToasterHostComponent);
        fixture.detectChanges();
        region = fixture.nativeElement.querySelector('[data-slot="toaster"]');
    });

    afterEach(() => {
        service.dismissAll();
        vi.useRealTimers();
        TestBed.resetTestingModule();
    });

    const settle = (ms: number): void => {
        vi.advanceTimersByTime(ms);
        fixture.detectChanges();
    };
    const enter = (pointerType: string): void => {
        region.dispatchEvent(new PointerEvent('pointerenter', { pointerType }));
    };
    const leave = (pointerType: string): void => {
        region.dispatchEvent(new PointerEvent('pointerleave', { pointerType }));
    };

    it.each(['mouse', 'touch'])('freezes the clock under a %s pointer and resumes with the time that was left', pointerType => {
        service.toast({ title: 'Saved', duration: 5000 });
        settle(4000);

        enter(pointerType);
        settle(10_000);
        expect(service.toasts()).toHaveLength(1);

        leave(pointerType);
        settle(999);
        expect(service.toasts()).toHaveLength(1);
        settle(2);
        expect(service.toasts()).toHaveLength(0);
    });

    it('freezes the clock while focus is inside a toast, until focus leaves the stack', () => {
        service.toast({ title: 'Saved', duration: 5000, action: { label: 'Undo', onClick: () => undefined } });
        service.toast({ title: 'Other', duration: 60_000 });
        settle(4000);
        const [undo, close] = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;

        undo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        settle(10_000);
        expect(service.toasts()).toHaveLength(2);

        // Tabbing between controls of the same stack is not leaving it.
        undo.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: close }));
        settle(10_000);
        expect(service.toasts()).toHaveLength(2);

        // The pointer passing over and away must not release a pause that focus still holds.
        enter('mouse');
        leave('mouse');
        settle(10_000);
        expect(service.toasts()).toHaveLength(2);

        close.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
        settle(1001);
        expect(service.toasts().map(t => t.title)).toEqual(['Other']);
    });

    it('leaves a sticky toast alone when paused and resumed', () => {
        service.toast({ title: 'Pinned', duration: 0 });

        enter('mouse');
        leave('mouse');
        settle(100_000);

        expect(service.toasts()).toHaveLength(1);
    });

    it('freezes the displayed countdown while paused', () => {
        service.toast({
            title: 'Undo', duration: 5000, showCountdown: true, action: { label: 'Undo', onClick: () => undefined },
        });
        const shown = (): string => fixture.nativeElement.querySelector('button')!.textContent!.replaceAll(/\s+/g, '');
        settle(2000);
        expect(shown()).toContain('(3s)');

        enter('mouse');
        settle(5000);
        expect(shown()).toContain('(3s)');

        leave('mouse');
        settle(1000);
        expect(shown()).toContain('(2s)');
    });
});

describe('ui-toaster — loading toasts reach the DOM', () => {
    @Component({ imports: [ToasterComponent], template: '<ui-toaster />' })
    class ToasterHostComponent { }

    afterEach(() => TestBed.resetTestingModule());

    it('forwards the service loading flag through to the rendered toast', () => {
        TestBed.configureTestingModule({ imports: [ToasterHostComponent] });
        const service = TestBed.inject(ToastService);
        service.dismissAll();
        const fixture = TestBed.createComponent(ToasterHostComponent);
        fixture.detectChanges();

        const id = service.loading('Saving…');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-slot="toast-spinner"]')).not.toBeNull();

        service.update(id, { title: 'Saved', variant: 'success', loading: false, duration: 5000 });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[data-slot="toast-spinner"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('[data-slot="toast-title"]').textContent).toContain('Saved');
        service.dismissAll();
    });
});
