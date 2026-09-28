import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { StatCardComponent, type StatCardTrend } from './index';

/** Browser-only: the badge spacing is asserted as computed style, which jsdom cannot resolve. */
@Component({
    template: `
        <ui-stat-card
            label="Total Revenue"
            value="$45,231.89"
            delta="+20.1%"
            [trend]="trend()"
            [trendIcon]="trendIcon()"
        />
    `,
    imports: [StatCardComponent],
})
class Host {
    readonly trend = signal<StatCardTrend>('up');
    readonly trendIcon = signal(true);
}

describe('StatCardComponent badge spacing (browser)', () => {
    it('spaces the badge only while an arrow is drawn', () => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const badge = (): HTMLElement => fixture.nativeElement.querySelector('[data-slot="badge"]');
        expect(getComputedStyle(badge()).columnGap).toBe('4px');

        fixture.componentInstance.trendIcon.set(false);
        fixture.detectChanges();
        expect(['normal', '0px']).toContain(getComputedStyle(badge()).columnGap);
    });
});
