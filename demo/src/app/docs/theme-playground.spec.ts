// demo/src/app/docs/theme-playground.spec.ts
//
// The rendered half of T-11. The var-for-var parity with the CLI is pinned in
// `packages/cli/scripts/theme-parity.spec.ts`, which runs the real commands on
// disk; this covers what the page actually does with that CSS.
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideUiLocale } from '../../../../packages/components/lib/i18n';
import { DOCS_LOCALES } from './docs.locales';
import { ThemePlaygroundComponent } from './theme-playground.component';
import { buildThemeCss, DEFAULT_THEME_SETTINGS, RADIUS_SCALE } from './theme-tokens';

async function render(locale?: string) {
    TestBed.configureTestingModule({
        providers: [
            provideZonelessChangeDetection(),
            ...(locale ? [provideUiLocale(locale)] : []),
        ],
    });
    const fixture = TestBed.createComponent(ThemePlaygroundComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
}

function click(host: HTMLElement, selector: string): void {
    const target = host.querySelector<HTMLElement>(`${selector} button`)
        ?? host.querySelector<HTMLElement>(selector);
    if (!target) throw new Error(`no control matching ${selector}`);
    target.click();
}

describe('ThemePlaygroundComponent', () => {
    it('starts from the same defaults the token module declares', async () => {
        const fixture = await render();
        expect(fixture.componentInstance.settings()).toEqual(DEFAULT_THEME_SETTINGS);
    });

    it('shows the CSS the token module builds for the current settings', async () => {
        const fixture = await render();
        expect(fixture.componentInstance.css()).toBe(buildThemeCss(DEFAULT_THEME_SETTINGS));
    });

    it('renders that CSS on the page so it can be read and copied', async () => {
        const fixture = await render();
        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('[data-slot="generated-css"]')).not.toBeNull();
        expect(host.querySelector('[data-slot="copy-css"]')).not.toBeNull();
    });

    it('regenerates the CSS when a theme is picked', async () => {
        const fixture = await render();
        const before = fixture.componentInstance.css();
        click(fixture.nativeElement as HTMLElement, '[data-theme-option="blue"]');
        fixture.detectChanges();

        expect(fixture.componentInstance.settings().theme).toBe('blue');
        expect(fixture.componentInstance.css()).not.toBe(before);
        expect(fixture.componentInstance.css())
            .toBe(buildThemeCss({ ...DEFAULT_THEME_SETTINGS, theme: 'blue' }));
    });

    it('regenerates the CSS when density and motion change', async () => {
        const fixture = await render();
        const host = fixture.nativeElement as HTMLElement;
        click(host, '[data-density-option="5"]');
        click(host, '[data-motion-option="0"]');
        fixture.detectChanges();

        expect(fixture.componentInstance.css()).toContain('--density: 1.25;');
        expect(fixture.componentInstance.css()).toContain('--motion: 0;');
    });

    it('resolves a named radius to the value the CLI writes', async () => {
        const fixture = await render();
        click(fixture.nativeElement as HTMLElement, '[data-radius-option="full"]');
        fixture.detectChanges();
        expect(fixture.componentInstance.css()).toContain(`--radius: ${RADIUS_SCALE['full']};`);
    });

    it('applies the tokens to the preview only, never to the document', async () => {
        const fixture = await render();
        const host = fixture.nativeElement as HTMLElement;
        click(host, '[data-theme-option="rose"]');
        fixture.detectChanges();

        const preview = host.querySelector<HTMLElement>('[data-slot="theme-preview"]');
        expect(preview?.style.getPropertyValue('--primary')).not.toBe('');
        expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
    });

    it('previews dark mode without touching the surrounding app', async () => {
        const fixture = await render();
        const host = fixture.nativeElement as HTMLElement;
        const preview = host.querySelector<HTMLElement>('[data-slot="theme-preview"]');
        const light = preview?.style.getPropertyValue('--background');

        fixture.componentInstance.dark.set(true);
        fixture.detectChanges();

        expect(preview?.classList.contains('dark')).toBe(true);
        expect(preview?.style.getPropertyValue('--background')).not.toBe(light);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('warns about a radius the CLI would reject, and omits it from the CSS', async () => {
        const fixture = await render();
        const host = fixture.nativeElement as HTMLElement;
        fixture.componentInstance.settings.update(s => ({ ...s, radius: 'not-a-length' }));
        fixture.detectChanges();

        expect(fixture.componentInstance.radiusValid()).toBe(false);
        expect(host.querySelector('[data-slot="radius-error"]')).not.toBeNull();
        expect(fixture.componentInstance.css()).not.toContain('--radius:');
    });

    it('prints the CLI commands that reproduce the current settings', async () => {
        const fixture = await render();
        click(fixture.nativeElement as HTMLElement, '[data-theme-option="green"]');
        fixture.detectChanges();
        expect(fixture.componentInstance.commands())
            .toContain('npx @gilav21/shadcn-angular change-theme green');
    });

    it('translates its labels', async () => {
        const fixture = await render('fr');
        expect((fixture.nativeElement as HTMLElement).textContent)
            .toContain(DOCS_LOCALES['fr'].playgroundHeading);
    });
});
