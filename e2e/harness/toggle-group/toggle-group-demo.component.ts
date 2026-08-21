import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    ToggleGroupComponent,
    ToggleGroupItemComponent,
} from '@/components/ui/toggle-group';

@Component({
    selector: 'app-toggle-group-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ToggleGroupComponent, ToggleGroupItemComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-toggle-group type="single" (valueChange)="picked.set($event)">
                <ui-toggle-group-item value="left" data-testid="item-left">L</ui-toggle-group-item>
                <ui-toggle-group-item value="center" data-testid="item-center">C</ui-toggle-group-item>
                <ui-toggle-group-item value="right" data-testid="item-right">R</ui-toggle-group-item>
            </ui-toggle-group>
            <p data-testid="picked">{{ display() }}</p>
        </main>
    `,
})
export class ToggleGroupDemoComponent {
    /**
     * `undefined` is part of the contract, not defensive padding: `value` is a
     * `model<string | string[] | undefined>` so it can represent an unset
     * signal-forms control, and in `single` mode re-pressing the active item
     * genuinely clears the selection back to `undefined`.
     */
    protected readonly picked = signal<string | string[] | undefined>('');
    protected display(): string {
        const v = this.picked();
        if (v === undefined) return '';
        return Array.isArray(v) ? v.join(',') : v;
    }
}
