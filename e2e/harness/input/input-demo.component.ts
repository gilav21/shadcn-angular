import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@/components/ui/input';

@Component({
    selector: 'app-input-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [InputComponent, FormsModule],
    template: `
        <main class="p-8 space-y-4">
            <ui-input
                data-testid="input"
                [ngModel]="value()"
                (ngModelChange)="value.set($event)"
                placeholder="Type here"
            />
            <p data-testid="echo">{{ value() }}</p>
        </main>
    `,
})
export class InputDemoComponent {
    protected readonly value = signal('');
}
