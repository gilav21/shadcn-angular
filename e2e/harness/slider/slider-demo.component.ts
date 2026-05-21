import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SliderComponent } from '@/components/ui/slider';

/**
 * Note: SliderComponent emits via a `(valueChange)` output, NOT
 * ControlValueAccessor / ngModel. Bind to the output directly.
 */
@Component({
    selector: 'app-slider-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SliderComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-slider
                [min]="0"
                [max]="100"
                [step]="1"
                [defaultValue]="0"
                (valueChange)="value.set($event)"
                class="w-[300px]"
            />
            <p data-testid="value">{{ value() }}</p>
        </main>
    `,
})
export class SliderDemoComponent {
    protected readonly value = signal(0);
}
