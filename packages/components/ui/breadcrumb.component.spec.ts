import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreadcrumbComponent, BreadcrumbListComponent, BreadcrumbItemComponent, BreadcrumbLinkComponent, BreadcrumbPageComponent, BreadcrumbSeparatorComponent, BreadcrumbEllipsisComponent } from './breadcrumb.component';
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
