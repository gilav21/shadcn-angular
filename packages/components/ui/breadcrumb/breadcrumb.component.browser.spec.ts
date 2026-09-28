import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { BreadcrumbComponent, BreadcrumbListComponent, BreadcrumbItemComponent, BreadcrumbLinkComponent, BreadcrumbPageComponent, BreadcrumbSeparatorComponent } from './index';

/** Browser-only: the separator's RTL mirroring is asserted as resolved rotation, which jsdom cannot compute. */
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
class DirHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

/** The element's resolved rotation in degrees, whether it comes from `rotate` or `transform`. */
function rotationOf(el: Element): number {
    const style = getComputedStyle(el);
    if (style.rotate && style.rotate !== 'none') return Number.parseFloat(style.rotate);
    if (style.transform === 'none') return 0;
    const m = new DOMMatrix(style.transform);
    return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
}

describe('Breadcrumb separator direction (browser)', () => {
    it('points the chevron the other way under dir="rtl" only', () => {
        const fixture = TestBed.createComponent(DirHost);
        fixture.detectChanges();
        const svg = (): SVGElement => fixture.nativeElement.querySelector('[data-slot="breadcrumb-separator"] svg');
        expect(rotationOf(svg())).toBe(0);

        fixture.componentInstance.dir.set('rtl');
        fixture.detectChanges();
        expect(Math.abs(rotationOf(svg()))).toBe(180);
    });
});
