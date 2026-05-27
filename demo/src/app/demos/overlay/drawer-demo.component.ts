import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  DrawerCloseComponent,
  DrawerComponent,
  DrawerContentComponent,
  DrawerDescriptionComponent,
  DrawerFooterComponent,
  DrawerHeaderComponent,
  DrawerTitleComponent,
  DrawerTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DRAWER_DEMO_LOCALES } from './drawer-demo.locales';

@Component({
  selector: 'app-drawer-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    DrawerCloseComponent,
    DrawerComponent,
    DrawerContentComponent,
    DrawerDescriptionComponent,
    DrawerFooterComponent,
    DrawerHeaderComponent,
    DrawerTitleComponent,
    DrawerTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="drawer" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex gap-2">
        <ui-drawer>
          <ui-drawer-trigger>
            <ui-button variant="outline">{{ t().openBottomLabel }}</ui-button>
          </ui-drawer-trigger>
          <ui-drawer-content>
            <ui-drawer-header>
              <ui-drawer-title>{{ t().drawerTitle }}</ui-drawer-title>
              <ui-drawer-description>{{ t().drawerDescription }}</ui-drawer-description>
            </ui-drawer-header>
            <div class="p-4">
              <p>{{ t().drawerContent }}</p>
            </div>
            <ui-drawer-footer>
              <ui-button>{{ t().saveLabel }}</ui-button>
              <ui-drawer-close>
                <ui-button variant="outline">{{ t().cancelLabel }}</ui-button>
              </ui-drawer-close>
            </ui-drawer-footer>
          </ui-drawer-content>
        </ui-drawer>
      </div>
    </section>
  `,
})
export class DrawerDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => DRAWER_DEMO_LOCALES[this.localeId()] ?? DRAWER_DEMO_LOCALES['en'],
  );
}
