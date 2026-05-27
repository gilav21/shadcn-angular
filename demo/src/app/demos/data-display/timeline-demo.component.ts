import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TIMELINE_DEMO_LOCALES } from './timeline-demo.locales';

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
      <h2 id="timeline" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-timeline>
        <ui-timeline-item>
          <ui-timeline-header>
            <ui-timeline-dot variant="success" />
            <ui-timeline-connector />
          </ui-timeline-header>
          <ui-timeline-content>
            <ui-timeline-title>{{ t().event1Title }}</ui-timeline-title>
            <ui-timeline-description>{{ t().event1Description }}</ui-timeline-description>
            <ui-timeline-time>{{ t().event1Time }}</ui-timeline-time>
          </ui-timeline-content>
        </ui-timeline-item>
        <ui-timeline-item>
          <ui-timeline-header>
            <ui-timeline-dot variant="filled" />
            <ui-timeline-connector />
          </ui-timeline-header>
          <ui-timeline-content>
            <ui-timeline-title>{{ t().event2Title }}</ui-timeline-title>
            <ui-timeline-description>{{ t().event2Description }}</ui-timeline-description>
            <ui-timeline-time>{{ t().event2Time }}</ui-timeline-time>
          </ui-timeline-content>
        </ui-timeline-item>
        <ui-timeline-item>
          <ui-timeline-header>
            <ui-timeline-dot variant="default" />
          </ui-timeline-header>
          <ui-timeline-content>
            <ui-timeline-title>{{ t().event3Title }}</ui-timeline-title>
            <ui-timeline-description>{{ t().event3Description }}</ui-timeline-description>
            <ui-timeline-time>{{ t().event3Time }}</ui-timeline-time>
          </ui-timeline-content>
        </ui-timeline-item>
      </ui-timeline>
    </section>
  `,
})
export class TimelineDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => TIMELINE_DEMO_LOCALES[this.localeId()] ?? TIMELINE_DEMO_LOCALES['en']);
}
