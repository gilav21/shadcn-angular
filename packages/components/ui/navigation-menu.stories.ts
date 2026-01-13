import { Meta, StoryObj } from '@storybook/angular';
import {
    NavigationMenuComponent,
    NavigationMenuListComponent,
    NavigationMenuItemComponent,
    NavigationMenuTriggerComponent,
    NavigationMenuContentComponent,
    NavigationMenuLinkComponent,
    NavigationMenuIndicatorComponent,
} from './navigation-menu.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<NavigationMenuComponent> = {
    title: 'UI/NavigationMenu',
    component: NavigationMenuComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                NavigationMenuComponent,
                NavigationMenuListComponent,
                NavigationMenuItemComponent,
                NavigationMenuTriggerComponent,
                NavigationMenuContentComponent,
                NavigationMenuLinkComponent,
                NavigationMenuIndicatorComponent
            ],
        }),
    ],
};

export default meta;
type Story = StoryObj<NavigationMenuComponent>;

export const Default: Story = {
    render: () => ({
        template: `
      <ui-navigation-menu>
        <ui-navigation-menu-list>
          <ui-navigation-menu-item>
            <ui-navigation-menu-trigger>Item One</ui-navigation-menu-trigger>
            <ui-navigation-menu-content>
              <ul class="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                <li class="row-span-3">
                  <ui-navigation-menu-link>
                    <a
                      class="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                      href="/"
                    >
                      <div class="mb-2 mt-4 text-lg font-medium">
                        shadcn/ui
                      </div>
                      <p class="text-sm leading-tight text-muted-foreground">
                        Beautifully designed components built with Radix UI and
                        Tailwind CSS.
                      </p>
                    </a>
                  </ui-navigation-menu-link>
                </li>
                <li>
                  <ui-navigation-menu-link href="/docs" title="Introduction">
                    <div class="text-sm font-medium leading-none">Introduction</div>
                    <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                        Re-usable components built using Radix UI and Tailwind CSS.
                    </p>
                  </ui-navigation-menu-link>
                </li>
                <li>
                   <ui-navigation-menu-link href="/docs/installation" title="Installation">
                     <div class="text-sm font-medium leading-none">Installation</div>
                    <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                        How to install dependencies and structure your app.
                    </p>
                  </ui-navigation-menu-link>
                </li>
              </ul>
            </ui-navigation-menu-content>
          </ui-navigation-menu-item>
          <ui-navigation-menu-item>
            <ui-navigation-menu-trigger>Item Two</ui-navigation-menu-trigger>
             <ui-navigation-menu-content>
              <ul class="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                <li>
                    <ui-navigation-menu-link href="/docs/components/alert-dialog" title="Alert Dialog">
                         <div class="text-sm font-medium leading-none">Alert Dialog</div>
                        <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            A modal dialog that interrupts the user with important content and expects a response.
                        </p>
                    </ui-navigation-menu-link>
                </li>
                <li>
                     <ui-navigation-menu-link href="/docs/components/hover-card" title="Hover Card">
                         <div class="text-sm font-medium leading-none">Hover Card</div>
                        <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                           For sighted users to preview content available behind a link.
                        </p>
                    </ui-navigation-menu-link>
                </li>
              </ul>
            </ui-navigation-menu-content>
          </ui-navigation-menu-item>
          <ui-navigation-menu-item>
            <ui-navigation-menu-link href="/docs">
              <span class="text-sm font-medium">Documentation</span>
            </ui-navigation-menu-link>
          </ui-navigation-menu-item>
        </ui-navigation-menu-list>
      </ui-navigation-menu>
    `,
    }),
};
