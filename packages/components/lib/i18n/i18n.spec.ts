import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import {
    interpolate,
    formatDate,
    formatNumber,
    formatList,
    formatRelativeTime,
    resolveLocale,
    createLocaleSelector,
    createLocaleBindings,
    UI_LOCALE_ID,
    provideUiLocale,
    type LocaleInput,
    type LocaleMeta,
} from './index';

interface TestLocale extends LocaleMeta {
    greeting: string;
}

const TEST_LOCALES: Record<string, TestLocale> = {
    en: { code: 'en', greeting: 'Hello' },
    he: { code: 'he', rtl: true, greeting: 'שלום' },
    fr: { code: 'fr', greeting: 'Bonjour' },
};

describe('interpolate', () => {
    it('replaces single {placeholder} tokens', () => {
        expect(interpolate('Hello {name}', { name: 'World' })).toBe('Hello World');
    });

    it('replaces multiple tokens and coerces numbers to strings', () => {
        expect(interpolate('Page {n} of {total}', { n: 3, total: 7 })).toBe('Page 3 of 7');
    });

    it('leaves unknown placeholders untouched so missing values surface', () => {
        expect(interpolate('Hi {name}, you have {count}', { name: 'Ada' })).toBe(
            'Hi Ada, you have {count}',
        );
    });

    it('replaces every occurrence of a repeated token', () => {
        expect(interpolate('{x} and {x}', { x: 'me' })).toBe('me and me');
    });

    it('returns the template unchanged when there are no placeholders', () => {
        expect(interpolate('static text', { x: 1 })).toBe('static text');
    });

    it('accepts placeholder names with dots, hyphens, and digits', () => {
        expect(
            interpolate('{user.name} has {item-count} (id={0})', {
                'user.name': 'Ada',
                'item-count': 3,
                '0': 'x1',
            }),
        ).toBe('Ada has 3 (id=x1)');
    });
});

describe('formatDate / formatNumber / formatList / formatRelativeTime', () => {
    const date = new Date(Date.UTC(2024, 0, 15, 10, 30));

    it('formatDate honours the locale', () => {
        const en = formatDate(date, 'en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
        const de = formatDate(date, 'de-DE', { month: 'long', day: 'numeric', timeZone: 'UTC' });
        expect(en).toContain('January');
        expect(en).toContain('15');
        expect(de).toContain('Januar');
        expect(de).toContain('15');
    });

    it('formatNumber honours the locale-specific decimal separator', () => {
        expect(formatNumber(1234.5, 'en-US')).toContain('.');
        expect(formatNumber(1234.5, 'de-DE')).toContain(',');
    });

    it('formatList honours the locale', () => {
        const en = formatList(['a', 'b', 'c'], 'en-US', { style: 'long', type: 'conjunction' });
        expect(en).toContain('a');
        expect(en).toContain('b');
        expect(en).toContain('c');
        expect(en).toMatch(/\band\b/);
        const de = formatList(['a', 'b', 'c'], 'de-DE', { style: 'long', type: 'conjunction' });
        expect(de).toMatch(/\bund\b/);
    });

    it('formatRelativeTime honours the locale and unit', () => {
        const past = formatRelativeTime(-1, 'day', 'en-US', { numeric: 'auto' });
        const future = formatRelativeTime(3, 'hour', 'en-US', { numeric: 'always' });
        expect(past.toLowerCase()).toContain('yesterday');
        expect(future).toContain('3');
        expect(future).toContain('hour');
    });
});

describe('resolveLocale (pure)', () => {
    it('returns the registry entry for a string input', () => {
        expect(resolveLocale('he', TEST_LOCALES, 'en').greeting).toBe('שלום');
    });

    it('returns the passed-in object when given a custom locale', () => {
        const custom: TestLocale = { code: 'xx', greeting: 'Xy' };
        expect(resolveLocale(custom, TEST_LOCALES, 'en')).toBe(custom);
    });

    it('falls back to the global key when input is undefined', () => {
        expect(resolveLocale(undefined, TEST_LOCALES, 'fr').greeting).toBe('Bonjour');
    });

    it('treats empty-string input the same as undefined (uses global key)', () => {
        expect(resolveLocale('', TEST_LOCALES, 'fr').greeting).toBe('Bonjour');
    });

    it('falls through to the global key when a string input misses the registry', () => {
        expect(resolveLocale('xx', TEST_LOCALES, 'fr').greeting).toBe('Bonjour');
    });

    it('falls back to the final fallback when both input and global key miss', () => {
        expect(resolveLocale('xx', TEST_LOCALES, 'yy').greeting).toBe('Hello');
    });

    it('respects a custom fallback key', () => {
        expect(resolveLocale('xx', TEST_LOCALES, 'yy', 'fr').greeting).toBe('Bonjour');
    });

    it('prefers a resolving input over the global key', () => {
        expect(resolveLocale('he', TEST_LOCALES, 'fr').greeting).toBe('שלום');
    });

    it('throws a descriptive error when the fallback entry is missing from the registry', () => {
        expect(() => resolveLocale('xx', {} as Record<string, TestLocale>, 'yy')).toThrowError(
            /missing the "en" fallback/,
        );
    });
});

describe('UI_LOCALE_ID + provideUiLocale', () => {
    it('defaults to a constant "en" signal when no provider is configured', () => {
        TestBed.configureTestingModule({});
        expect(TestBed.inject(UI_LOCALE_ID)()).toBe('en');
    });

    it('honours a static-string provideUiLocale', () => {
        TestBed.configureTestingModule({ providers: [provideUiLocale('fr')] });
        expect(TestBed.inject(UI_LOCALE_ID)()).toBe('fr');
    });

    it('honours a Signal provideUiLocale and reflects updates', () => {
        const sig = signal('en');
        TestBed.configureTestingModule({ providers: [provideUiLocale(sig)] });
        const fromToken = TestBed.inject(UI_LOCALE_ID);
        expect(fromToken()).toBe('en');
        sig.set('he');
        expect(fromToken()).toBe('he');
    });

    it('exposes the token value as a read-only Signal even when given a WritableSignal', () => {
        const sig = signal('en');
        TestBed.configureTestingModule({ providers: [provideUiLocale(sig)] });
        const fromToken = TestBed.inject(UI_LOCALE_ID);
        expect('set' in fromToken).toBe(false);
        expect('update' in fromToken).toBe(false);
    });
});

describe('createLocaleSelector (component helper)', () => {
    @Component({
        standalone: true,
        template: `{{ t().greeting }}|{{ t().code }}|{{ t().rtl ? 'rtl' : 'ltr' }}`,
    })
    class GreetingComponent {
        readonly locale = input<LocaleInput<TestLocale>>();
        protected readonly t = createLocaleSelector(this.locale, TEST_LOCALES);
    }

    it('throws a descriptive error when called with a non-Signal localeInput', () => {
        TestBed.configureTestingModule({});
        TestBed.runInInjectionContext(() => {
            expect(() =>
                createLocaleSelector(
                    undefined as unknown as Signal<LocaleInput<TestLocale> | undefined>,
                    TEST_LOCALES,
                ),
            ).toThrowError(/non-Signal `localeInput`/);
        });
    });

    function read(text: string): string {
        return text.trim();
    }

    it('defaults to English when no input and no provider', () => {
        TestBed.configureTestingModule({ imports: [GreetingComponent] });
        const fixture = TestBed.createComponent(GreetingComponent);
        fixture.detectChanges();
        expect(read(fixture.nativeElement.textContent)).toBe('Hello|en|ltr');
    });

    it('uses the per-instance locale input over the global token', () => {
        TestBed.configureTestingModule({
            imports: [GreetingComponent],
            providers: [provideUiLocale('fr')],
        });
        const fixture = TestBed.createComponent(GreetingComponent);
        fixture.componentRef.setInput('locale', 'he');
        fixture.detectChanges();
        expect(read(fixture.nativeElement.textContent)).toBe('שלום|he|rtl');
    });

    it('falls through to the global locale signal when no input is set', () => {
        const sig = signal('fr');
        TestBed.configureTestingModule({
            imports: [GreetingComponent],
            providers: [provideUiLocale(sig)],
        });
        const fixture = TestBed.createComponent(GreetingComponent);
        fixture.detectChanges();
        expect(read(fixture.nativeElement.textContent)).toBe('Bonjour|fr|ltr');

        sig.set('he');
        fixture.detectChanges();
        expect(read(fixture.nativeElement.textContent)).toBe('שלום|he|rtl');
    });

    it('falls through to the global locale signal when input is empty string', () => {
        TestBed.configureTestingModule({
            imports: [GreetingComponent],
            providers: [provideUiLocale('he')],
        });
        const fixture = TestBed.createComponent(GreetingComponent);
        fixture.componentRef.setInput('locale', '');
        fixture.detectChanges();
        expect(read(fixture.nativeElement.textContent)).toBe('שלום|he|rtl');
    });

    it('accepts a fully custom locale object as input', () => {
        TestBed.configureTestingModule({ imports: [GreetingComponent] });
        const fixture = TestBed.createComponent(GreetingComponent);
        fixture.componentRef.setInput('locale', { code: 'xx', greeting: 'Custom', rtl: true });
        fixture.detectChanges();
        expect(read(fixture.nativeElement.textContent)).toBe('Custom|xx|rtl');
    });
});

describe('createLocaleBindings (component helper)', () => {
    @Component({
        standalone: true,
        template: `<span [attr.dir]="dir()">{{ t().greeting }} {{ isRtl() }}</span>`,
    })
    class BindingsComponent {
        readonly locale = input<LocaleInput<TestLocale>>();
        private readonly i18n = createLocaleBindings(this.locale, TEST_LOCALES);
        protected readonly t = this.i18n.t;
        protected readonly isRtl = this.i18n.isRtl;
        protected readonly dir = this.i18n.dir;
    }

    it('emits dir="rtl" and isRtl=true for an RTL locale', () => {
        TestBed.configureTestingModule({ imports: [BindingsComponent] });
        const fixture = TestBed.createComponent(BindingsComponent);
        fixture.componentRef.setInput('locale', 'he');
        fixture.detectChanges();
        const span = fixture.nativeElement.querySelector('span') as HTMLSpanElement;
        expect(span.getAttribute('dir')).toBe('rtl');
        expect(span.textContent?.trim()).toBe('שלום true');
    });

    it('omits the dir attribute for LTR locales so ancestor dir="rtl" still applies', () => {
        TestBed.configureTestingModule({ imports: [BindingsComponent] });
        const fixture = TestBed.createComponent(BindingsComponent);
        fixture.componentRef.setInput('locale', 'fr');
        fixture.detectChanges();
        const span = fixture.nativeElement.querySelector('span') as HTMLSpanElement;
        expect(span.hasAttribute('dir')).toBe(false);
        expect(span.textContent?.trim()).toBe('Bonjour false');
    });
});
