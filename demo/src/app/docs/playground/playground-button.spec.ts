// T-11 … T-14 from `specs/stackblitz-playground-spec.md` §2.3.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PlaygroundButtonComponent } from './playground-button.component';
import {
    PlaygroundService,
    PLAYGROUND_RAW_BASE,
    PlaygroundFetchError,
} from './playground.service';
import type { PlaygroundDoc } from './project';

const DOC: PlaygroundDoc = {
    name: 'button',
    importStatement: "import { ButtonComponent } from '@/components/ui/button';",
    snippet: '<ui-button>Click me</ui-button>',
    snippetSkipReason: null,
};

/** Resolves only when the test says so, so the pending state is observable. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

function render(doc: PlaygroundDoc) {
    const fixture = TestBed.createComponent(PlaygroundButtonComponent);
    fixture.componentRef.setInput('doc', doc);
    fixture.detectChanges();
    return fixture;
}

function button(fixture: ReturnType<typeof render>): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('button');
}

describe('PlaygroundButtonComponent', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                { provide: PLAYGROUND_RAW_BASE, useValue: '/__unused__' },
            ],
        });
    });

    describe('T-13 no snippet, no button', () => {
        it('renders nothing when a skip reason is recorded', () => {
            const fixture = render({
                ...DOC, snippet: null, snippetSkipReason: 'renders nothing on its own',
            });
            expect(button(fixture)).toBeNull();
        });

        it('renders a button when there is a snippet', () => {
            expect(button(render(DOC))).not.toBeNull();
        });
    });

    describe('T-14 the control is a real button', () => {
        it('is a <button>, not a div with a click handler', () => {
            expect(button(render(DOC))?.tagName).toBe('BUTTON');
        });

        it('has an accessible name naming the component', () => {
            const el = button(render(DOC));
            const name = el?.getAttribute('aria-label') ?? el?.textContent ?? '';
            expect(name.toLowerCase()).toContain('button');
        });

        it('is of type button, so it never submits an enclosing form', () => {
            expect(button(render(DOC))?.getAttribute('type')).toBe('button');
        });
    });

    describe('T-11 pending state while sources are fetched', () => {
        it('disables and announces itself busy until the project is ready', async () => {
            const gate = deferred<null>();
            vi.spyOn(TestBed.inject(PlaygroundService), 'project')
                .mockReturnValue(gate.promise);

            const fixture = render(DOC);
            button(fixture)?.click();
            fixture.detectChanges();

            expect(button(fixture)?.disabled).toBe(true);
            expect(button(fixture)?.getAttribute('aria-busy')).toBe('true');

            gate.resolve(null);
            await fixture.whenStable();
            fixture.detectChanges();

            expect(button(fixture)?.disabled).toBe(false);
            expect(button(fixture)?.getAttribute('aria-busy')).not.toBe('true');
        });
    });

    describe('T-12 a failed fetch is surfaced, naming the file', () => {
        it('shows the failing path and restores the button', async () => {
            vi.spyOn(TestBed.inject(PlaygroundService), 'project')
                .mockRejectedValue(new PlaygroundFetchError('lib/utils.ts', 404));

            const fixture = render(DOC);
            button(fixture)?.click();
            await fixture.whenStable();
            fixture.detectChanges();

            const host = fixture.nativeElement as HTMLElement;
            const error = host.querySelector('[data-slot="playground-error"]');
            expect(error?.textContent).toContain('lib/utils.ts');
            // Never a dead click: the reader can try again.
            expect(button(fixture)?.disabled).toBe(false);
        });

        it('announces the failure to assistive tech', async () => {
            vi.spyOn(TestBed.inject(PlaygroundService), 'project')
                .mockRejectedValue(new Error('boom'));

            const fixture = render(DOC);
            button(fixture)?.click();
            await fixture.whenStable();
            fixture.detectChanges();

            const error = (fixture.nativeElement as HTMLElement)
                .querySelector('[data-slot="playground-error"]');
            expect(error?.getAttribute('role')).toBe('alert');
        });

        it('clears a previous error when the reader tries again', async () => {
            const service = TestBed.inject(PlaygroundService);
            const spy = vi.spyOn(service, 'project').mockRejectedValue(new Error('boom'));

            const fixture = render(DOC);
            button(fixture)?.click();
            await fixture.whenStable();
            fixture.detectChanges();
            expect((fixture.nativeElement as HTMLElement)
                .querySelector('[data-slot="playground-error"]')).not.toBeNull();

            const gate = deferred<null>();
            spy.mockReturnValue(gate.promise);
            button(fixture)?.click();
            fixture.detectChanges();

            expect((fixture.nativeElement as HTMLElement)
                .querySelector('[data-slot="playground-error"]')).toBeNull();
            gate.resolve(null);
            await fixture.whenStable();
        });
    });
});
