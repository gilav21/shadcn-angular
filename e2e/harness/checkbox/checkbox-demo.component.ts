import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CheckboxComponent } from '@/components/ui/checkbox';

@Component({
    selector: 'app-checkbox-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CheckboxComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-checkbox
                data-testid="cb"
                [checked]="checked()"
                (checkedChange)="checked.set($event)"
                label="Accept terms"
            />
            <p data-testid="state">{{ checked() ? 'checked' : 'unchecked' }}</p>
        </main>
    `,
})
export class CheckboxDemoComponent {
    protected readonly checked = signal(false);
}
