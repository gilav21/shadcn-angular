import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SwitchComponent } from '@/components/ui/switch';

@Component({
    selector: 'app-switch-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SwitchComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-switch
                data-testid="switch"
                [checked]="checked()"
                (checkedChange)="checked.set($event)"
            />
            <p data-testid="state">{{ checked() ? 'on' : 'off' }}</p>
        </main>
    `,
})
export class SwitchDemoComponent {
    protected readonly checked = signal(false);
}
