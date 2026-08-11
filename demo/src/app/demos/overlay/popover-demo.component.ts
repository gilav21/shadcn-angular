import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  InputComponent,
  LabelComponent,
  PopoverCloseComponent,
  PopoverComponent,
  PopoverContentComponent,
  PopoverTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { POPOVER_DEMO_LOCALES } from './popover-demo.locales';

@Component({
  selector: 'app-popover-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    InputComponent,
    LabelComponent,
    PopoverCloseComponent,
    PopoverComponent,
    PopoverContentComponent,
    PopoverTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="popover" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-popover #popover>
        <ui-popover-trigger>
          <ui-button variant="outline">{{ t().openLabel }}</ui-button>
        </ui-popover-trigger>
        <ui-popover-content class="w-80">
          <div class="grid gap-4">
            <div class="space-y-2">
              <h4 class="font-medium leading-none">{{ t().dimensionsHeading }}</h4>
              <p class="text-sm text-muted-foreground">{{ t().dimensionsDescription }}</p>
            </div>
            <div class="grid gap-2">
              <div class="grid grid-cols-3 items-center gap-4">
                <ui-label for="width">{{ t().widthLabel }}</ui-label>
                <ui-input id="width" defaultValue="100%" class="col-span-2 h-8" />
              </div>
              <div class="grid grid-cols-3 items-center gap-4">
                <ui-label for="maxWidth">{{ t().maxWidthLabel }}</ui-label>
                <ui-input id="maxWidth" defaultValue="300px" class="col-span-2 h-8" />
              </div>
            </div>
            <div class="flex justify-end">
              <ui-popover-close>
                <ui-button size="sm">{{ t().closeLabel }}</ui-button>
              </ui-popover-close>
            </div>
          </div>
        </ui-popover-content>
      </ui-popover>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().restoreFocusHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().restoreFocusCaption }}</p>
        <ui-popover>
          <ui-popover-trigger>
            <ui-button variant="outline">{{ t().restoreFocusOpenLabel }}</ui-button>
          </ui-popover-trigger>
          <ui-popover-content class="w-72" [restoreFocus]="true">
            <div class="grid gap-4">
              <div class="space-y-2">
                <h4 class="font-medium leading-none">{{ t().restoreFocusHeading }}</h4>
                <p class="text-sm text-muted-foreground">{{ t().restoreFocusBody }}</p>
              </div>
              <div class="flex justify-end">
                <ui-popover-close>
                  <ui-button size="sm">{{ t().closeLabel }}</ui-button>
                </ui-popover-close>
              </div>
            </div>
          </ui-popover-content>
        </ui-popover>
      </div>
    </section>
  `,
})
export class PopoverDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => POPOVER_DEMO_LOCALES[this.localeId()] ?? POPOVER_DEMO_LOCALES['en'],
  );
}
