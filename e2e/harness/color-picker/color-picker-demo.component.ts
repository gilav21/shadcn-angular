import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ColorPickerComponent } from '@/components/ui/color-picker';

@Component({
    selector: 'app-color-picker-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ColorPickerComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-color-picker
                data-testid="root"
                [ngModel]="color()"
                (ngModelChange)="color.set($event)"
                [presets]="presets"
                [alpha]="true"
                [enableEyedropper]="true"
                [enableImagePick]="true"
                [showHarmonies]="true"
                [showContrast]="true"
                [formats]="['hex', 'rgb', 'hsl', 'oklch']"
            />
            <p data-testid="value">{{ color() }}</p>
        </main>
    `,
})
export class ColorPickerDemoComponent {
    readonly color = signal('#3b82f6');
    readonly presets = ['#ef4444', '#22c55e', '#3b82f6'];
}
