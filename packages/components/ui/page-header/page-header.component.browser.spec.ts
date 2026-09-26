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

    /*
     * Measured at a desktop viewport: below 640px the row stacks with
     * items-start, the heading block shrink-wraps to the unbroken word and the
     * title overflows the header — a known bug this test does not cover.
     */
    it('wraps an extremely long unbroken title instead of overflowing', async () => {
        const [width, height] = [globalThis.innerWidth, globalThis.innerHeight];
        await page.viewport(1024, 768);
        try {
            host.style.width = '200px';
            fixture.componentRef.setInput('title', 'x'.repeat(300));
            fixture.detectChanges();
            const title = part('title');
            expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
            expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(host.getBoundingClientRect().right);
        } finally {
            await page.viewport(width, height);
        }
    });

    it('keeps the title block shrinkable so long text cannot push the actions off-screen', () => {
        expect(getComputedStyle(part('heading-block')).minWidth).toBe('0px');
    });

    it('spaces a projected breadcrumb above the title', () => {
        const projected = TestBed.createComponent(ProjectedHostComponent);
        projected.detectChanges();
        const header = projected.debugElement.query(By.directive(PageHeaderComponent)).nativeElement as HTMLElement;
        const slot = header.querySelector<HTMLElement>('[data-slot="page-header-breadcrumb"]')!;
        const title = header.querySelector<HTMLElement>('[data-slot="page-header-title"]')!;

        expect(title.getBoundingClientRect().top).toBeGreaterThan(slot.getBoundingClientRect().bottom);
        projected.destroy();
    });
});
