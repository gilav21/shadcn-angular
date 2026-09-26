import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    PaginationComponent,
    PaginationContentComponent,
    PaginationItemComponent,
    PaginationLinkComponent,
    PaginationPreviousComponent,
    PaginationNextComponent,
    PaginationEllipsisComponent
} from './index';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

// Basic test host
@Component({
    template: `
        <ui-pagination>
            <ui-pagination-content>
                <ui-pagination-item>
                    <ui-pagination-previous [disabled]="currentPage() === 1" (click)="goTo(currentPage() - 1)" />
                </ui-pagination-item>
                <ui-pagination-item>
                    <ui-pagination-link [isActive]="currentPage() === 1" (click)="goTo(1)">1</ui-pagination-link>
                </ui-pagination-item>
                <ui-pagination-item>
                    <ui-pagination-link [isActive]="currentPage() === 2" (click)="goTo(2)">2</ui-pagination-link>
                </ui-pagination-item>
                <ui-pagination-item>
                    <ui-pagination-ellipsis />
                </ui-pagination-item>
                <ui-pagination-item>
                    <ui-pagination-link [isActive]="currentPage() === 10" (click)="goTo(10)">10</ui-pagination-link>
                </ui-pagination-item>
                <ui-pagination-item>
                    <ui-pagination-next [disabled]="currentPage() === 10" (click)="goTo(currentPage() + 1)" />
                </ui-pagination-item>
            </ui-pagination-content>
        </ui-pagination>
    `,
    imports: [PaginationComponent, PaginationContentComponent, PaginationItemComponent, PaginationLinkComponent, PaginationPreviousComponent, PaginationNextComponent, PaginationEllipsisComponent]
})
class TestHostComponent {
    currentPage = signal(1);

    goTo(page: number) {
        this.currentPage.set(page);
    }
}

describe('PaginationComponent', () => {
    let fixture: ComponentFixture<PaginationComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PaginationComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PaginationComponent);
        fixture.detectChanges();
    });

    it('should have role="navigation"', () => {
        const nav = fixture.nativeElement.querySelector('[role="navigation"]');
        expect(nav).toBeTruthy();
    });

});

describe('Pagination Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should have aria-hidden on ellipsis', () => {
        const ellipsis = fixture.debugElement.query(By.css('[data-slot="pagination-ellipsis"]'));
        expect(ellipsis.nativeElement.getAttribute('aria-hidden')).toBe('true');
    });

    it('should mark active page with aria-current="page"', () => {
        const activePage = fixture.debugElement.query(By.css('[aria-current="page"]'));
        expect(activePage).toBeTruthy();
        expect(activePage.nativeElement.textContent).toContain('1');
    });

    it('should move aria-current to the clicked page link', async () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="pagination-link"]'));
        links[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const current = fixture.debugElement.queryAll(By.css('[aria-current="page"]'));
        expect(current.map(el => el.nativeElement.textContent.trim())).toEqual(['2']);
    });

    it('disables the previous/next controls through their disabled input', async () => {
        const prev = () => fixture.debugElement.query(By.css('[data-slot="pagination-previous"]')).nativeElement as HTMLButtonElement;
        const next = () => fixture.debugElement.query(By.css('[data-slot="pagination-next"]')).nativeElement as HTMLButtonElement;

        expect(prev().disabled).toBe(true);
        expect(next().disabled).toBe(false);
        prev().click();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(component.currentPage()).toBe(1);

        component.currentPage.set(10);
        fixture.detectChanges();
        expect(prev().disabled).toBe(false);
        expect(next().disabled).toBe(true);
        next().click();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(component.currentPage()).toBe(10);
    });

    it('should have screen reader text in ellipsis', () => {
        const ellipsis = fixture.debugElement.query(By.css('[data-slot="pagination-ellipsis"]'));
        const srOnly = ellipsis.nativeElement.querySelector('.sr-only');
        expect(srOnly.textContent).toContain('More pages');
    });
});

// Test host for simple mode (data-driven)
@Component({
    template: `
        <ui-pagination 
            [currentPage]="currentPage()" 
            [totalPages]="totalPages()"
            (pageChange)="onPageChange($event)" 
        />
    `,
    imports: [PaginationComponent]
})
class SimpleModeTestHostComponent {
    currentPage = signal(1);
    totalPages = signal(10);
    lastPageChange = signal(0);

    onPageChange(page: number) {
        this.lastPageChange.set(page);
        this.currentPage.set(page);
    }
}

describe('Pagination Simple Mode (Data-Driven)', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;
    let component: SimpleModeTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it.each([
        { current: 1, total: 7, labels: ['1', '2', '3', '4', '5', '6', '7'] },
        { current: 2, total: 10, labels: ['1', '2', '3', '4', '5', '…', '10'] },
        { current: 9, total: 10, labels: ['1', '…', '6', '7', '8', '9', '10'] },
        { current: 5, total: 10, labels: ['1', '…', '4', '5', '6', '…', '10'] },
    ])('renders pages $labels for page $current of $total', ({ current, total, labels }) => {
        component.currentPage.set(current);
        component.totalPages.set(total);
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="pagination-content"]')).nativeElement as HTMLElement;
        const rendered = Array.from(content.querySelectorAll('[data-slot="pagination-link"], [data-slot="pagination-ellipsis"]'),
            el => (el.getAttribute('data-slot') === 'pagination-ellipsis' ? '…' : (el.textContent ?? '').trim()));
        expect(rendered).toEqual(labels);
    });

    it('should mark current page with aria-current', () => {
        const activePage = fixture.debugElement.query(By.css('[aria-current="page"]'));
        expect(activePage).toBeTruthy();
        expect(activePage.nativeElement.textContent.trim()).toBe('1');
    });

    it('should disable previous button on first page', () => {
        const prev = fixture.debugElement.query(By.css('[data-slot="pagination-previous"]'));
        expect(prev.nativeElement.disabled).toBe(true);
    });

    it('should emit pageChange on page click', async () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="pagination-link"]'));
        const page2 = links.find(l => l.nativeElement.textContent.trim() === '2');
        page2?.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.lastPageChange()).toBe(2);
    });

    it('should emit pageChange on next click', async () => {
        const next = fixture.debugElement.query(By.css('[data-slot="pagination-next"]'));
        next.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.lastPageChange()).toBe(2);
    });

    it('should disable next button on last page', async () => {
        component.currentPage.set(10);
        fixture.detectChanges();
        await fixture.whenStable();

        const next = fixture.debugElement.query(By.css('[data-slot="pagination-next"]'));
        expect(next.nativeElement.disabled).toBe(true);
    });

    it('should render both ellipses without a duplicate-key error', () => {
        const messages: unknown[][] = [];
        const consoleRef = globalThis.console as unknown as Record<string, (...args: unknown[]) => void>;
        const capturedMethods = ['warn', 'error'];
        const originals = capturedMethods.map(name => consoleRef[name]);
        capturedMethods.forEach(name => {
            consoleRef[name] = (...args: unknown[]) => { messages.push(args); };
        });

        try {
            component.currentPage.set(5);
            fixture.detectChanges();

            const pagination = fixture.debugElement.query(By.directive(PaginationComponent))
                .componentInstance as PaginationComponent;
            expect(pagination.pageNumbers().filter(p => p === -1)).toHaveLength(2);

            const ellipsis = fixture.debugElement.queryAll(By.css('[data-slot="pagination-ellipsis"]'));
            expect(ellipsis).toHaveLength(2);
        } finally {
            capturedMethods.forEach((name, index) => {
                consoleRef[name] = originals[index];
            });
        }

        const duplicateKeyReports = messages
            .map(args => args.map(a => String(a)).join(' '))
            .filter(text => text.includes('NG0955'));
        expect(duplicateKeyReports).toEqual([]);
    });
});

describe('PaginationComponent — i18n integration', () => {
    it('defaults to English when no locale input and no provider is configured', async () => {
        await TestBed.configureTestingModule({
            imports: [PaginationComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(PaginationComponent);
        fixture.componentRef.setInput('currentPage', 1);
        fixture.componentRef.setInput('totalPages', 3);
        fixture.detectChanges();
        const nav = fixture.debugElement.query(By.css('[data-slot="pagination"]'));
        expect(nav.attributes['aria-label']).toBe('pagination');
        expect(nav.nativeElement.hasAttribute('dir')).toBe(false);
        const prev = fixture.debugElement.query(By.css('[data-slot="pagination-previous"]'));
        expect(prev.nativeElement.textContent).toContain('Previous');
        const next = fixture.debugElement.query(By.css('[data-slot="pagination-next"]'));
        expect(next.nativeElement.textContent).toContain('Next');
    });

    it('renders Hebrew strings and dir="rtl" when locale="he"', async () => {
        await TestBed.configureTestingModule({
            imports: [PaginationComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(PaginationComponent);
        fixture.componentRef.setInput('locale', 'he');
        fixture.componentRef.setInput('currentPage', 1);
        fixture.componentRef.setInput('totalPages', 20);
        fixture.detectChanges();
        const nav = fixture.debugElement.query(By.css('[data-slot="pagination"]'));
        expect(nav.attributes['aria-label']).toBe('ניווט עמודים');
        expect(nav.attributes['dir']).toBe('rtl');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-previous"]')).nativeElement.textContent).toContain('הקודם');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-next"]')).nativeElement.textContent).toContain('הבא');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-ellipsis"]')).nativeElement.textContent).toContain('עוד עמודים');
    });

    it('falls back to the global UI_LOCALE_ID when no locale input is set', async () => {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [PaginationComponent],
            providers: [provideUiLocale('ar')],
        }).compileComponents();
        const fixture = TestBed.createComponent(PaginationComponent);
        fixture.componentRef.setInput('currentPage', 1);
        fixture.componentRef.setInput('totalPages', 3);
        fixture.detectChanges();
        const nav = fixture.debugElement.query(By.css('[data-slot="pagination"]'));
        expect(nav.attributes['aria-label']).toBe('ترقيم الصفحات');
        expect(nav.attributes['dir']).toBe('rtl');
    });

    it('per-instance locale input overrides the global signal', async () => {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [PaginationComponent],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const fixture = TestBed.createComponent(PaginationComponent);
        fixture.componentRef.setInput('locale', 'fr');
        fixture.componentRef.setInput('currentPage', 1);
        fixture.componentRef.setInput('totalPages', 3);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-previous"]')).nativeElement.textContent).toContain('Précédent');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination"]')).nativeElement.hasAttribute('dir')).toBe(false);
    });

    it('accepts a fully custom PaginationLocale object as input', async () => {
        await TestBed.configureTestingModule({
            imports: [PaginationComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(PaginationComponent);
        fixture.componentRef.setInput('locale', {
            code: 'xx',
            rtl: true,
            previous: 'CUSTOM_PREV',
            next: 'CUSTOM_NEXT',
            morePages: 'CUSTOM_MORE',
            pagination: 'CUSTOM_NAV',
        });
        fixture.componentRef.setInput('currentPage', 5);
        fixture.componentRef.setInput('totalPages', 20);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('[data-slot="pagination"]')).attributes['aria-label']).toBe('CUSTOM_NAV');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-previous"]')).nativeElement.textContent).toContain('CUSTOM_PREV');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-next"]')).nativeElement.textContent).toContain('CUSTOM_NEXT');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-ellipsis"]')).nativeElement.textContent).toContain('CUSTOM_MORE');
    });

    it('auto-propagates the parent locale to projected sub-components via viewProviders', async () => {
        @Component({
            standalone: true,
            imports: [
                PaginationComponent,
                PaginationContentComponent,
                PaginationItemComponent,
                PaginationPreviousComponent,
                PaginationNextComponent,
                PaginationEllipsisComponent,
            ],
            template: `
                <ui-pagination locale="he">
                    <ui-pagination-content>
                        <ui-pagination-item><ui-pagination-previous /></ui-pagination-item>
                        <ui-pagination-item><ui-pagination-ellipsis /></ui-pagination-item>
                        <ui-pagination-item><ui-pagination-next /></ui-pagination-item>
                    </ui-pagination-content>
                </ui-pagination>
            `,
        })
        class CompositionHost {}

        await TestBed.configureTestingModule({
            imports: [CompositionHost],
        }).compileComponents();
        const fixture = TestBed.createComponent(CompositionHost);
        fixture.detectChanges();

        const nav = fixture.debugElement.query(By.css('[data-slot="pagination"]'));
        expect(nav.attributes['aria-label']).toBe('ניווט עמודים');
        expect(nav.attributes['dir']).toBe('rtl');

        const prev = fixture.debugElement.query(By.css('[data-slot="pagination-previous"]')).nativeElement.textContent;
        const next = fixture.debugElement.query(By.css('[data-slot="pagination-next"]')).nativeElement.textContent;
        const more = fixture.debugElement.query(By.css('[data-slot="pagination-ellipsis"]')).nativeElement.textContent;
        expect(prev).toContain('הקודם');
        expect(next).toContain('הבא');
        expect(more).toContain('עוד עמודים');
    });

    it('a global provideUiLocale propagates to ALL sub-components without per-instance locale wiring', async () => {
        const { provideUiLocale } = await import('../../lib/i18n');

        @Component({
            standalone: true,
            imports: [
                PaginationComponent,
                PaginationContentComponent,
                PaginationItemComponent,
                PaginationPreviousComponent,
                PaginationNextComponent,
                PaginationEllipsisComponent,
            ],
            template: `
                <ui-pagination>
                    <ui-pagination-content>
                        <ui-pagination-item><ui-pagination-previous /></ui-pagination-item>
                        <ui-pagination-item><ui-pagination-ellipsis /></ui-pagination-item>
                        <ui-pagination-item><ui-pagination-next /></ui-pagination-item>
                    </ui-pagination-content>
                </ui-pagination>
            `,
        })
        class GlobalHost {}

        await TestBed.configureTestingModule({
            imports: [GlobalHost],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const fixture = TestBed.createComponent(GlobalHost);
        fixture.detectChanges();

        expect(fixture.debugElement.query(By.css('[data-slot="pagination-previous"]')).nativeElement.textContent).toContain('הקודם');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-next"]')).nativeElement.textContent).toContain('הבא');
        expect(fixture.debugElement.query(By.css('[data-slot="pagination-ellipsis"]')).nativeElement.textContent).toContain('עוד עמודים');
    });
});
