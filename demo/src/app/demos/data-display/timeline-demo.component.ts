import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  TimelineComponent,
  TimelineConnectorComponent,
  TimelineContentComponent,
  TimelineDescriptionComponent,
  TimelineDotComponent,
  TimelineHeaderComponent,
  TimelineItemComponent,
  TimelineTimeComponent,
  TimelineTitleComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-timeline-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TimelineComponent,
    TimelineItemComponent,
    TimelineHeaderComponent,
    TimelineDotComponent,
    TimelineConnectorComponent,
    TimelineContentComponent,
    TimelineTitleComponent,
    TimelineDescriptionComponent,
    TimelineTimeComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="timeline" class="text-2xl font-semibold scroll-m-20">Timeline</h2>
      <p class="text-muted-foreground">
        A vertical list of events with connecting lines and markers.
      </p>

      <ui-timeline>
        <ui-timeline-item>
          <ui-timeline-header>
            <ui-timeline-dot variant="success" />
            <ui-timeline-connector />
          </ui-timeline-header>
          <ui-timeline-content>
            <ui-timeline-title>Version 2.0 Released</ui-timeline-title>
            <ui-timeline-description>Major update with new features and improvements.</ui-timeline-description>
            <ui-timeline-time>January 2024</ui-timeline-time>
          </ui-timeline-content>
        </ui-timeline-item>
        <ui-timeline-item>
          <ui-timeline-header>
            <ui-timeline-dot variant="filled" />
            <ui-timeline-connector />
          </ui-timeline-header>
          <ui-timeline-content>
            <ui-timeline-title>Beta Testing</ui-timeline-title>
            <ui-timeline-description>Started beta testing with early adopters.</ui-timeline-description>
            <ui-timeline-time>December 2023</ui-timeline-time>
          </ui-timeline-content>
        </ui-timeline-item>
        <ui-timeline-item>
          <ui-timeline-header>
            <ui-timeline-dot variant="default" />
          </ui-timeline-header>
          <ui-timeline-content>
            <ui-timeline-title>Project Started</ui-timeline-title>
            <ui-timeline-description>Initial development began.</ui-timeline-description>
            <ui-timeline-time>October 2023</ui-timeline-time>
          </ui-timeline-content>
        </ui-timeline-item>
      </ui-timeline>
    </section>
  `,
})
export class TimelineDemoComponent {}
