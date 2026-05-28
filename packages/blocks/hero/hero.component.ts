import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { cn } from '../../components/lib/utils';
import { ButtonComponent } from '../../components/ui/button';
import { BadgeComponent } from '../../components/ui/badge';

@Component({
  selector: 'ui-hero-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, BadgeComponent],
  templateUrl: './hero.component.html',
  host: { class: 'block' },
})
export class HeroBlockComponent {
  readonly class = input('');
  readonly eyebrow = input('New');
  readonly headline = input('Build beautiful apps faster');
  readonly description = input(
    'A set of accessible, customizable Angular components you can copy into your project and own.',
  );
  readonly primaryCta = input('Get started');
  readonly secondaryCta = input('Learn more');

  readonly primaryClick = output<void>();
  readonly secondaryClick = output<void>();

  readonly classes = computed(() =>
    cn('mx-auto max-w-3xl px-4 py-16 text-center sm:py-24', this.class()),
  );
}
