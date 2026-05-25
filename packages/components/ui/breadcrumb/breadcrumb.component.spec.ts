import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreadcrumbComponent, BreadcrumbListComponent, BreadcrumbItemComponent, BreadcrumbLinkComponent, BreadcrumbPageComponent, BreadcrumbSeparatorComponent } from './index';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-breadcrumb>
            <ui-breadcrumb-list>
                <ui-breadcrumb-item>
                    <ui-breadcrumb-link href="/">Home</ui-breadcrumb-link>
                </ui-breadcrumb-item>
                <ui-breadcrumb-separator />
                <ui-breadcrumb-item>
                    <ui-breadcrumb-link href="/products">Products</ui-breadcrumb-link>
                </ui-breadcrumb-item>
                <ui-breadcrumb-separator />
                <ui-breadcrumb-item>
                    <ui-breadcrumb-page>Current Page</ui-breadcrumb-page>
                </ui-breadcrumb-item>
            </ui-breadcrumb-list>
        </ui-breadcrumb>
    `,
    imports: [BreadcrumbComponent, BreadcrumbListComponent, BreadcrumbItemComponent, BreadcrumbLinkComponent, BreadcrumbPageComponent, BreadcrumbSeparatorComponent]
})
class TestHostComponent { }

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-breadcrumb>
                <ui-breadcrumb-list>
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-link href="/">الرئيسية</ui-breadcrumb-link>
                    </ui-breadcrumb-item>
                    <ui-breadcrumb-separator />
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-page>الصفحة الحالية</ui-breadcrumb-page>
                    </ui-breadcrumb-item>
                </ui-breadcrumb-list>
            </ui-breadcrumb>
        </div>
    `,
    imports: [BreadcrumbComponent, BreadcrumbListComponent, BreadcrumbItemComponent, BreadcrumbLinkComponent, BreadcrumbPageComponent, BreadcrumbSeparatorComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('BreadcrumbComponent', () => {
    let component: BreadcrumbComponent;
    let fixture: ComponentFixture<BreadcrumbComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BreadcrumbComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BreadcrumbComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render nav with aria-label="breadcrumb"', () => {
        const nav = fixture.debugElement.query(By.css('nav[aria-label="breadcrumb"]'));
        expect(nav).toBeTruthy();
    });

    it('should have data-slot="breadcrumb"', () => {
        const nav = fixture.debugElement.query(By.css('[data-slot="breadcrumb"]'));
        expect(nav).toBeTruthy();
    });
});

describe('Breadcrumb Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render breadcrumb list', () => {
        const list = fixture.debugElement.query(By.css('[data-slot="breadcrumb-list"]'));
        expect(list).toBeTruthy();
    });

    it('should render breadcrumb items', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-item"]'));
        expect(items.length).toBe(3);
    });

    it('should render breadcrumb links', () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-link"] a'));
        expect(links.length).toBe(2);
    });

    it('should render breadcrumb page', () => {
        const page = fixture.debugElement.query(By.css('[data-slot="breadcrumb-page"]'));
        expect(page).toBeTruthy();
        expect(page.nativeElement.getAttribute('aria-current')).toBe('page');
    });

    it('should render separators', () => {
        const separators = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-separator"]'));
        expect(separators.length).toBe(2);
    });

    it('should have separator with aria-hidden', () => {
        const separator = fixture.debugElement.query(By.css('[data-slot="breadcrumb-separator"]'));
        expect(separator.nativeElement.getAttribute('aria-hidden')).toBe('true');
    });

    it('should have separator with role="presentation"', () => {
        const separator = fixture.debugElement.query(By.css('[data-slot="breadcrumb-separator"]'));
        expect(separator.nativeElement.getAttribute('role')).toBe('presentation');
    });
});

describe('Breadcrumb RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should rotate separator icon in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const separator = fixture.debugElement.query(By.css('[data-slot="breadcrumb-separator"]'));
        expect(separator).toBeTruthy();
        // The separator svg has rtl:rotate-180 class
        const svg = separator.nativeElement.querySelector('svg');
        // SVG elements use classList or getAttribute for class checking
        const svgClass = svg.getAttribute('class') || '';
        expect(svgClass).toContain('rtl:rotate-180');
    });

    it('should maintain list structure in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const list = fixture.debugElement.query(By.css('[data-slot="breadcrumb-list"]'));
        expect(list).toBeTruthy();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-item"]'));
        expect(items.length).toBe(2);
    });
});

// Test host for simple mode (data-driven)
@Component({
    template: `
        <ui-breadcrumb>
            <ui-breadcrumb-list [items]="items" />
        </ui-breadcrumb>
    `,
    imports: [BreadcrumbComponent, BreadcrumbListComponent]
})
class SimpleModeTestHostComponent {
    items = [
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Current Page', isCurrentPage: true }
    ];
}

describe('Breadcrumb Simple Mode (Data-Driven)', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        fixture.detectChanges();
    });

    it('should render all items from input array', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-item"]'));
        expect(items.length).toBe(3);
    });

    it('should render links for non-current items', () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-link"]'));
        expect(links.length).toBe(2);
    });

    it('should render current page with aria-current', () => {
        const page = fixture.debugElement.query(By.css('[data-slot="breadcrumb-page"]'));
        expect(page).toBeTruthy();
        expect(page.nativeElement.getAttribute('aria-current')).toBe('page');
    });

    it('should auto-insert separators between items', () => {
        const separators = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-separator"]'));
        expect(separators.length).toBe(2); // 3 items = 2 separators
    });

    it('should render correct href on links', () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-link"]'));
        expect(links[0].nativeElement.getAttribute('href')).toBe('/');
        expect(links[1].nativeElement.getAttribute('href')).toBe('/products');
    });

    it('should render correct labels', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="breadcrumb-item"]'));
        expect(items[0].nativeElement.textContent).toContain('Home');
        expect(items[1].nativeElement.textContent).toContain('Products');
        expect(items[2].nativeElement.textContent).toContain('Current Page');
    });
});

describe('BreadcrumbComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [BreadcrumbComponent, BreadcrumbListComponent, BreadcrumbItemComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        return opts;
    }

    it('defaults nav aria-label to English "breadcrumb"', async () => {
        await setup();
        const fixture = TestBed.createComponent(BreadcrumbComponent);
        fixture.detectChanges();
        const nav = fixture.nativeElement.querySelector('[data-slot="breadcrumb"]');
        expect(nav.getAttribute('aria-label')).toBe('breadcrumb');
        expect(nav.hasAttribute('dir')).toBe(false);
    });

    it('localises nav aria-label and sets dir="rtl" when locale="he"', async () => {
        await setup();
        const fixture = TestBed.createComponent(BreadcrumbComponent);
        fixture.componentRef.setInput('locale', 'he');
        fixture.detectChanges();
        const nav = fixture.nativeElement.querySelector('[data-slot="breadcrumb"]');
        expect(nav.getAttribute('aria-label')).toBe('נתיב ניווט');
        expect(nav.getAttribute('dir')).toBe('rtl');
    });

    it('broadcasts locale to the ellipsis sub-component via UI_LOCALE_ID', async () => {
        const { BreadcrumbEllipsisComponent } = await import('./sub/breadcrumb-ellipsis.component');
        @Component({
            standalone: true,
            imports: [BreadcrumbComponent, BreadcrumbEllipsisComponent],
            template: `<ui-breadcrumb locale="fr"><ui-breadcrumb-ellipsis /></ui-breadcrumb>`,
        })
        class Host {}
        await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const srOnly = fixture.nativeElement.querySelector('[data-slot="breadcrumb-ellipsis"] .sr-only');
        expect(srOnly.textContent.trim()).toBe('Plus');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        await setup({ providerLocale: 'de' });
        const fixture = TestBed.createComponent(BreadcrumbComponent);
        fixture.detectChanges();
        const nav = fixture.nativeElement.querySelector('[data-slot="breadcrumb"]');
        expect(nav.getAttribute('aria-label')).toBe('Navigationspfad');
    });

    it('accepts a fully custom BreadcrumbLocale object on the parent — child sub-components must opt in via their own [locale]', async () => {
        // provideComponentLocale broadcasts only the parent locale's BCP-47
        // code string, not the full object. Custom-object locales therefore
        // localise the parent itself; sub-components that want the same
        // custom dictionary must bind it explicitly.
        const { BreadcrumbEllipsisComponent } = await import('./sub/breadcrumb-ellipsis.component');
        @Component({
            standalone: true,
            imports: [BreadcrumbComponent, BreadcrumbEllipsisComponent],
            template: `
                <ui-breadcrumb [locale]="loc">
                    <ui-breadcrumb-ellipsis [locale]="loc" />
                </ui-breadcrumb>
            `,
        })
        class CustomHost {
            readonly loc = { code: 'xx', rtl: true, breadcrumb: 'XX_NAV', more: 'XX_MORE' };
        }
        await TestBed.configureTestingModule({ imports: [CustomHost] }).compileComponents();
        const fixture = TestBed.createComponent(CustomHost);
        fixture.detectChanges();
        const nav = fixture.nativeElement.querySelector('[data-slot="breadcrumb"]');
        expect(nav.getAttribute('aria-label')).toBe('XX_NAV');
        expect(nav.getAttribute('dir')).toBe('rtl');
        const srOnly = fixture.nativeElement.querySelector('[data-slot="breadcrumb-ellipsis"] .sr-only');
        expect(srOnly.textContent.trim()).toBe('XX_MORE');
    });

    it('parent custom-locale object does NOT auto-propagate to child sub-components (string codes do, full objects do not)', async () => {
        // Documents the inherent limitation of provideComponentLocale: it
        // re-broadcasts the parent's locale code (a BCP-47 string), so
        // children look up THEIR OWN registry. A custom-object parent with
        // a code that's not in the child's registry falls back to English.
        const { BreadcrumbEllipsisComponent } = await import('./sub/breadcrumb-ellipsis.component');
        @Component({
            standalone: true,
            imports: [BreadcrumbComponent, BreadcrumbEllipsisComponent],
            template: `<ui-breadcrumb [locale]="loc"><ui-breadcrumb-ellipsis /></ui-breadcrumb>`,
        })
        class ParentOnlyHost {
            readonly loc = { code: 'xx', breadcrumb: 'XX_NAV', more: 'XX_MORE' };
        }
        await TestBed.configureTestingModule({ imports: [ParentOnlyHost] }).compileComponents();
        const fixture = TestBed.createComponent(ParentOnlyHost);
        fixture.detectChanges();
        const nav = fixture.nativeElement.querySelector('[data-slot="breadcrumb"]');
        expect(nav.getAttribute('aria-label')).toBe('XX_NAV');
        // Child sees code='xx' broadcast but BREADCRUMB_LOCALES['xx'] doesn't
        // exist, so it falls back to English. This is the documented contract.
        const srOnly = fixture.nativeElement.querySelector('[data-slot="breadcrumb-ellipsis"] .sr-only');
        expect(srOnly.textContent.trim()).toBe('More');
    });
});
