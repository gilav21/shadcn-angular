import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../components/lib/utils';
import { IconComponent, IconName } from '../../components/ui/icon';
import { CardComponent, CardContentComponent } from '../../components/ui/card';

export interface Feature {
  icon: IconName;
  title: string;
  description: string;
}

@Component({
  selector: 'ui-features-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, CardComponent, CardContentComponent],
  templateUrl: './features.component.html',
  host: { class: 'block' },
})
export class FeaturesBlockComponent {
  readonly class = input('');

  readonly heading = input('Everything you need');
  readonly subheading = input(
    'Production-ready components, designed to be copied into your project and fully owned.',
  );

  readonly features = input<Feature[]>([
    {
      icon: 'zap',
      title: 'Blazing fast',
      description: 'Ship interfaces that feel instant with components built for performance.',
    },
    {
      icon: 'shield-check',
      title: 'Accessible by default',
      description: 'Every component follows ARIA patterns and keyboard navigation out of the box.',
    },
    {
      icon: 'palette',
      title: 'Fully themeable',
      description: 'Design tokens and CSS variables let you match any brand in minutes.',
    },
    {
      icon: 'code',
      title: 'You own the code',
      description: 'Copy the source straight into your project and customize without limits.',
    },
    {
      icon: 'sparkles',
      title: 'Polished details',
      description: 'Thoughtful states, transitions, and microinteractions in every component.',
    },
    {
      icon: 'rocket',
      title: 'Ready to ship',
      description: 'Battle-tested building blocks that take you from prototype to production.',
    },
  ]);

  readonly classes = computed(() =>
    cn('mx-auto max-w-6xl px-4 py-16 sm:py-24', this.class()),
  );
}
