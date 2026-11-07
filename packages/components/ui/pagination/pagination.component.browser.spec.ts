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

@Component({
    template: `
        <div style="--density: 1.5">
            <ui-pagination [totalPages]="5" [currentPage]="1" />
            <ui-pagination>
                <ui-pagination-content>
                    <ui-pagination-item><ui-pagination-previous [disabled]="true" /></ui-pagination-item>
                    <ui-pagination-item><ui-pagination-next [disabled]="true" /></ui-pagination-item>
                </ui-pagination-content>
            </ui-pagination>
        </div>
    `,
    imports: [PaginationComponent, PaginationContentComponent, PaginationItemComponent, PaginationPreviousComponent, PaginationNextComponent],
})
class DensityHost {}

describe('Pagination density and disabled (browser)', () => {
    it('simple mode scales nav and page buttons with --density', () => {
        const fixture = TestBed.createComponent(DensityHost);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const next = root.querySelector('button[data-slot="pagination-next"]') as HTMLElement;
        const link = root.querySelector('button[data-slot="pagination-link"]') as HTMLElement;
        expect(getComputedStyle(next).height).toBe('54px');
        expect(getComputedStyle(link).width).toBe('54px');
    });

    it('custom-mode previous/next scale height and padding with --density', () => {
        const fixture = TestBed.createComponent(DensityHost);
        fixture.detectChanges();
        const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ui-pagination-previous button, ui-pagination-next button');
        expect(buttons).toHaveLength(2);
        for (const b of Array.from(buttons)) {
            const style = getComputedStyle(b);
            expect([style.height, style.paddingLeft, style.paddingTop]).toEqual(['54px', '24px', '12px']);
        }
    });

    it('custom-mode previous/next are dimmed when disabled', () => {
        const fixture = TestBed.createComponent(DensityHost);
        fixture.detectChanges();
        const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ui-pagination-previous button, ui-pagination-next button');
        for (const b of Array.from(buttons)) {
            expect(getComputedStyle(b).opacity).toBe('0.5');
            expect(getComputedStyle(b).pointerEvents).toBe('none');
        }
    });
});
