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
        <ui-timeline>
            <ui-timeline-item title="Only" />
        </ui-timeline>
        <ui-timeline>
            <ui-timeline-item title="First" />
            <ui-timeline-item title="Last" />
            <button type="button">Load more</button>
        </ui-timeline>
    `,
    imports: [TimelineComponent, TimelineItemComponent],
})
class Host {}

describe('Timeline spacing (browser)', () => {
    it('pads every item except the last item, so events are separated by 2rem even with a trailing non-item sibling', () => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const timelines = (fixture.nativeElement as HTMLElement).querySelectorAll('ui-timeline');
        const paddings = Array.from(timelines, t =>
            Array.from(t.querySelectorAll<HTMLElement>('[data-slot="timeline-item"]'), r => getComputedStyle(r).paddingBottom));
        expect(paddings).toEqual([['32px', '32px', '0px'], ['0px'], ['32px', '0px']]);
    });
});
