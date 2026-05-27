import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  InputComponent,
  LabelComponent,
  SheetCloseComponent,
  SheetComponent,
  SheetContentComponent,
  SheetDescriptionComponent,
  SheetFooterComponent,
  SheetHeaderComponent,
  SheetTitleComponent,
  SheetTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SHEET_DEMO_LOCALES } from './sheet-demo.locales';

@Component({
  selector: 'app-sheet-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    InputComponent,
    LabelComponent,
    SheetCloseComponent,
    SheetComponent,
    SheetContentComponent,
    SheetDescriptionComponent,
    SheetFooterComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
    SheetTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="sheet" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex gap-2">
        <ui-sheet #sheetRight>
          <ui-sheet-trigger>
            <ui-button variant="outline">{{ t().openRightLabel }}</ui-button>
          </ui-sheet-trigger>
          <ui-sheet-content side="right">
            <ui-sheet-header>
              <ui-sheet-title>{{ t().rightSheetTitle }}</ui-sheet-title>
              <ui-sheet-description>{{ t().rightSheetDescription }}</ui-sheet-description>
            </ui-sheet-header>
            <div class="grid gap-4 py-4">
              <div class="grid gap-2">
                <ui-label>{{ t().nameLabel }}</ui-label>
                <ui-input [placeholder]="t().namePlaceholder" />
              </div>
            </div>
            <ui-sheet-footer>
              <ui-sheet-close>
                <ui-button>{{ t().saveLabel }}</ui-button>
              </ui-sheet-close>
            </ui-sheet-footer>
          </ui-sheet-content>
        </ui-sheet>

        <ui-sheet #sheetLeft>
          <ui-sheet-trigger>
            <ui-button variant="outline">{{ t().openLeftLabel }}</ui-button>
          </ui-sheet-trigger>
          <ui-sheet-content side="left">
            <ui-sheet-header>
              <ui-sheet-title>{{ t().leftSheetTitle }}</ui-sheet-title>
              <ui-sheet-description>{{ t().leftSheetDescription }}</ui-sheet-description>
            </ui-sheet-header>
          </ui-sheet-content>
        </ui-sheet>
      </div>
    </section>
  `,
})
export class SheetDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => SHEET_DEMO_LOCALES[this.localeId()] ?? SHEET_DEMO_LOCALES['en'],
  );
}
