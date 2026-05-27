import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  NavigationMenuComponent,
  NavigationMenuContentComponent,
  NavigationMenuItemComponent,
  NavigationMenuLinkComponent,
  NavigationMenuListComponent,
  NavigationMenuTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { NAVIGATION_MENU_DEMO_LOCALES } from './navigation-menu-demo.locales';

@Component({
  selector: 'app-navigation-menu-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NavigationMenuComponent,
    NavigationMenuListComponent,
    NavigationMenuItemComponent,
    NavigationMenuTriggerComponent,
    NavigationMenuContentComponent,
    NavigationMenuLinkComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="navigation-menu" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-navigation-menu>
        <ui-navigation-menu-list>
          <ui-navigation-menu-item>
            <ui-navigation-menu-trigger>{{ t().gettingStarted }}</ui-navigation-menu-trigger>
            <ui-navigation-menu-content class="w-[400px]">
              <div class="grid gap-3 p-4 md:grid-cols-2">
                <ui-navigation-menu-link href="#" class="col-span-2">
                  <div class="text-sm font-medium leading-none">{{ t().introTitle }}</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {{ t().introDesc }}
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">{{ t().installTitle }}</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {{ t().installDesc }}
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">{{ t().typographyTitle }}</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {{ t().typographyDesc }}
                  </p>
                </ui-navigation-menu-link>
              </div>
            </ui-navigation-menu-content>
          </ui-navigation-menu-item>
          <ui-navigation-menu-item>
            <ui-navigation-menu-trigger>{{ t().components }}</ui-navigation-menu-trigger>
            <ui-navigation-menu-content class="w-[500px]">
              <div class="grid gap-3 p-4 md:grid-cols-2">
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">{{ t().alertDialogTitle }}</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {{ t().alertDialogDesc }}
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">{{ t().hoverCardTitle }}</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {{ t().hoverCardDesc }}
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">{{ t().progressTitle }}</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {{ t().progressDesc }}
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">{{ t().tooltipTitle }}</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {{ t().tooltipDesc }}
                  </p>
                </ui-navigation-menu-link>
              </div>
            </ui-navigation-menu-content>
          </ui-navigation-menu-item>
          <ui-navigation-menu-item>
            <ui-navigation-menu-link href="#"
              class="inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              {{ t().documentation }}
            </ui-navigation-menu-link>
          </ui-navigation-menu-item>
        </ui-navigation-menu-list>
      </ui-navigation-menu>
    </section>
  `,
})
export class NavigationMenuDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => NAVIGATION_MENU_DEMO_LOCALES[this.localeId()] ?? NAVIGATION_MENU_DEMO_LOCALES['en']);
}
