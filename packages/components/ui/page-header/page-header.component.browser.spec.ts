import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { BreadcrumbComponent } from '../breadcrumb';
import { ButtonComponent } from '../button';
import { PageHeaderComponent } from './page-header.component';

/**
 * Browser-only page-header cases: resolved style and rendered geometry, which
 * jsdom does not compute.
 */
@Component({
    template: `
        <ui-page-header title="Invoices">
            <ui-breadcrumb>
                <span>Home</span>
            </ui-breadcrumb>
            <ui-button label="New invoice" />
        </ui-page-header>
    `,
    imports: [PageHeaderComponent, BreadcrumbComponent, ButtonComponent],
})
class ProjectedHostComponent {}

describe('PageHeaderComponent (browser layout)', () => {
    let fixture: ComponentFixture<PageHeaderComponent>;
    let host: HTMLElement;

    const part = (slot: string): HTMLElement =>
        host.querySelector<HTMLElement>(`[data-slot="page-header-${slot}"]`)!;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageHeaderComponent, ProjectedHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PageHeaderComponent);
        host = fixture.nativeElement as HTMLElement;
        fixture.componentRef.setInput('title', 'Invoices');
        fixture.detectChanges();
    });

    it('end-aligns the actions on the desktop row', () => {
        expect(getComputedStyle(part('row')).justifyContent).toBe('space-between');
    });

    it('lets the actions container wrap its own children', () => {
        expect(getComputedStyle(part('actions')).flexWrap).toBe('wrap');
    });

    it('keeps the same visual size regardless of the semantic level', () => {
        const size = () => {
            const style = getComputedStyle(part('title'));
            return [style.fontSize, style.lineHeight];
        };
        const atLevel1 = size();
        fixture.componentRef.setInput('headingLevel', 4);
        fixture.detectChanges();
        expect(part('title').tagName).toBe('H4');
        expect(size()).toEqual(atLevel1);
    });

    // The runner's own viewport is below 640px, where the row stacks (max-sm:); 1024px is the desktop row.
    it('wraps an extremely long unbroken title and description inside a narrow header, stacked and on the desktop row', async () => {
        host.style.width = '200px';
        fixture.componentRef.setInput('title', 'x'.repeat(300));
        fixture.componentRef.setInput('description', 'y'.repeat(300));
        fixture.detectChanges();
        const expectContained = () => {
            for (const slot of ['title', 'description']) {
                const text = part(slot);
                expect(text.scrollWidth, slot).toBeLessThanOrEqual(text.clientWidth);
                expect(text.getBoundingClientRect().right, slot).toBeLessThanOrEqual(host.getBoundingClientRect().right);
            }
        };

        expect(globalThis.innerWidth).toBeLessThan(640);
        expectContained();

        const [width, height] = [globalThis.innerWidth, globalThis.innerHeight];
        await page.viewport(1024, 768);
        try {
            expectContained();
        } finally {
            await page.viewport(width, height);
        }
    });

    it('keeps the title block shrinkable so long text cannot push the actions off-screen', () => {
        expect(getComputedStyle(part('heading-block')).minWidth).toBe('0px');
    });

    // The runner's own viewport is below 640px, so the row is stacked here.
    it('spaces a projected breadcrumb above the title and stacks the actions right under the heading', () => {
        const projected = TestBed.createComponent(ProjectedHostComponent);
        projected.detectChanges();
        const header = projected.debugElement.query(By.directive(PageHeaderComponent)).nativeElement as HTMLElement;
        const rect = (slot: string): DOMRect =>
            header.querySelector<HTMLElement>(`[data-slot="page-header-${slot}"]`)!.getBoundingClientRect();
        const title = rect('title');

        expect(title.top).toBeGreaterThan(rect('breadcrumb').bottom);

        expect(globalThis.innerWidth).toBeLessThan(640);
        const heading = rect('heading-block');
        expect(heading.height).toBeCloseTo(title.height, 0);
        const rowGap = Number.parseFloat(getComputedStyle(header.querySelector('[data-slot="page-header-row"]')!).rowGap);
        expect(rect('actions').top - heading.bottom).toBeCloseTo(rowGap, 0);
        projected.destroy();
    });
});
