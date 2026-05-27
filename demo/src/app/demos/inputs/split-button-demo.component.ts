import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import {
  LabelComponent,
  SplitButtonComponent,
  SplitButtonPrimaryComponent,
  SplitButtonMenuComponent,
  SplitButtonItemComponent,
  SplitButtonItem,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SPLIT_BUTTON_DEMO_LOCALES } from './split-button-demo.locales';

@Component({
  selector: 'app-split-button-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LabelComponent,
    SplitButtonComponent,
    SplitButtonPrimaryComponent,
    SplitButtonMenuComponent,
    SplitButtonItemComponent,
  ],
  template: `
    <section class="space-y-8">
      <div class="space-y-4">
        <h2 id="split-button" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
        <p class="text-muted-foreground">{{ t().description }}</p>
      </div>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>{{ t().dataDrivenLabel }}</ui-label>
          <ui-split-button [label]="t().saveChanges" [items]="splitButtonItems()" (primaryClick)="onSplitPrimaryClick()"
            (itemClick)="onSplitItemClick($event)" />
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().contentProjectionLabel }}</ui-label>
          <ui-split-button>
            <ui-split-button-primary (click)="onSplitPrimaryClick()" (keydown.enter)="onSplitPrimaryClick()">
              {{ t().deploy }}
            </ui-split-button-primary>
            <ui-split-button-menu>
              <ui-split-button-item (click)="onSplitItemClick({label: t().deployToStaging})" (keydown.enter)="onSplitItemClick({label: t().deployToStaging})">
                {{ t().deployToStaging }}
              </ui-split-button-item>
              <ui-split-button-item (click)="onSplitItemClick({label: t().deployToProduction})" (keydown.enter)="onSplitItemClick({label: t().deployToProduction})">
                {{ t().deployToProduction }}
              </ui-split-button-item>
            </ui-split-button-menu>
          </ui-split-button>
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().variantsLabel }}</ui-label>
          <div class="flex gap-2 flex-wrap">
            <ui-split-button [label]="t().secondaryLabel" variant="secondary" [items]="splitButtonItems()" />
            <ui-split-button [label]="t().destructiveLabel" variant="destructive" [items]="splitButtonItems()" />
            <ui-split-button [label]="t().outlineLabel" variant="outline" [items]="splitButtonItems()" />
          </div>
        </div>

        <div class="space-y-2">
          <ui-label>{{ t().sizesLabel }}</ui-label>
          <div class="flex gap-2 items-center flex-wrap">
            <ui-split-button [label]="t().smallLabel" size="sm" [items]="splitButtonItems()" />
            <ui-split-button [label]="t().defaultLabel" [items]="splitButtonItems()" />
            <ui-split-button [label]="t().largeLabel" size="lg" [items]="splitButtonItems()" />
          </div>
        </div>
      </div>
    </section>
  `,
})
export class SplitButtonDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => SPLIT_BUTTON_DEMO_LOCALES[this.localeId()] ?? SPLIT_BUTTON_DEMO_LOCALES['en']);

  readonly splitButtonItems = computed<SplitButtonItem[]>(() => [
    { label: this.t().editItem, value: 'edit', icon: '✎' },
    { label: this.t().duplicateItem, value: 'duplicate', icon: '📄' },
    { label: this.t().deleteItem, value: 'delete', icon: '🗑️', disabled: true },
  ]);

  onSplitPrimaryClick(): void {
    alert('Primary action triggered!');
  }

  onSplitItemClick(item: Partial<SplitButtonItem>): void {
    alert(`Menu item clicked: ${item.label}`);
  }
}
