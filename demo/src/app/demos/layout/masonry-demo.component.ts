import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonComponent, MasonryComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { MASONRY_DEMO_LOCALES } from './masonry-demo.locales';

interface DemoCard {
  readonly id: number;
  readonly height: number;
}

const HEIGHTS = [120, 200, 80, 160, 240, 100, 180, 60, 140];

@Component({
  selector: 'app-masonry-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MasonryComponent, ButtonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="masonry" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>
      <p class="text-sm text-muted-foreground">{{ t().responsiveLabel }}</p>

      <div class="flex flex-wrap items-center gap-2">
        <ui-button size="sm" variant="outline" [label]="t().addCard" (clicked)="addCard()" />
        <ui-button size="sm" variant="outline" [label]="t().removeCard" (clicked)="removeCard()" />
        <span class="text-sm text-muted-foreground" data-testid="card-count">{{ cards().length }}</span>
      </div>

      <div class="rounded-lg border p-4 sm:p-6">
        <ui-masonry [columns]="{ base: 1, sm: 2, lg: 3 }" [gap]="16">
          @for (card of cards(); track card.id) {
            <div
              class="rounded-lg border bg-card p-4 text-sm text-card-foreground"
              tabindex="0"
              [attr.data-card-id]="card.id"
              [style.height.px]="card.height"
            >
              {{ t().cardPrefix }} {{ card.id }}
            </div>
          }
        </ui-masonry>
      </div>

      <p class="text-sm text-muted-foreground">{{ t().domOrderNote }}</p>
    </section>
  `,
})
export class MasonryDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => MASONRY_DEMO_LOCALES[this.localeId()] ?? MASONRY_DEMO_LOCALES['en']);

  protected readonly cards = signal<DemoCard[]>(
    HEIGHTS.map((height, index) => ({ id: index + 1, height }))
  );

  protected addCard(): void {
    this.cards.update((cards) => {
      const nextId = cards.length === 0 ? 1 : Math.max(...cards.map((card) => card.id)) + 1;
      return [...cards, { id: nextId, height: HEIGHTS[cards.length % HEIGHTS.length] }];
    });
  }

  protected removeCard(): void {
    this.cards.update((cards) => cards.slice(0, -1));
  }
}
