import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CalendarComponent } from '@/components/ui/calendar';

/**
 * Auto-generated harness for the `calendar` component.
 * Extend the template and assertions in `calendar.spec.ts` as needed.
 */
@Component({
    selector: 'app-calendar-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CalendarComponent],
    template: `
        <main class="p-8">
            <ui-calendar data-testid="root"></ui-calendar>
        </main>
    `,
})
export class CalendarDemoComponent {}
