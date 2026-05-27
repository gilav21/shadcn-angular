import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  CollapsibleComponent,
  CollapsibleContentComponent,
  CollapsibleTriggerComponent,
  IconComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { COLLAPSIBLE_DEMO_LOCALES } from './collapsible-demo.locales';

@Component({
  selector: 'app-collapsible-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent,
    ButtonComponent,
    IconComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="collapsible" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-collapsible class="w-[350px] space-y-2">
        <div class="flex items-center justify-between space-x-4 px-4">
          <h4 class="text-sm font-semibold">{{ t().starredLabel }}</h4>
          <ui-collapsible-trigger>
            <ui-button variant="ghost" size="sm" class="w-9 p-0">
              <ui-icon name="chevrons-up-down" size="sm" />
              <span class="sr-only">{{ t().toggleSrText }}</span>
            </ui-button>
          </ui-collapsible-trigger>
        </div>
        <div class="rounded-md border px-4 py-3 font-mono text-sm">&#64;radix-ui/primitives</div>
        <ui-collapsible-content class="space-y-2">
          <div class="rounded-md border px-4 py-3 font-mono text-sm">&#64;radix-ui/colors</div>
          <div class="rounded-md border px-4 py-3 font-mono text-sm">&#64;stitches/react</div>
        </ui-collapsible-content>
      </ui-collapsible>
    </section>
  `,
})
export class CollapsibleDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => COLLAPSIBLE_DEMO_LOCALES[this.localeId()] ?? COLLAPSIBLE_DEMO_LOCALES['en']);
}
