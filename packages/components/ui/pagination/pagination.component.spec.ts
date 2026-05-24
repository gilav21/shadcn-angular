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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Basic test host
@Component({
    template: `
        <ui-pagination>
            <ui-pagination-content>
                <ui-pagination-item>
                    <ui-pagination-previous (click)="onPrevious($event)" />
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
                    <ui-pagination-next (click)="onNext($event)" />
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

    onPrevious(event: MouseEvent) {
        if (this.currentPage() > 1) {
            this.currentPage.update(p => p - 1);
        }
    }

    onNext(event: MouseEvent) {
        if (this.currentPage() < 10) {
            this.currentPage.update(p => p + 1);
        }
    }
}

// RTL test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-pagination>
                <ui-pagination-content>
                    <ui-pagination-item>
                        <ui-pagination-previous />
                    </ui-pagination-item>
                    <ui-pagination-item>
                        <ui-pagination-link [isActive]="true">1</ui-pagination-link>
                    </ui-pagination-item>
                    <ui-pagination-item>
                        <ui-pagination-link>2</ui-pagination-link>
                    </ui-pagination-item>
                    <ui-pagination-item>
                        <ui-pagination-next />
                    </ui-pagination-item>
                </ui-pagination-content>
            </ui-pagination>
        </div>
    `,
    imports: [PaginationComponent, PaginationContentComponent, PaginationItemComponent, PaginationLinkComponent, PaginationPreviousComponent, PaginationNextComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('PaginationComponent', () => {
    let component: PaginationComponent;
    let fixture: ComponentFixture<PaginationComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PaginationComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PaginationComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have role="navigation"', () => {
        const nav = fixture.nativeElement.querySelector('[role="navigation"]');
        expect(nav).toBeTruthy();
    });

    it('should have aria-label="pagination"', () => {
        const nav = fixture.nativeElement.querySelector('[aria-label="pagination"]');
        expect(nav).toBeTruthy();
    });

    it('should have data-slot="pagination"', () => {
        const nav = fixture.nativeElement.querySelector('[data-slot="pagination"]');
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

    it('should render pagination content', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="pagination-content"]'));
        expect(content).toBeTruthy();
    });

    it('should render pagination items', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="pagination-item"]'));
        expect(items.length).toBe(6);
    });

    it('should render pagination links', () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="pagination-link"]'));
        expect(links.length).toBe(3);
    });

    it('should render previous button', () => {
        const prev = fixture.debugElement.query(By.css('[data-slot="pagination-previous"]'));
        expect(prev).toBeTruthy();
    });

    it('should render next button', () => {
        const next = fixture.debugElement.query(By.css('[data-slot="pagination-next"]'));
        expect(next).toBeTruthy();
    });

    it('should render ellipsis', () => {
        const ellipsis = fixture.debugElement.query(By.css('[data-slot="pagination-ellipsis"]'));
        expect(ellipsis).toBeTruthy();
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

    it('should change page on link click', async () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="pagination-link"]'));
        links[1].nativeElement.click(); // Click page 2
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.currentPage()).toBe(2);
    });

    it('should go to next page on next click', async () => {
        const next = fixture.debugElement.query(By.css('[data-slot="pagination-next"]'));
        next.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.currentPage()).toBe(2);
    });

    it('should go to previous page on previous click', async () => {
        component.currentPage.set(3);
        fixture.detectChanges();

        const prev = fixture.debugElement.query(By.css('[data-slot="pagination-previous"]'));
        prev.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.currentPage()).toBe(2);
    });

    it('should have screen reader text in ellipsis', () => {
        const ellipsis = fixture.debugElement.query(By.css('[data-slot="pagination-ellipsis"]'));
        const srOnly = ellipsis.nativeElement.querySelector('.sr-only');
        expect(srOnly.textContent).toContain('More pages');
    });
});

describe('Pagination RTL Support', () => {
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
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should have rtl:rotate-180 class on previous arrow', () => {
        const prev = fixture.debugElement.query(By.css('[data-slot="pagination-previous"]'));
        const svg = prev.nativeElement.querySelector('svg');
        const svgClass = svg.getAttribute('class') || '';
        expect(svgClass).toContain('rtl:rotate-180');
    });

    it('should have rtl:rotate-180 class on next arrow', () => {
        const next = fixture.debugElement.query(By.css('[data-slot="pagination-next"]'));
        const svg = next.nativeElement.querySelector('svg');
        const svgClass = svg.getAttribute('class') || '';
        expect(svgClass).toContain('rtl:rotate-180');
    });

    it('should display pagination links in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const links = fixture.debugElement.queryAll(By.css('[data-slot="pagination-link"]'));
        expect(links.length).toBe(2);
    });

    it('should have active state in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const activePage = fixture.debugElement.query(By.css('[aria-current="page"]'));
        expect(activePage).toBeTruthy();
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

    it('should render pagination content automatically', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="pagination-content"]'));
        expect(content).toBeTruthy();
    });

    it('should render previous and next buttons', () => {
        const prev = fixture.debugElement.query(By.css('[data-slot="pagination-previous"]'));
        const next = fixture.debugElement.query(By.css('[data-slot="pagination-next"]'));
        expect(prev).toBeTruthy();
        expect(next).toBeTruthy();
    });

    it('should render page number buttons', () => {
        const links = fixture.debugElement.queryAll(By.css('[data-slot="pagination-link"]'));
        expect(links.length).toBeGreaterThan(0);
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

    it('should render ellipsis for large page counts', () => {
        component.currentPage.set(5);
        fixture.detectChanges();

        const ellipsis = fixture.debugElement.queryAll(By.css('[data-slot="pagination-ellipsis"]'));
        expect(ellipsis.length).toBeGreaterThan(0);
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

    it('does NOT auto-propagate the parent locale to projected sub-components (each level resolves independently)', async () => {
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
        expect(prev).toContain('Previous');
        expect(next).toContain('Next');
        expect(more).toContain('More pages');
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
