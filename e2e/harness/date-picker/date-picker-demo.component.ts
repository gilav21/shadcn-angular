import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '@/components/ui/date-picker';

@Component({
    selector: 'app-date-picker-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePickerComponent, FormsModule],
    template: `
        <main class="p-8 space-y-4">
            <ui-date-picker
                data-testid="picker"
                [ngModel]="value()"
                (ngModelChange)="value.set($event)"
                placeholder="Pick a date"
            />
            <p data-testid="iso">{{ iso() }}</p>
        </main>
    `,
})
export class DatePickerDemoComponent {
    protected readonly value = signal<Date | null>(null);
    // Format as local YYYY-MM-DD (NOT toISOString — that shifts to UTC
    // and would print the day before in any UTC+ timezone).
    protected readonly iso = (): string => {
        const v = this.value();
        if (!v) return '';
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, '0');
        const d = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
}
