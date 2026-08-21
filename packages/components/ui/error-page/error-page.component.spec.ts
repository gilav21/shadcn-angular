/// <reference types="vite/client" />
// for `import.meta.glob` below — the shared tsconfig does not pull in
// Vite's ambient types, and this is the only spec that needs them.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    ErrorPageActionsComponent,
    ErrorPageComponent,
    ErrorPageIllustrationComponent,
    type ErrorPageCode,
} from './index';
import { ERROR_PAGE_LOCALES } from './error-page.locales';

/**
 * T-10 / T-11 / T-12 / T-13 / T-14 for `<ui-error-page>` (spec §2.1), written
 * before the component exists.
 *
 * The constraints these tests impose:
 *
 * 1. **No router, ever.** §1.4 and §3.3 put routing out of scope: the component
 *    emits `goBack` / `goHome` and leaves navigation to the consumer, per the
 *    project's no-DI-config convention. A component that injected `Router`
 *    would still pass a behavioural test, so this suite reads its own source
 *    and asserts the import is absent (R-3).
 * 2. **Default copy comes from a locale file, not hard-coded strings** (§3.5),
 *    and an unrecognised code must fall back rather than render blank or throw.
 * 3. **The heading is a real `<h1>`.** UC-14 — this is a full-page state, so it
 *    owns the document outline.
 * 4. **Projection replaces, never duplicates.** Projecting an illustration or an
 *    actions row must remove the default, not render both.
 */

const KNOWN_CODES = ['404', '403', '500'] as const;
const EN = ERROR_PAGE_LOCALES['en'];

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [dir]="dir()" [style.width.px]="frameWidth()" data-testid="frame">
            <ui-error-page
                [code]="code()"
                [title]="title()"
                [description]="description()"
                [class]="cls()"
                [locale]="locale()"
                (goBack)="backCount.set(backCount() + 1)"
                (goHome)="homeCount.set(homeCount() + 1)"
            >
                @if (showIllustration()) {
                    <ui-error-page-illustration>
                        <svg data-testid="custom-art"></svg>
                    </ui-error-page-illustration>
                }
                @if (showActions()) {
                    <ui-error-page-actions>
                        <button data-testid="custom-action">Take me somewhere else</button>
                    </ui-error-page-actions>
                }
            </ui-error-page>
        </div>
    `,
    imports: [
        ErrorPageComponent,
        ErrorPageIllustrationComponent,
        ErrorPageActionsComponent,
    ],
})
class HostComponent {
    readonly code = signal<ErrorPageCode>('404');
    readonly title = signal('');
    readonly description = signal('');
    readonly cls = signal('');
    readonly locale = signal<string | undefined>(undefined);
    readonly showIllustration = signal(false);
    readonly showActions = signal(false);
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly frameWidth = signal(1024);
    readonly backCount = signal(0);
    readonly homeCount = signal(0);
}

describe('ErrorPageComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    const q = (selector: string) =>
        (fixture.nativeElement as HTMLElement).querySelector(
            selector,
        ) as HTMLElement | null;

    const all = (selector: string) =>
        Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
                selector,
            ),
        );

    const need = (selector: string): HTMLElement => {
        const el = q(selector);
        expect(el, `expected ${selector} to be rendered`).toBeTruthy();
        return el!;
    };

    const withCode = (code: ErrorPageCode) => {
        host.code.set(code);
        fixture.detectChanges();
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HostComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    // R-3 / §3.3 — outputs only, no router dependency.
    describe('R-3 never depends on the router', () => {
        /**
         * R-3's failure mode is invisible to behavioural assertions: a component
         * that injected `Router` would still emit both outputs and pass every
         * other test in this file. So the guard reads the source instead.
         *
         * It scans EVERY `.ts` under the component folder, `sub/` included — a
         * router smuggled into a sub-component would otherwise slip past — and
         * strips comments first, so the spec's own
         * `(goHome)="router.navigate(['/'])"` usage snippet can be quoted in a
         * JSDoc block without failing the build. Only real code is inspected.
         */
        const sources = Object.entries(
            import.meta.glob('./**/*.ts', {
                query: '?raw',
                import: 'default',
                eager: true,
            }) as Record<string, string>,
        ).filter(([file]) => !file.endsWith('.spec.ts'));

        const stripComments = (source: string) =>
            source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');

        it('finds source files to scan', () => {
            expect(sources.length).toBeGreaterThan(0);
        });

        it.each([
            ['@angular/router', /@angular\/router/],
            ['Router', /\bRouter\b/],
            ['navigate', /\bnavigate\b/],
        ] as const)('never references %s in real code', (label, pattern) => {
            for (const [file, source] of sources) {
                expect(
                    stripComments(source),
                    `${file} must not reference ${label} — error-page emits ` +
                        'goBack/goHome and leaves navigation to the consumer (spec §1.4)',
                ).not.toMatch(pattern);
            }
        });
    });

    // T-10 / UC-10 — default copy per code.
    describe('T-10 known codes render their default copy', () => {
        it('renders the code itself', () => {
            withCode('404');
            expect(need('[data-slot="error-page-code"]').textContent?.trim()).toBe('404');
        });

        it('renders the locale copy for every known code', () => {
            for (const code of KNOWN_CODES) {
                withCode(code);
                const expected = EN.codes[code];
                expect(expected, `locale copy for ${code}`).toBeTruthy();
                expect(need('[data-slot="error-page-title"]').textContent?.trim()).toBe(
                    expected.title,
                );
                expect(
                    need('[data-slot="error-page-description"]').textContent?.trim(),
                ).toBe(expected.description);
            }
        });

        it('gives each known code its own copy', () => {
            const titles = KNOWN_CODES.map(code => EN.codes[code].title);
            expect(new Set(titles).size).toBe(KNOWN_CODES.length);
        });

        it('falls back to generic copy for an unrecognised code', () => {
            withCode('418');
            expect(need('[data-slot="error-page-code"]').textContent?.trim()).toBe('418');
            expect(need('[data-slot="error-page-title"]').textContent?.trim()).toBe(
                EN.fallback.title,
            );
            expect(
                need('[data-slot="error-page-description"]').textContent?.trim(),
            ).toBe(EN.fallback.description);
        });

        it('survives an empty code without throwing or rendering blank copy', () => {
            withCode('');
            expect(need('[data-slot="error-page-title"]').textContent?.trim()).toBe(
                EN.fallback.title,
            );
        });

        it('renders localised copy when a locale is selected', () => {
            const he = ERROR_PAGE_LOCALES['he'];
            expect(he.codes['404'].title).not.toBe(EN.codes['404'].title);

            host.locale.set('he');
            fixture.detectChanges();

            expect(need('[data-slot="error-page-title"]').textContent?.trim()).toBe(
                he.codes['404'].title,
            );
            expect(need('[data-slot="error-page-actions"]').textContent).toContain(
                he.goBack,
            );
        });
    });

    // T-11 / UC-11 — explicit copy wins.
    describe('T-11 explicit title/description override defaults', () => {
        it('uses an explicit title over the code default', () => {
            host.title.set('This page moved');
            fixture.detectChanges();
            expect(need('[data-slot="error-page-title"]').textContent?.trim()).toBe(
                'This page moved',
            );
        });

        it('uses an explicit description over the code default', () => {
            host.description.set('Try the new address instead.');
            fixture.detectChanges();
            expect(
                need('[data-slot="error-page-description"]').textContent?.trim(),
            ).toBe('Try the new address instead.');
        });

        it('overrides each independently', () => {
            host.title.set('This page moved');
            fixture.detectChanges();
            expect(
                need('[data-slot="error-page-description"]').textContent?.trim(),
            ).toBe(EN.codes['404'].description);
        });
    });

    // T-12 / UC-12 — default actions emit; projection replaces them.
    describe('T-12 default actions emit goBack/goHome outputs', () => {
        it('renders both default actions', () => {
            const actions = need('[data-slot="error-page-actions"]');
            expect(actions.textContent).toContain(EN.goBack);
            expect(actions.textContent).toContain(EN.goHome);
        });

        it('emits goBack when the back action is pressed', () => {
            const back = need('[data-slot="error-page-back"] button');
            back.click();
            fixture.detectChanges();
            expect(host.backCount()).toBe(1);
            expect(host.homeCount()).toBe(0);
        });

        it('emits goHome when the home action is pressed', () => {
            const home = need('[data-slot="error-page-home"] button');
            home.click();
            fixture.detectChanges();
            expect(host.homeCount()).toBe(1);
            expect(host.backCount()).toBe(0);
        });

        it('replaces the default actions when an actions row is projected', () => {
            host.showActions.set(true);
            fixture.detectChanges();
            expect(q('[data-slot="error-page-back"]')).toBeNull();
            expect(q('[data-slot="error-page-home"]')).toBeNull();
            expect(need('[data-testid="custom-action"]')).toBeTruthy();
        });

        it('renders exactly one actions region when actions are projected', () => {
            host.showActions.set(true);
            fixture.detectChanges();
            expect(all('[data-slot="error-page-actions"]')).toHaveLength(1);
        });
    });

    // T-13 / UC-13 — projected illustration replaces the default.
    describe('T-13 projected illustration replaces default', () => {
        beforeEach(() => {
            host.showIllustration.set(true);
            fixture.detectChanges();
        });

        it('renders the projected illustration', () => {
            expect(need('[data-testid="custom-art"]')).toBeTruthy();
        });

        it('drops the default typographic code', () => {
            expect(q('[data-slot="error-page-code"]')).toBeNull();
        });

        it('still renders the copy alongside a custom illustration', () => {
            expect(need('[data-slot="error-page-title"]').textContent?.trim()).toBe(
                EN.codes['404'].title,
            );
        });
    });

    // T-14 / UC-14 — real h1, responsive.
    describe('T-14 renders h1 and is responsive 320 to 1920', () => {
        it('renders the title as a real h1', () => {
            const title = need('[data-slot="error-page-title"]');
            expect(title.tagName).toBe('H1');
        });

        /**
         * §1.1 calls this a *full-page* state, which is the whole reason it owns
         * the `<h1>`. A panel that merely hugged its content would satisfy every
         * other assertion here, so the standing height and the centring are
         * pinned explicitly.
         */
        it('stands as a full-page centred state', () => {
            const style = getComputedStyle(need('[data-slot="error-page"]'));
            expect(style.display).toBe('flex');
            expect(style.flexDirection).toBe('column');
            expect(style.alignItems).toBe('center');
            expect(style.justifyContent).toBe('center');
            expect(Number.parseFloat(style.minHeight)).toBeGreaterThan(0);
        });

        it('merges the class input onto the page', () => {
            host.cls.set('bg-muted');
            fixture.detectChanges();
            expect(need('[data-slot="error-page"]').classList.contains('bg-muted')).toBe(
                true,
            );
        });

        it('renders exactly one h1', () => {
            expect(all('h1')).toHaveLength(1);
        });

        it('hides the decorative code from assistive tech', () => {
            expect(need('[data-slot="error-page-code"]').getAttribute('aria-hidden')).toBe(
                'true',
            );
        });

        it('does not overflow a 320px viewport', () => {
            host.frameWidth.set(320);
            fixture.detectChanges();
            const frame = need('[data-testid="frame"]');
            expect(need('[data-slot="error-page"]').scrollWidth).toBeLessThanOrEqual(
                frame.clientWidth,
            );
        });

        it('keeps the actions on screen at 320px', () => {
            host.frameWidth.set(320);
            fixture.detectChanges();
            const actions = need('[data-slot="error-page-actions"]');
            expect(getComputedStyle(actions).flexWrap).toBe('wrap');
            expect(actions.scrollWidth).toBeLessThanOrEqual(
                need('[data-testid="frame"]').clientWidth,
            );
        });

        /** A full-width line of prose on an ultrawide monitor is unreadable. */
        it('caps the description measure on a wide viewport', () => {
            host.frameWidth.set(1920);
            fixture.detectChanges();
            const description = need('[data-slot="error-page-description"]');
            expect(description.getBoundingClientRect().width).toBeLessThan(1000);
        });
    });

    // §2.2 edge case — RTL.
    describe('RTL', () => {
        beforeEach(() => {
            host.dir.set('rtl');
            fixture.detectChanges();
        });

        it('inherits the ambient direction', () => {
            expect(getComputedStyle(need('[data-slot="error-page"]')).direction).toBe(
                'rtl',
            );
        });

        it('uses only direction-agnostic spacing utilities', () => {
            const physical =
                /(^|:)(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)(-|$)/;
            const page = need('[data-slot="error-page"]');
            const offenders = [page, ...page.querySelectorAll<HTMLElement>('*')]
                .flatMap(el => Array.from(el.classList))
                .filter(cls => physical.test(cls));
            expect(offenders).toEqual([]);
        });
    });
});
