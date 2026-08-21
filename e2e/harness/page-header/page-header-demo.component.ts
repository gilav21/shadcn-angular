import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@/components/ui/page-header';

/**
 * Harness for the `page-header` component: the generated heading block, a
 * projected action, and the `headingLevel` override.
 */
@Component({
    selector: 'app-page-header-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PageHeaderComponent],
    template: `
        <main class="p-8">
            <ui-page-header
                data-testid="root"
                title="Invoices"
                description="Everything billed this quarter."
            >
                <button type="button" data-testid="action">New invoice</button>
            </ui-page-header>

            <ui-page-header data-testid="level-two" title="Team members" [headingLevel]="2" />
        </main>
    `,
})
export class PageHeaderDemoComponent {}
