import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
} from '@/components/ui/select';

@Component({
    selector: 'app-select-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SelectComponent,
        SelectTriggerComponent,
        SelectValueComponent,
        SelectContentComponent,
        SelectItemComponent,
        FormsModule,
    ],
    template: `
        <main class="p-8 space-y-4">
            <ui-select
                data-testid="select"
                [ngModel]="value()"
                (ngModelChange)="value.set($event)"
            >
                <ui-select-trigger data-testid="trigger" class="w-[200px]">
                    <ui-select-value placeholder="Pick a fruit" />
                </ui-select-trigger>
                <ui-select-content>
                    <ui-select-item value="apple" data-testid="item-apple">Apple</ui-select-item>
                    <ui-select-item value="banana" data-testid="item-banana">Banana</ui-select-item>
                    <ui-select-item value="cherry" data-testid="item-cherry">Cherry</ui-select-item>
                </ui-select-content>
            </ui-select>
            <p data-testid="picked">{{ value() }}</p>
        </main>
    `,
})
export class SelectDemoComponent {
    protected readonly value = signal('');
}
