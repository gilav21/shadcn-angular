import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  InputComponent,
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
  BadgeComponent,
  LabelComponent,
  SeparatorComponent,
  SwitchComponent,
  CheckboxComponent,
  RadioGroupComponent,
  RadioGroupItemComponent,
  TextareaComponent,
  SkeletonComponent,
  TabsComponent,
  TabsListComponent,
  TabsTriggerComponent,
  TabsContentComponent,
  AccordionComponent,
  AccordionItemComponent,
  AccordionTriggerComponent,
  AccordionContentComponent,
  ProgressComponent,
  AlertComponent,
  AlertTitleComponent,
  AlertDescriptionComponent,
  AvatarComponent,
  AvatarImageComponent,
  AvatarFallbackComponent,
  DialogComponent,
  DialogTriggerComponent,
  DialogContentComponent,
  DialogHeaderComponent,
  DialogTitleComponent,
  DialogDescriptionComponent,
  DialogFooterComponent,
  TooltipDirective,
  DropdownMenuComponent,
  DropdownMenuTriggerComponent,
  DropdownMenuContentComponent,
  DropdownMenuItemComponent,
  DropdownMenuSeparatorComponent,
  DropdownMenuLabelComponent,
} from '../components/ui';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
    BadgeComponent,
    LabelComponent,
    SeparatorComponent,
    SwitchComponent,
    CheckboxComponent,
    RadioGroupComponent,
    RadioGroupItemComponent,
    TextareaComponent,
    SkeletonComponent,
    TabsComponent,
    TabsListComponent,
    TabsTriggerComponent,
    TabsContentComponent,
    AccordionComponent,
    AccordionItemComponent,
    AccordionTriggerComponent,
    AccordionContentComponent,
    ProgressComponent,
    AlertComponent,
    AlertTitleComponent,
    AlertDescriptionComponent,
    AvatarComponent,
    AvatarImageComponent,
    AvatarFallbackComponent,
    DialogComponent,
    DialogTriggerComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogDescriptionComponent,
    DialogFooterComponent,
    TooltipDirective,
    DropdownMenuComponent,
    DropdownMenuTriggerComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
    DropdownMenuSeparatorComponent,
    DropdownMenuLabelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-background text-foreground p-8">
      <div class="max-w-4xl mx-auto space-y-12">
        <!-- Header -->
        <div class="text-center space-y-4">
          <h1 class="text-4xl font-bold tracking-tight">shadcn-angular</h1>
          <p class="text-muted-foreground text-lg">
            Beautifully designed components for Angular, built with Tailwind CSS
          </p>
          <div class="flex justify-center gap-2">
            <ui-badge>Angular 20</ui-badge>
            <ui-badge variant="secondary">Tailwind v4</ui-badge>
            <ui-badge variant="outline">Signals</ui-badge>
          </div>
        </div>

        <!-- Theme Toggle -->
        <div class="flex items-center justify-center gap-3">
          <span class="text-sm">Light</span>
          <ui-switch (checkedChange)="toggleTheme($event)" />
          <span class="text-sm">Dark</span>
        </div>

        <ui-separator />

        <!-- Buttons Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Buttons</h2>
          <p class="text-muted-foreground">Button component with multiple variants and sizes.</p>
          
          <div class="flex flex-wrap gap-4">
            <ui-button>Default</ui-button>
            <ui-button variant="secondary">Secondary</ui-button>
            <ui-button variant="outline">Outline</ui-button>
            <ui-button variant="ghost">Ghost</ui-button>
            <ui-button variant="link">Link</ui-button>
            <ui-button variant="destructive">Destructive</ui-button>
          </div>

          <div class="flex flex-wrap gap-4 items-center">
            <ui-button size="sm">Small</ui-button>
            <ui-button>Default</ui-button>
            <ui-button size="lg">Large</ui-button>
            <ui-button size="icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </ui-button>
          </div>

          <ui-button [disabled]="true">Disabled</ui-button>
        </section>

        <ui-separator />

        <!-- Input Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Input</h2>
          <p class="text-muted-foreground">Text input with label support.</p>
          
          <div class="grid gap-4 max-w-sm">
            <div class="space-y-2">
              <ui-label for="email">Email</ui-label>
              <ui-input type="email" placeholder="Enter your email" [attr.id]="'email'" />
            </div>
            
            <div class="space-y-2">
              <ui-label for="password">Password</ui-label>
              <ui-input type="password" placeholder="Enter password" [attr.id]="'password'" />
            </div>

            <ui-input placeholder="Disabled input" [disabled]="true" />
          </div>
        </section>

        <ui-separator />

        <!-- Card Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Card</h2>
          <p class="text-muted-foreground">Card component with header, content, and footer.</p>
          
          <div class="grid md:grid-cols-2 gap-6">
            <ui-card>
              <ui-card-header>
                <ui-card-title>Create Project</ui-card-title>
                <ui-card-description>Deploy your new project in one-click.</ui-card-description>
              </ui-card-header>
              <ui-card-content>
                <div class="space-y-4">
                  <div class="space-y-2">
                    <ui-label for="name">Name</ui-label>
                    <ui-input placeholder="Name of your project" />
                  </div>
                  <div class="space-y-2">
                    <ui-label for="framework">Framework</ui-label>
                    <ui-input placeholder="Angular" />
                  </div>
                </div>
              </ui-card-content>
              <ui-card-footer class="flex justify-between">
                <ui-button variant="outline">Cancel</ui-button>
                <ui-button>Deploy</ui-button>
              </ui-card-footer>
            </ui-card>

            <ui-card>
              <ui-card-header>
                <ui-card-title>Notifications</ui-card-title>
                <ui-card-description>Manage your notification preferences.</ui-card-description>
              </ui-card-header>
              <ui-card-content>
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <ui-label>Push Notifications</ui-label>
                    <ui-switch />
                  </div>
                  <div class="flex items-center justify-between">
                    <ui-label>Email Notifications</ui-label>
                    <ui-switch />
                  </div>
                </div>
              </ui-card-content>
            </ui-card>
          </div>
        </section>

        <ui-separator />

        <!-- Badge Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Badge</h2>
          <p class="text-muted-foreground">Badge component with variants.</p>
          
          <div class="flex flex-wrap gap-2">
            <ui-badge>Default</ui-badge>
            <ui-badge variant="secondary">Secondary</ui-badge>
            <ui-badge variant="outline">Outline</ui-badge>
            <ui-badge variant="destructive">Destructive</ui-badge>
          </div>
        </section>

        <ui-separator />

        <!-- Checkbox Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Checkbox</h2>
          <p class="text-muted-foreground">Checkbox component for boolean selection.</p>
          
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <ui-checkbox />
              <ui-label>Accept terms and conditions</ui-label>
            </div>
            <div class="flex items-center gap-2">
              <ui-checkbox />
              <ui-label>Subscribe to newsletter</ui-label>
            </div>
            <div class="flex items-center gap-2">
              <ui-checkbox [disabled]="true" />
              <ui-label class="opacity-50">Disabled checkbox</ui-label>
            </div>
          </div>
        </section>

        <ui-separator />

        <!-- Radio Group Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Radio Group</h2>
          <p class="text-muted-foreground">Radio button group for single selection.</p>
          
          <ui-radio-group class="max-w-sm">
            <div class="flex items-center gap-2">
              <ui-radio-group-item value="option1" />
              <ui-label>Default option</ui-label>
            </div>
            <div class="flex items-center gap-2">
              <ui-radio-group-item value="option2" />
              <ui-label>Comfortable spacing</ui-label>
            </div>
            <div class="flex items-center gap-2">
              <ui-radio-group-item value="option3" />
              <ui-label>Compact layout</ui-label>
            </div>
          </ui-radio-group>
        </section>

        <ui-separator />

        <!-- Textarea Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Textarea</h2>
          <p class="text-muted-foreground">Multi-line text input.</p>
          
          <div class="grid gap-4 max-w-sm">
            <div class="space-y-2">
              <ui-label>Your message</ui-label>
              <ui-textarea placeholder="Type your message here..." [rows]="4" />
            </div>
            <ui-textarea placeholder="Disabled textarea" [disabled]="true" />
          </div>
        </section>

        <ui-separator />

        <!-- Skeleton Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Skeleton</h2>
          <p class="text-muted-foreground">Loading placeholder animations.</p>
          
          <div class="flex items-center gap-4">
            <ui-skeleton class="h-12 w-12 rounded-full" />
            <ui-skeleton class="w-52 h-12 rounded-lg" />
          </div>
          <div class="flex items-center gap-4">
            <ui-skeleton class="w-68 h-12 rounded-lg" />
          </div>
        </section>

        <ui-separator />

        <!-- Tabs Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Tabs</h2>
          <p class="text-muted-foreground">Tab navigation component.</p>
          
          <ui-tabs defaultValue="account" class="max-w-md">
            <ui-tabs-list>
              <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
              <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
              <ui-tabs-trigger value="settings">Settings</ui-tabs-trigger>
            </ui-tabs-list>
            <ui-tabs-content value="account">
              <ui-card>
                <ui-card-header>
                  <ui-card-title>Account</ui-card-title>
                  <ui-card-description>Make changes to your account here.</ui-card-description>
                </ui-card-header>
                <ui-card-content>
                  <ui-input placeholder="Your name" />
                </ui-card-content>
              </ui-card>
            </ui-tabs-content>
            <ui-tabs-content value="password">
              <ui-card>
                <ui-card-header>
                  <ui-card-title>Password</ui-card-title>
                  <ui-card-description>Change your password here.</ui-card-description>
                </ui-card-header>
                <ui-card-content>
                  <ui-input type="password" placeholder="New password" />
                </ui-card-content>
              </ui-card>
            </ui-tabs-content>
            <ui-tabs-content value="settings">
              <ui-card>
                <ui-card-header>
                  <ui-card-title>Settings</ui-card-title>
                  <ui-card-description>Configure your preferences.</ui-card-description>
                </ui-card-header>
              </ui-card>
            </ui-tabs-content>
          </ui-tabs>
        </section>

        <ui-separator />

        <!-- Accordion Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Accordion</h2>
          <p class="text-muted-foreground">Collapsible content sections.</p>
          
          <ui-accordion class="max-w-md">
            <ui-accordion-item value="item-1">
              <ui-accordion-trigger>Is it accessible?</ui-accordion-trigger>
              <ui-accordion-content>
                Yes. It adheres to the WAI-ARIA design pattern.
              </ui-accordion-content>
            </ui-accordion-item>
            <ui-accordion-item value="item-2">
              <ui-accordion-trigger>Is it styled?</ui-accordion-trigger>
              <ui-accordion-content>
                Yes. It comes with default styles that match the other components.
              </ui-accordion-content>
            </ui-accordion-item>
            <ui-accordion-item value="item-3">
              <ui-accordion-trigger>Is it animated?</ui-accordion-trigger>
              <ui-accordion-content>
                Yes. It's animated by default with smooth transitions.
              </ui-accordion-content>
            </ui-accordion-item>
          </ui-accordion>
        </section>

        <ui-separator />

        <!-- Progress Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Progress</h2>
          <p class="text-muted-foreground">Progress bar indicators.</p>
          
          <div class="space-y-4 max-w-md">
            <ui-progress [value]="25" />
            <ui-progress [value]="50" />
            <ui-progress [value]="75" />
            <ui-progress [value]="100" />
          </div>
        </section>

        <ui-separator />

        <!-- Alert Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Alert</h2>
          <p class="text-muted-foreground">Alert messages and notifications.</p>
          
          <div class="space-y-4 max-w-md">
            <ui-alert>
              <ui-alert-title>Heads up!</ui-alert-title>
              <ui-alert-description>
                You can add components to your app using the CLI.
              </ui-alert-description>
            </ui-alert>
            <ui-alert variant="destructive">
              <ui-alert-title>Error</ui-alert-title>
              <ui-alert-description>
                Your session has expired. Please log in again.
              </ui-alert-description>
            </ui-alert>
          </div>
        </section>

        <ui-separator />

        <!-- Avatar Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Avatar</h2>
          <p class="text-muted-foreground">User avatar with image or fallback.</p>
          
          <div class="flex gap-4">
            <ui-avatar>
              <ui-avatar-image src="https://github.com/shadcn.png" alt="shadcn" />
              <ui-avatar-fallback>CN</ui-avatar-fallback>
            </ui-avatar>
            <ui-avatar>
              <ui-avatar-fallback>JD</ui-avatar-fallback>
            </ui-avatar>
            <ui-avatar>
              <ui-avatar-fallback>AB</ui-avatar-fallback>
            </ui-avatar>
          </div>
        </section>

        <ui-separator />

        <!-- Dialog Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Dialog</h2>
          <p class="text-muted-foreground">Modal dialog with overlay.</p>
          
          <ui-dialog #uiDialog>
            <ui-dialog-trigger> 
              <ui-button>Open Dialog</ui-button>
            </ui-dialog-trigger>
            <ui-dialog-content>
              <ui-dialog-header>
                <ui-dialog-title>Edit Profile</ui-dialog-title>
                <ui-dialog-description>
                  Make changes to your profile here. Click save when you're done.
                </ui-dialog-description>
              </ui-dialog-header>
              <div class="grid gap-4 py-4">
                <div class="grid gap-2">
                  <ui-label>Name</ui-label>
                  <ui-input placeholder="Your name" />
                </div>
                <div class="grid gap-2">
                  <ui-label>Email</ui-label>
                  <ui-input type="email" placeholder="your@email.com" />
                </div>
              </div>
              <ui-dialog-footer>
                <ui-button (click)="uiDialog.hide()">Save changes</ui-button>
              </ui-dialog-footer>
            </ui-dialog-content>
          </ui-dialog>
        </section>

        <ui-separator />

        <!-- Tooltip Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Tooltip</h2>
          <p class="text-muted-foreground">Hover hints for elements.</p>
          
          <div class="flex gap-4">
            <ui-button uiTooltip="This is a tooltip!" tooltipSide="top">Hover me (Top)</ui-button>
            <ui-button uiTooltip="Bottom tooltip" tooltipSide="bottom" variant="secondary">Hover me (Bottom)</ui-button>
            <ui-button uiTooltip="Right side" tooltipSide="right" variant="outline">Hover me (Right)</ui-button>
          </div>
        </section>

        <ui-separator />

        <!-- Dropdown Menu Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Dropdown Menu</h2>
          <p class="text-muted-foreground">Dropdown menu with items.</p>
          
          <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>
              <ui-button variant="outline">Open Menu</ui-button>
            </ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content>
              <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>Settings</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>Billing</ui-dropdown-menu-item>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item>Log out</ui-dropdown-menu-item>
            </ui-dropdown-menu-content>
          </ui-dropdown-menu>
        </section>

        <!-- Footer -->
        <div class="text-center text-muted-foreground text-sm pt-8">
          Built with Angular and Tailwind CSS. Open source.
        </div>
      </div>
    </div>
  `,
})
export class AppComponent {
  isDark = signal(false);

  toggleTheme(dark: boolean) {
    this.isDark.set(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
