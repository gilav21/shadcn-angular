import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BannerComponent } from '@/components/ui/banner';

/**
 * Harness for the `banner` component, exercising the plain-message form, the
 * dismiss control, and the projection override — the three things a consumer
 * install has to get right.
 */
@Component({
    selector: 'app-banner-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BannerComponent],
    template: `
        <main class="p-8">
            <ui-banner
                data-testid="root"
                variant="warning"
                message="Scheduled maintenance at 02:00 UTC."
                dismissible
            />

            <ui-banner data-testid="destructive" variant="destructive" message="Billing failed." />

            <ui-banner data-testid="projected" variant="info" message="ignored input message">
                <span data-testid="projected-content">Trial ends in 3 days.</span>
            </ui-banner>
        </main>
    `,
})
export class BannerDemoComponent {}
