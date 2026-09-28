import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import {
    PaginationComponent,
    PaginationContentComponent,
    PaginationItemComponent,
    PaginationPreviousComponent,
    PaginationNextComponent,
} from './index';

/** Browser-only: asserts the resolved chevron rotation, which needs real CSS. */
@Component({
    template: `
        <div [dir]="dir()">
            <ui-pagination>
                <ui-pagination-content>
                    <ui-pagination-item><ui-pagination-previous /></ui-pagination-item>
                    <ui-pagination-item><ui-pagination-next /></ui-pagination-item>
                </ui-pagination-content>
            </ui-pagination>
        </div>
    `,
    imports: [PaginationComponent, PaginationContentComponent, PaginationItemComponent, PaginationPreviousComponent, PaginationNextComponent],
})
class DirHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

function chevronRotations(dir: 'ltr' | 'rtl'): string[] {
    const fixture = TestBed.createComponent(DirHost);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return ['pagination-previous', 'pagination-next'].map(slot => {
        const svg = root.querySelector(`[data-slot="${slot}"] svg`) as SVGElement;
        return getComputedStyle(svg).rotate;
    });
}

describe('Pagination (browser layout)', () => {
    it('mirrors both chevrons by 180deg in RTL and leaves them unrotated in LTR', () => {
        expect(chevronRotations('ltr')).toEqual(['none', 'none']);
        expect(chevronRotations('rtl')).toEqual(['180deg', '180deg']);
    });
});
