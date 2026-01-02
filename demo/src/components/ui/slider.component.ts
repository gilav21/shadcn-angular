import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    ElementRef,
    inject,
    HostListener,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-slider',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'slider'">
      <!-- Track -->
      <div class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
        <!-- Range (filled portion) -->
        <div
          class="absolute h-full bg-primary"
          [style.width.%]="percentage()"
        ></div>
      </div>
      <!-- Thumb -->
      <div
        class="absolute block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
        [style.left.%]="percentage()"
        [style.transform]="'translateX(-50%)'"
        tabindex="0"
        role="slider"
        [attr.aria-valuenow]="value()"
        [attr.aria-valuemin]="min()"
        [attr.aria-valuemax]="max()"
        [attr.aria-disabled]="disabled()"
        (mousedown)="onMouseDown($event)"
        (keydown)="onKeyDown($event)"
      ></div>
    </div>
  `,
    host: {
        class: 'contents',
    },
})
export class SliderComponent {
    private el = inject(ElementRef);

    min = input(0);
    max = input(100);
    step = input(1);
    disabled = input(false);
    defaultValue = input(0);
    class = input('');
    valueChange = output<number>();

    value = signal(0);

    constructor() {
        // Initialize with default value
        const defaultVal = this.defaultValue();
        if (defaultVal !== undefined) {
            this.value.set(defaultVal);
        }
    }

    percentage = computed(() => {
        const min = this.min();
        const max = this.max();
        const val = this.value();
        return ((val - min) / (max - min)) * 100;
    });

    classes = computed(() =>
        cn(
            'relative flex w-full touch-none select-none items-center',
            this.disabled() && 'opacity-50 pointer-events-none',
            this.class()
        )
    );

    onMouseDown(event: MouseEvent) {
        if (this.disabled()) return;

        event.preventDefault();
        this.updateValueFromEvent(event);

        const onMouseMove = (e: MouseEvent) => {
            this.updateValueFromEvent(e);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    onKeyDown(event: KeyboardEvent) {
        if (this.disabled()) return;

        const step = this.step();
        const min = this.min();
        const max = this.max();
        let newValue = this.value();

        switch (event.key) {
            case 'ArrowRight':
            case 'ArrowUp':
                newValue = Math.min(max, newValue + step);
                event.preventDefault();
                break;
            case 'ArrowLeft':
            case 'ArrowDown':
                newValue = Math.max(min, newValue - step);
                event.preventDefault();
                break;
            case 'Home':
                newValue = min;
                event.preventDefault();
                break;
            case 'End':
                newValue = max;
                event.preventDefault();
                break;
        }

        if (newValue !== this.value()) {
            this.value.set(newValue);
            this.valueChange.emit(newValue);
        }
    }

    private updateValueFromEvent(event: MouseEvent) {
        const track = this.el.nativeElement.querySelector('[data-slot="slider"]');
        if (!track) return;

        const rect = track.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const min = this.min();
        const max = this.max();
        const step = this.step();

        let newValue = min + percent * (max - min);
        newValue = Math.round(newValue / step) * step;
        newValue = Math.max(min, Math.min(max, newValue));

        this.value.set(newValue);
        this.valueChange.emit(newValue);
    }
}
