import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { PricingBlockComponent, type PricingTier } from '@/blocks/pricing';

/** Harness for the `pricing` block — records which plan's CTA was clicked. */
@Component({
    selector: 'app-pricing-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PricingBlockComponent],
    template: `
        <main class="p-8">
            <ui-pricing-block data-testid="root" (ctaClicked)="onCta($event)" />
            <p data-testid="cta-count">{{ count() }}</p>
            @if (picked(); as p) {
                <p data-testid="picked">{{ p }}</p>
            }
        </main>
    `,
})
export class PricingDemoComponent {
    protected readonly picked = signal('');
    protected readonly count = signal(0);

    protected onCta(tier: PricingTier): void {
        this.count.update(n => n + 1);
        this.picked.set(`${tier.name}|${tier.price}`);
    }
}
