import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    TimelineComponent,
    TimelineItemComponent,
    TimelineConnectorComponent,
    TimelineDotComponent,
    TimelineHeaderComponent,
    TimelineContentComponent,
    TimelineTitleComponent,
    TimelineDescriptionComponent,
    TimelineTimeComponent,
} from '@/components/ui/timeline';

/**
 * Auto-generated harness for the `timeline` component.
 * Extend the template and assertions in `timeline.spec.ts` as needed.
 */
@Component({
    selector: 'app-timeline-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TimelineComponent, TimelineItemComponent, TimelineConnectorComponent, TimelineDotComponent, TimelineHeaderComponent, TimelineContentComponent, TimelineTitleComponent, TimelineDescriptionComponent, TimelineTimeComponent],
    template: `
        <main class="p-8">
            <ui-timeline data-testid="root">
                <ui-timeline-item data-testid="timeline-item"></ui-timeline-item>
                <ui-timeline-connector data-testid="timeline-connector"></ui-timeline-connector>
                <ui-timeline-dot data-testid="timeline-dot"></ui-timeline-dot>
                <ui-timeline-header data-testid="timeline-header"></ui-timeline-header>
                <ui-timeline-content data-testid="timeline-content"></ui-timeline-content>
                <ui-timeline-title data-testid="timeline-title"></ui-timeline-title>
                <ui-timeline-description data-testid="timeline-description"></ui-timeline-description>
                <ui-timeline-time data-testid="timeline-time"></ui-timeline-time>
            </ui-timeline>
        </main>
    `,
})
export class TimelineDemoComponent {}
