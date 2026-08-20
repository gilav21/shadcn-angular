import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastService } from './toast.component';

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

    it('handles an already-settled promise', async () => {
        await service.promise(Promise.resolve('done'), {
            loading: 'L',
            success: 'S',
            error: 'E',
        });
        expect(service.toasts()).toHaveLength(1);
        expect(service.toasts()[0].variant).toBe('success');
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
});
