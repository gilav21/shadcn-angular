import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SliderComponent } from '@/components/ui/slider';

/**
 * An uncontrolled slider seeded from `[defaultValue]`, reporting through
 * `(valueChange)`. The seed is deliberately not `0`: `0` is also the model's
 * initial value, so a harness seeded with it cannot tell a working default
 * from an ignored one. (The slider is also a ControlValueAccessor; this
 * harness exercises the uncontrolled path.)
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
                [defaultValue]="40"
                ariaLabel="Volume"
                (valueChange)="value.set($event)"
                class="w-full sm:w-[300px]"
            />
            <p data-testid="value">{{ value() }}</p>
        </main>
    `,
})
export class SliderDemoComponent {
    protected readonly value = signal<number | null>(null);
}
