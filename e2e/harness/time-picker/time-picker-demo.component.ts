import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TimePickerComponent } from '@/components/ui/time-picker';

/**
 * Harness for the `time-picker` component, installed the way a consumer
 * installs it.
 *
 * The locale rows matter here more than in the unit tests: they depend on the
 * browser's own ICU data rather than on anything this library ships, so this
 * is where a claim like "zh-TW puts the meridiem first" is actually proven.
 */
@Component({
    selector: 'app-time-picker-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TimePickerComponent],
    template: `
        <main class="space-y-6 p-8">
            <div data-testid="root">
                <ui-time-picker [(value)]="basic" locale="en-US" ariaLabel="Time" />
                <p data-testid="value">{{ basic() ?? 'empty' }}</p>
            </div>

            <div data-testid="british">
                <ui-time-picker value="21:05" locale="en-GB" ariaLabel="British" />
            </div>

            <div data-testid="arabic">
                <ui-time-picker value="09:05" locale="ar-EG" ariaLabel="Arabic" />
            </div>

            <div data-testid="chinese">
                <ui-time-picker value="21:05" locale="zh-TW" ariaLabel="Chinese" />
            </div>

            <div data-testid="precise">
                <ui-time-picker [(value)]="withSeconds" [withSeconds]="true" locale="en-GB" ariaLabel="Precise" />
                <p data-testid="precise-value">{{ withSeconds() ?? 'empty' }}</p>
            </div>

            <div data-testid="empty">
                <ui-time-picker [(value)]="blank" locale="en-US" ariaLabel="Empty" />
                <p data-testid="empty-value">{{ blank() ?? 'empty' }}</p>
            </div>
        </main>
    `,
})
export class TimePickerDemoComponent {
    readonly basic = signal<string | null>('09:05');
    readonly withSeconds = signal<string | null>('09:05:09');
    readonly blank = signal<string | null>(null);
}
