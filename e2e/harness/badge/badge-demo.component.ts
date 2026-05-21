import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BadgeComponent } from '@/components/ui/badge';

@Component({
    selector: 'app-badge-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent],
    template: `
        <main class="p-8 space-y-4">
            <ui-badge data-testid="default">Default</ui-badge>
            <ui-badge data-testid="destructive" variant="destructive">Destructive</ui-badge>
            <ui-badge data-testid="outline" variant="outline">Outline</ui-badge>
        </main>
    `,
})
export class BadgeDemoComponent {}
