import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  NavigationMenuComponent,
  NavigationMenuContentComponent,
  NavigationMenuItemComponent,
  NavigationMenuLinkComponent,
  NavigationMenuListComponent,
  NavigationMenuTriggerComponent,
} from '../../../../../packages/components/ui';

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
      <h2 id="navigation-menu" class="text-2xl font-semibold scroll-m-20">Navigation Menu</h2>
      <p class="text-muted-foreground">A navigation menu for site-wide navigation.</p>

      <ui-navigation-menu>
        <ui-navigation-menu-list>
          <ui-navigation-menu-item>
            <ui-navigation-menu-trigger>Getting Started</ui-navigation-menu-trigger>
            <ui-navigation-menu-content class="w-[400px]">
              <div class="grid gap-3 p-4 md:grid-cols-2">
                <ui-navigation-menu-link href="#" class="col-span-2">
                  <div class="text-sm font-medium leading-none">Introduction</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    Re-usable components built with Angular and Tailwind CSS.
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">Installation</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    How to install and set up the library.
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">Typography</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    Styles for headings, paragraphs, lists, etc.
                  </p>
                </ui-navigation-menu-link>
              </div>
            </ui-navigation-menu-content>
          </ui-navigation-menu-item>
          <ui-navigation-menu-item>
            <ui-navigation-menu-trigger>Components</ui-navigation-menu-trigger>
            <ui-navigation-menu-content class="w-[500px]">
              <div class="grid gap-3 p-4 md:grid-cols-2">
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">Alert Dialog</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    A modal dialog that interrupts the user.
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">Hover Card</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    For sighted users to preview content.
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">Progress</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    Displays completion progress of a task.
                  </p>
                </ui-navigation-menu-link>
                <ui-navigation-menu-link href="#">
                  <div class="text-sm font-medium leading-none">Tooltip</div>
                  <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    A popup that displays information.
                  </p>
                </ui-navigation-menu-link>
              </div>
            </ui-navigation-menu-content>
          </ui-navigation-menu-item>
          <ui-navigation-menu-item>
            <ui-navigation-menu-link href="#"
              class="inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              Documentation
            </ui-navigation-menu-link>
          </ui-navigation-menu-item>
        </ui-navigation-menu-list>
      </ui-navigation-menu>
    </section>
  `,
})
export class NavigationMenuDemoComponent {}
