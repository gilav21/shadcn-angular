import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { BreadcrumbComponent } from '../breadcrumb';
import { ButtonComponent } from '../button';
import { PageHeaderComponent } from './page-header.component';

/** Host projecting both a breadcrumb and action buttons — the full UC-7/UC-8 shape. */
@Component({
    template: `
        <ui-page-header title="Invoices" description="Everything billed this quarter.">
            <ui-breadcrumb>
                <span data-testid="crumb">Home</span>
            </ui-breadcrumb>
            <ui-button data-testid="action" label="New invoice" />
        </ui-page-header>
    `,
    imports: [PageHeaderComponent, BreadcrumbComponent, ButtonComponent],
})
class ProjectedHostComponent {}

describe('PageHeaderComponent', () => {
    let fixture: ComponentFixture<PageHeaderComponent>;
    let host: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageHeaderComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PageHeaderComponent);
        host = fixture.nativeElement as HTMLElement;
        fixture.componentRef.setInput('title', 'Invoices');
        fixture.componentRef.setInput('description', 'Everything billed this quarter.');
        fixture.detectChanges();
    });

    // T-6 — UC-6
    describe('T-6: renders title and description', () => {
        it('renders the title text', () => {
            expect(host.querySelector('[data-slot="page-header-title"]')?.textContent?.trim()).toBe('Invoices');
        });

        it('renders the description text', () => {
            expect(host.querySelector('[data-slot="page-header-description"]')?.textContent?.trim()).toBe(
                'Everything billed this quarter.'
            );
        });

        it('omits the description element when no description is given', () => {
            fixture.componentRef.setInput('description', '');
            fixture.detectChanges();
            expect(host.querySelector('[data-slot="page-header-description"]')).toBeNull();
        });

        it('omits the heading element when no title is given', () => {
            fixture.componentRef.setInput('title', '');
            fixture.detectChanges();
            expect(host.querySelector('[data-slot="page-header-title"]')).toBeNull();
        });

        it('exposes a data-slot hook and merges the class input', () => {
            expect(host.dataset['slot']).toBe('page-header');
            fixture.componentRef.setInput('class', 'custom-header-class');
            fixture.detectChanges();
            expect(host.className).toContain('custom-header-class');
        });
    });

    // T-7 — UC-7
    describe('T-7: actions wrap below title at 640px', () => {
        it('stacks below the 640px breakpoint and rows above it', () => {
            const row = host.querySelector<HTMLElement>('[data-slot="page-header-row"]');
            expect(row).not.toBeNull();
            // UC-7 states the rule in viewport terms, so the viewport rule stays.
            expect(row?.className).toContain('max-sm:flex-col');
        });

        it('end-aligns the actions on the desktop row', () => {
            const row = host.querySelector<HTMLElement>('[data-slot="page-header-row"]');
            expect(row?.className).toContain('justify-between');
        });

        it('computes the flex direction the 640px breakpoint dictates', () => {
            const row = host.querySelector<HTMLElement>('[data-slot="page-header-row"]');
            const isDesktop = globalThis.matchMedia('(min-width: 640px)').matches;
            expect(globalThis.getComputedStyle(row!).flexDirection).toBe(isDesktop ? 'row' : 'column');
        });

        it('lets the actions container wrap its own children', () => {
            const actions = host.querySelector<HTMLElement>('[data-slot="page-header-actions"]');
            expect(actions).not.toBeNull();
            expect(actions?.className).toContain('flex-wrap');
        });

        /*
         * The assertion that was missing, and that let a visibly broken demo
         * ship green.
         *
         * Every other test here checks the class *string*, which is a proxy
         * rather than an outcome: `sm:flex-row` asks about the WINDOW, so a
         * header squeezed into a narrow container — a split pane, a dialog, a
         * sidebar-narrowed page — kept the wide layout and jammed the actions
         * against a title broken mid-word. The class assertions stayed green
         * the whole time, because the classes were exactly as written.
         *
         * This asserts *resolved* style rather than geometry, and that choice
         * was forced by measurement. Two geometric versions of this test were
         * written first and both passed against the broken markup: this
         * runner's own window is under 640px, so the old `flex-col` stacked
         * the actions for the wrong reason and no container width could tell
         * a working container rule from a broken one. `flex-wrap` is the
         * mechanism that makes narrowness of the CONTAINER sufficient, and it
         * resolves the same whatever the window is doing.
         */
        it('wraps on container width, not just on window width', () => {
            const row = host.querySelector<HTMLElement>('[data-slot="page-header-row"]')!;
            const heading = host.querySelector<HTMLElement>('[data-slot="page-header-heading-block"]')!;

            expect(globalThis.getComputedStyle(row).flexWrap).toBe('wrap');
            // A basis the title holds onto, so the actions give up the line first.
            expect(globalThis.getComputedStyle(heading).flexBasis).not.toBe('auto');
        });
    });

    // T-8 (negative half) — UC-8: no breadcrumb projected must cost no space
    describe('T-8: breadcrumb slot collapses when nothing is projected', () => {
        it('takes no vertical space at all with no projected breadcrumb', () => {
            const slot = host.querySelector<HTMLElement>('[data-slot="page-header-breadcrumb"]');
            expect(slot).not.toBeNull();

            const style = globalThis.getComputedStyle(slot!);
            expect(style.display).toBe('none');
            expect(slot!.getBoundingClientRect().height).toBe(0);
        });

        it('puts the heading flush against the top of the header', () => {
            const title = host.querySelector<HTMLElement>('[data-slot="page-header-title"]');
            expect(title!.getBoundingClientRect().top).toBe(host.getBoundingClientRect().top);
        });
    });

    // T-9 — UC-9
    describe('T-9: renders h1 by default and honours headingLevel', () => {
        it('renders an h1 by default', () => {
            expect(host.querySelector('[data-slot="page-header-title"]')?.tagName).toBe('H1');
            expect(fixture.componentInstance.headingLevel()).toBe(1);
        });

        it('renders the requested heading level', () => {
            for (const level of [2, 3, 4, 5, 6] as const) {
                fixture.componentRef.setInput('headingLevel', level);
                fixture.detectChanges();
                expect(host.querySelector('[data-slot="page-header-title"]')?.tagName).toBe(`H${level}`);
            }
        });

        it('keeps the same visual size regardless of the semantic level', () => {
            const atLevel1 = host.querySelector<HTMLElement>('[data-slot="page-header-title"]')?.className;
            fixture.componentRef.setInput('headingLevel', 4);
            fixture.detectChanges();
            const atLevel4 = host.querySelector<HTMLElement>('[data-slot="page-header-title"]')?.className;
            expect(atLevel4).toBe(atLevel1);
        });
    });

    // Edge cases — 2.2
    describe('edge cases', () => {
        it('wraps an extremely long unbroken title instead of overflowing', () => {
            fixture.componentRef.setInput('title', 'x'.repeat(300));
            fixture.detectChanges();
            const title = host.querySelector<HTMLElement>('[data-slot="page-header-title"]');
            expect(title?.className).toContain('break-words');
        });

        it('keeps the title block shrinkable so long text cannot push the actions off-screen', () => {
            const block = host.querySelector<HTMLElement>('[data-slot="page-header-heading-block"]');
            expect(block?.className).toContain('min-w-0');
        });
    });
});

// T-8 — UC-8
describe('PageHeaderComponent projection (T-8)', () => {
    it('renders a projected breadcrumb above the title, in its own spaced slot', async () => {
        await TestBed.configureTestingModule({
            imports: [ProjectedHostComponent],
        }).compileComponents();

        const fixture = TestBed.createComponent(ProjectedHostComponent);
        fixture.detectChanges();

        const header = fixture.debugElement.query(By.directive(PageHeaderComponent)).nativeElement as HTMLElement;
        const breadcrumbSlot = header.querySelector<HTMLElement>('[data-slot="page-header-breadcrumb"]');
        const title = header.querySelector<HTMLElement>('[data-slot="page-header-title"]');

        expect(breadcrumbSlot).not.toBeNull();
        expect(breadcrumbSlot?.querySelector('[data-testid="crumb"]')).not.toBeNull();
        expect(title).not.toBeNull();
        expect(
            breadcrumbSlot!.compareDocumentPosition(title!) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(breadcrumbSlot?.className).toContain('mb-');
    });

    it('routes non-breadcrumb projected content into the actions slot', async () => {
        await TestBed.configureTestingModule({
            imports: [ProjectedHostComponent],
        }).compileComponents();

        const fixture = TestBed.createComponent(ProjectedHostComponent);
        fixture.detectChanges();

        const header = fixture.debugElement.query(By.directive(PageHeaderComponent)).nativeElement as HTMLElement;
        const actions = header.querySelector<HTMLElement>('[data-slot="page-header-actions"]');
        expect(actions?.querySelector('[data-testid="action"]')).not.toBeNull();
        expect(actions?.querySelector('[data-testid="crumb"]')).toBeNull();
    });
});
