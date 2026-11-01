import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TimelineComponent, TimelineItemComponent } from './index';

@Component({
    template: `
        <ui-timeline>
            <ui-timeline-item title="One" />
            <ui-timeline-item title="Two" />
            <ui-timeline-item title="Three" />
        </ui-timeline>
    `,
    imports: [TimelineComponent, TimelineItemComponent],
})
class Host {}

describe('Timeline spacing (browser)', () => {
    it('pads every item except the last, so events are separated by 2rem', () => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const rows = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-slot="timeline-item"]');
        expect(Array.from(rows, r => getComputedStyle(r).paddingBottom)).toEqual(['32px', '32px', '0px']);
    });
});
