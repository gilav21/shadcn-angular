import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { BreadcrumbComponent } from '../breadcrumb';
import { ButtonComponent } from '../button';
import { PageHeaderComponent } from './page-header.component';

/** Every CSS rule in the document, flattened through `@layer` / `@media` groups. */
function allCssRules(): CSSRule[] {
    const out: CSSRule[] = [];
    const visit = (rules: CSSRuleList): void => {
        for (const rule of rules) {
            out.push(rule);
            const nested = (rule as CSSGroupingRule).cssRules;
            if (nested) visit(nested);
        }
    };
    for (const sheet of document.styleSheets) {
        try {
            visit(sheet.cssRules);
        } catch {
            // Cross-origin sheet — not ours, and not readable.
        }
    }
    return out;
}

/** True when the loaded CSS really defines `flex-direction: row` behind the 640px breakpoint. */
function hasSmBreakpointRowRule(): boolean {
    const isSmBreakpoint = (condition: string): boolean =>
        condition.includes('640px') || condition.includes('40rem');

    return allCssRules().some(
        (rule) =>
            rule instanceof CSSMediaRule &&
            isSmBreakpoint(rule.conditionText) &&
            [...rule.cssRules].some((inner) => /flex-direction:\s*row/.test(inner.cssText))
    );
}

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
        it('stacks the title block and the actions below 640px, and rows them from sm up', () => {
            const row = host.querySelector<HTMLElement>('[data-slot="page-header-row"]');
            expect(row).not.toBeNull();
            expect(row?.className).toContain('flex-col');
            expect(row?.className).toContain('sm:flex-row');
        });

        it('end-aligns the actions on the desktop row', () => {
            const row = host.querySelector<HTMLElement>('[data-slot="page-header-row"]');
            expect(row?.className).toContain('sm:justify-between');
        });

        it('lets the actions container wrap its own children', () => {
            const actions = host.querySelector<HTMLElement>('[data-slot="page-header-actions"]');
            expect(actions).not.toBeNull();
            expect(actions?.className).toContain('flex-wrap');
        });

        // The `sm:` variant is a viewport media query, so an element-level width
        // cannot exercise it. Assert the real computed direction against what the
        // runner's own viewport dictates — that proves the element follows the
        // breakpoint rather than merely carrying the class name.
        it('computes the flex direction the 640px breakpoint dictates', () => {
            const row = host.querySelector<HTMLElement>('[data-slot="page-header-row"]');
            const isDesktop = globalThis.matchMedia('(min-width: 640px)').matches;
            expect(globalThis.getComputedStyle(row!).flexDirection).toBe(isDesktop ? 'row' : 'column');
        });

        // Evidence for the state the runner's viewport is NOT in: the stylesheet
        // must actually carry an `sm` breakpoint media rule that flips the row
        // back to a row. Tailwind v4 nests utilities inside `@layer` blocks and
        // writes the condition in `rem`, so walk grouping rules and accept either
        // spelling of the 640px breakpoint.
        it('ships an sm-breakpoint media rule that switches the row to a row', () => {
            expect(hasSmBreakpointRowRule()).toBe(true);
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
