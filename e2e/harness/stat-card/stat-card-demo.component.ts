import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StatCardComponent } from '@/components/ui/stat-card';

/**
 * Harness for the `stat-card` component.
 *
 * The assertions in `stat-card.spec.ts` target the rendered card rather than the
 * `<ui-stat-card>` element itself: the host is `display: contents` so that
 * `ui-card` stays the real grid item, which means the host has no box of its own
 * and can never be "visible" to Playwright.
 */
@Component({
    selector: 'app-stat-card-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [StatCardComponent],
    template: `
        <main class="p-8">
            <div
                class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                data-testid="grid"
            >
                <ui-stat-card
                    data-testid="up"
                    label="Revenue"
                    value="$45,231"
                    delta="+12.5%"
                    trend="up"
                />
                <ui-stat-card
                    data-testid="down"
                    label="Orders"
                    value="1,210"
                    delta="-3.2%"
                    trend="down"
                />
                <ui-stat-card data-testid="bare" label="Active users" value="2,350" />
                <ui-stat-card
                    data-testid="projected"
                    label="Sessions"
                    value="18,402"
                    delta="0.0%"
                >
                    <svg data-testid="spark" viewBox="0 0 120 32" class="mt-2 h-8 w-full">
                        <path d="M0 26 L60 14 L120 4" fill="none" stroke="currentColor" />
                    </svg>
                </ui-stat-card>
            </div>
        </main>
    `,
})
export class StatCardDemoComponent {}
