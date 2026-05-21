import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    RadioGroupComponent,
    RadioGroupItemComponent,
} from '@/components/ui/radio-group';

@Component({
    selector: 'app-radio-group-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RadioGroupComponent,
        RadioGroupItemComponent,
        FormsModule,
    ],
    template: `
        <main class="p-8 space-y-4">
            <ui-radio-group
                data-testid="group"
                [ngModel]="value()"
                (ngModelChange)="value.set($event)"
            >
                <div class="flex items-center space-x-2">
                    <ui-radio-group-item value="a" data-testid="opt-a" id="r-a" />
                    <label for="r-a">Option A</label>
                </div>
                <div class="flex items-center space-x-2">
                    <ui-radio-group-item value="b" data-testid="opt-b" id="r-b" />
                    <label for="r-b">Option B</label>
                </div>
                <div class="flex items-center space-x-2">
                    <ui-radio-group-item value="c" data-testid="opt-c" id="r-c" />
                    <label for="r-c">Option C</label>
                </div>
            </ui-radio-group>
            <p data-testid="picked">{{ value() }}</p>
        </main>
    `,
})
export class RadioGroupDemoComponent {
    protected readonly value = signal('');
}
