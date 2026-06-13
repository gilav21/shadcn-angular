import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ChipListComponent, LabelComponent } from '../../../../../packages/components/ui';
import { CHIP_LIST_DEMO_LOCALES } from './chip-list-demo.locales';

@Component({
  selector: 'app-chip-list-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, FormsModule, ChipListComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="chip-list" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-6 max-w-full sm:max-w-md">
        <h3 class="text-lg font-medium">{{ t().sections.variants }}</h3>
        <div class="grid gap-4 max-w-full sm:max-w-sm">
          <div class="space-y-2">
            <ui-label>{{ t().labels.defaultOutline }}</ui-label>
            <ui-chip-list />
          </div>

          <div class="space-y-2">
            <ui-label>{{ t().labels.underline }}</ui-label>
            <ui-chip-list variant="underline" />
          </div>

          <div class="space-y-2">
            <ui-label>{{ t().labels.ghost }}</ui-label>
            <div class="rounded-lg border">
              <ui-chip-list variant="ghost" />
            </div>
          </div>

          <div class="space-y-2">
            <ui-label>{{ t().labels.withBadgeSecondary }}</ui-label>
            <ui-chip-list badgeVariant="secondary" />
          </div>
        </div>

        <h3 class="text-lg font-medium">{{ t().sections.withData }}</h3>
        <div class="space-y-2">
          <ui-label>{{ t().labels.tags }}</ui-label>
          <ui-chip-list [(ngModel)]="chipListTags" [placeholder]="t().placeholders.addTag" />
          <p class="text-sm text-muted-foreground">{{ t().current }} {{ chipListTags() | json }}</p>
        </div>

        <div class="grid gap-4">
          <div class="space-y-2">
            <ui-label>{{ t().labels.underlineVariant }}</ui-label>
            <ui-chip-list [(ngModel)]="chipListTags" variant="underline" />
          </div>
          <div class="space-y-2">
            <ui-label>{{ t().labels.outlineVariant }}</ui-label>
            <ui-chip-list [(ngModel)]="chipListTags" variant="outline" />
          </div>
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().labels.maxRows }}</ui-label>
          <ui-chip-list [(ngModel)]="chipListFruits" [maxRows]="2" variant="outline" [placeholder]="t().placeholders.addFruit" />
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().labels.disabled }}</ui-label>
          <ui-chip-list [(ngModel)]="chipListTags" [disabled]="true" />
        </div>
      </div>
    </section>
  `,
})
export class ChipListDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => CHIP_LIST_DEMO_LOCALES[this.localeId()] ?? CHIP_LIST_DEMO_LOCALES['en']);

  readonly chipListTags = signal<string[]>(['Angular', 'TypeScript', 'Signals']);
  readonly chipListFruits = signal<string[]>([
    'Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape',
  ]);

  constructor() {
    effect(() => {
      const locale = this.t();
      this.chipListTags.set([...locale.tags]);
      this.chipListFruits.set([...locale.fruits]);
    });
  }
}
