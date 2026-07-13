import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@/components/ui/icon';

/**
 * Auto-generated harness for the `icon` component.
 * Extend the template and assertions in `icon.spec.ts` as needed.
 */
@Component({
    selector: 'app-icon-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IconComponent],
    template: `
        <main class="p-8">
            <ui-icon data-testid="root"></ui-icon>
        </main>
    `,
})
export class IconDemoComponent {}
