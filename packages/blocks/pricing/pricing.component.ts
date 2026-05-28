import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../components/lib/utils';
import { ButtonComponent } from '../../components/ui/button';
import { BadgeComponent } from '../../components/ui/badge';
import { SeparatorComponent } from '../../components/ui/separator';
import { IconComponent } from '../../components/ui/icon';
import {
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
} from '../../components/ui/card';

interface PricingTier {
  readonly name: string;
  readonly price: string;
  readonly period: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly cta: string;
  readonly highlighted: boolean;
  readonly badge?: string;
}

@Component({
  selector: 'ui-pricing-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    BadgeComponent,
    SeparatorComponent,
    IconComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
  ],
  templateUrl: './pricing.component.html',
  host: { class: 'block' },
})
export class PricingBlockComponent {
  readonly class = input('');

  readonly tiers: readonly PricingTier[] = [
    {
      name: 'Free',
      price: '$0',
      period: '/mo',
      description: 'For individuals getting started.',
      features: ['1 project', 'Community support', '1 GB storage'],
      cta: 'Get started',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '$19',
      period: '/mo',
      description: 'For growing teams that need more.',
      features: ['Unlimited projects', 'Priority support', '100 GB storage', 'Advanced analytics'],
      cta: 'Start free trial',
      highlighted: true,
      badge: 'Popular',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large organizations.',
      features: ['SSO & SAML', 'Dedicated support', 'Unlimited storage', 'Audit logs'],
      cta: 'Contact sales',
      highlighted: false,
    },
  ];

  readonly classes = computed(() =>
    cn('p-4 sm:p-6', this.class()),
  );

  cardClasses(tier: PricingTier): string {
    return cn('flex h-full flex-col', tier.highlighted && 'border-primary ring-1 ring-primary');
  }
}
