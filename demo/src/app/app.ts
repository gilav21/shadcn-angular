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
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent,
  SelectGroupComponent,
  SelectLabelComponent,
  SelectSeparatorComponent,
  PopoverComponent,
  PopoverTriggerComponent,
  PopoverContentComponent,
  PopoverCloseComponent,
  SheetComponent,
  SheetTriggerComponent,
  SheetContentComponent,
  SheetHeaderComponent,
  SheetTitleComponent,
  SheetDescriptionComponent,
  SheetFooterComponent,
  SheetCloseComponent,
  AlertDialogComponent,
  AlertDialogTriggerComponent,
  AlertDialogContentComponent,
  AlertDialogHeaderComponent,
  AlertDialogTitleComponent,
  AlertDialogDescriptionComponent,
  AlertDialogFooterComponent,
  AlertDialogActionComponent,
  AlertDialogCancelComponent,
  SliderComponent,
  CollapsibleComponent,
  CollapsibleTriggerComponent,
  CollapsibleContentComponent,
} from '../components/ui';
import { ToggleComponent } from '../components/ui/toggle.component';
import { ToggleGroupComponent, ToggleGroupItemComponent } from '../components/ui/toggle-group.component';
import { ScrollAreaComponent } from '../components/ui/scroll-area.component';
import { TableComponent, TableHeaderComponent, TableBodyComponent, TableFooterComponent, TableRowComponent, TableHeadComponent, TableCellComponent, TableCaptionComponent } from '../components/ui/table.component';
import { BreadcrumbComponent, BreadcrumbListComponent, BreadcrumbItemComponent, BreadcrumbLinkComponent, BreadcrumbPageComponent, BreadcrumbSeparatorComponent, BreadcrumbEllipsisComponent } from '../components/ui/breadcrumb.component';
import { HoverCardComponent, HoverCardTriggerComponent, HoverCardContentComponent } from '../components/ui/hover-card.component';
import { ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuSeparatorComponent, ContextMenuLabelComponent, ContextMenuShortcutComponent } from '../components/ui/context-menu.component';
import { DrawerComponent, DrawerTriggerComponent, DrawerContentComponent, DrawerHeaderComponent, DrawerTitleComponent, DrawerDescriptionComponent, DrawerFooterComponent, DrawerCloseComponent } from '../components/ui/drawer.component';

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
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
    SelectGroupComponent,
    SelectLabelComponent,
    SelectSeparatorComponent,
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
    PopoverCloseComponent,
    SheetComponent,
    SheetTriggerComponent,
    SheetContentComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
    SheetDescriptionComponent,
    SheetFooterComponent,
    SheetCloseComponent,
    AlertDialogComponent,
    AlertDialogTriggerComponent,
    AlertDialogContentComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogDescriptionComponent,
    AlertDialogFooterComponent,
    AlertDialogActionComponent,
    AlertDialogCancelComponent,
    SliderComponent,
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent,
    ToggleComponent,
    ToggleGroupComponent,
    ToggleGroupItemComponent,
    ScrollAreaComponent,
    TableComponent,
    TableHeaderComponent,
    TableBodyComponent,
    TableFooterComponent,
    TableRowComponent,
    TableHeadComponent,
    TableCellComponent,
    TableCaptionComponent,
    BreadcrumbComponent,
    BreadcrumbListComponent,
    BreadcrumbItemComponent,
    BreadcrumbLinkComponent,
    BreadcrumbPageComponent,
    BreadcrumbSeparatorComponent,
    BreadcrumbEllipsisComponent,
    HoverCardComponent,
    HoverCardTriggerComponent,
    HoverCardContentComponent,
    ContextMenuComponent,
    ContextMenuTriggerComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    ContextMenuLabelComponent,
    ContextMenuShortcutComponent,
    DrawerComponent,
    DrawerTriggerComponent,
    DrawerContentComponent,
    DrawerHeaderComponent,
    DrawerTitleComponent,
    DrawerDescriptionComponent,
    DrawerFooterComponent,
    DrawerCloseComponent,
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
        <ui-breadcrumb-list>
          <ui-breadcrumb-page>Home</ui-breadcrumb-page>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="#breadcrumbSection">Breadcrumb</ui-breadcrumb-link>
          </ui-breadcrumb-item>
        </ui-breadcrumb-list>
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

        <ui-separator />

        <!-- Select Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Select</h2>
          <p class="text-muted-foreground">Select component for choosing from a list of options.</p>
          
          <ui-select class="max-w-xs" position="popper">
            <ui-select-trigger>
              <ui-select-value placeholder="Select a fruit" />
            </ui-select-trigger>
            <ui-select-content>
              <ui-select-group>
                <ui-select-label>Fruits</ui-select-label>
                <ui-select-item value="apple">Apple</ui-select-item>
                <ui-select-item value="banana">Banana</ui-select-item>
                <ui-select-item value="blueberry">Blueberry</ui-select-item>
                <ui-select-item value="grapes">Grapes</ui-select-item>
                <ui-select-item value="pineapple">Pineapple</ui-select-item>
              </ui-select-group>
            </ui-select-content>
          </ui-select>
        </section>

        <ui-separator />

        <!-- Popover Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Popover</h2>
          <p class="text-muted-foreground">Floating content that appears when a trigger is clicked.</p>
          
          <ui-popover #popover>
            <ui-popover-trigger>
              <ui-button variant="outline">Open Popover</ui-button>
            </ui-popover-trigger>
            <ui-popover-content class="w-80">
              <div class="grid gap-4">
                <div class="space-y-2">
                  <h4 class="font-medium leading-none">Dimensions</h4>
                  <p class="text-sm text-muted-foreground">Set the dimensions for the layer.</p>
                </div>
                <div class="grid gap-2">
                  <div class="grid grid-cols-3 items-center gap-4">
                    <ui-label for="width">Width</ui-label>
                    <ui-input id="width" defaultValue="100%" class="col-span-2 h-8" />
                  </div>
                  <div class="grid grid-cols-3 items-center gap-4">
                    <ui-label for="maxWidth">Max. width</ui-label>
                    <ui-input id="maxWidth" defaultValue="300px" class="col-span-2 h-8" />
                  </div>
                </div>
                <div class="flex justify-end">
                  <ui-popover-close>
                    <ui-button size="sm">Close</ui-button>
                  </ui-popover-close>
                </div>
              </div>
            </ui-popover-content>
          </ui-popover>
        </section>

        <ui-separator />

        <!-- Sheet Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Sheet</h2>
          <p class="text-muted-foreground">Slide-out panel from the edge of the screen.</p>
          
          <div class="flex gap-2">
            <ui-sheet #sheetRight>
              <ui-sheet-trigger>
                <ui-button variant="outline">Open Right</ui-button>
              </ui-sheet-trigger>
              <ui-sheet-content side="right" >
                <ui-sheet-header>
                  <ui-sheet-title>Edit Profile</ui-sheet-title>
                  <ui-sheet-description>
                    Make changes to your profile here. Click save when you're done.
                  </ui-sheet-description>
                </ui-sheet-header>
                <div class="grid gap-4 py-4">
                  <div class="grid gap-2">
                    <ui-label>Name</ui-label>
                    <ui-input placeholder="Your name" />
                  </div>
                </div>
                <ui-sheet-footer>
                  <ui-sheet-close>
                    <ui-button>Save changes</ui-button>
                  </ui-sheet-close>
                </ui-sheet-footer>
              </ui-sheet-content>
            </ui-sheet>

            <ui-sheet #sheetLeft>
              <ui-sheet-trigger>
                <ui-button variant="outline">Open Left</ui-button>
              </ui-sheet-trigger>
              <ui-sheet-content side="left">
                <ui-sheet-header>
                  <ui-sheet-title>Left Panel</ui-sheet-title>
                  <ui-sheet-description>This panel slides in from the left.</ui-sheet-description>
                </ui-sheet-header>
              </ui-sheet-content>
            </ui-sheet>
          </div>
        </section>

        <ui-separator />

        <!-- Alert Dialog Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Alert Dialog</h2>
          <p class="text-muted-foreground">A modal dialog that interrupts the user with important content.</p>
          
          <ui-alert-dialog #alertDialog>
            <ui-alert-dialog-trigger>
              <ui-button variant="outline">Show Alert Dialog</ui-button>
            </ui-alert-dialog-trigger>
            <ui-alert-dialog-content>
              <ui-alert-dialog-header>
                <ui-alert-dialog-title>Are you absolutely sure?</ui-alert-dialog-title>
                <ui-alert-dialog-description>
                  This action cannot be undone. This will permanently delete your account
                  and remove your data from our servers.
                </ui-alert-dialog-description>
              </ui-alert-dialog-header>
              <ui-alert-dialog-footer>
                <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
                <ui-alert-dialog-action>Continue</ui-alert-dialog-action>
              </ui-alert-dialog-footer>
            </ui-alert-dialog-content>
          </ui-alert-dialog>
        </section>

        <ui-separator />

        <!-- Slider Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Slider</h2>
          <p class="text-muted-foreground">Range input component.</p>
          
          <div class="max-w-xs space-y-4">
            <ui-slider [defaultValue]="40" [min]="0" [max]="100" [step]="1" />
            <div class="flex justify-between text-sm text-muted-foreground">
              <span>0</span>
              <span>100</span>
            </div>
          </div>
        </section>

        <ui-separator />

        <!-- Collapsible Section -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Collapsible</h2>
          <p class="text-muted-foreground">An expandable/collapsible component.</p>
          
          <ui-collapsible class="w-[350px] space-y-2">
            <div class="flex items-center justify-between space-x-4 px-4">
              <h4 class="text-sm font-semibold">&#64;peduarte starred 3 repositories</h4>
              <ui-collapsible-trigger>
                <ui-button variant="ghost" size="sm" class="w-9 p-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                  <span class="sr-only">Toggle</span>
                </ui-button>
              </ui-collapsible-trigger>
            </div>
            <div class="rounded-md border px-4 py-3 font-mono text-sm">
              &#64;radix-ui/primitives
            </div>
            <ui-collapsible-content class="space-y-2">
              <div class="rounded-md border px-4 py-3 font-mono text-sm">
                &#64;radix-ui/colors
              </div>
              <div class="rounded-md border px-4 py-3 font-mono text-sm">
                &#64;stitches/react
              </div>
            </ui-collapsible-content>
          </ui-collapsible>
        </section>

        <ui-separator />

        <!-- Toggle -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Toggle</h2>
          <p class="text-muted-foreground">A two-state button that can be toggled on or off.</p>
          
          <div class="flex flex-wrap gap-4">
            <ui-toggle>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </ui-toggle>
            <ui-toggle variant="outline">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </ui-toggle>
            <ui-toggle [defaultPressed]="true">Bold</ui-toggle>
          </div>
        </section>

        <ui-separator />

        <!-- Toggle Group -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Toggle Group</h2>
          <p class="text-muted-foreground">A set of two-state buttons that can be toggled on or off.</p>
          
          <div class="space-y-4">
            <div>
              <p class="text-sm text-muted-foreground mb-2">Single selection:</p>
              <ui-toggle-group type="single" variant="outline">
                <ui-toggle-group-item value="left">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h10M4 18h7" />
                  </svg>
                </ui-toggle-group-item>
                <ui-toggle-group-item value="center">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </ui-toggle-group-item>
                <ui-toggle-group-item class="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-yellow-500 data-[state=on]:*:[svg]:stroke-yellow-500" value="right">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M10 12h10M13 18h7" />
                  </svg>
                </ui-toggle-group-item>
              </ui-toggle-group>
            </div>
            <div>
              <p class="text-sm text-muted-foreground mb-2">Multiple selection:</p>
              <ui-toggle-group type="multiple" variant="outline">
                <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
                <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
                <ui-toggle-group-item value="underline">U</ui-toggle-group-item>
              </ui-toggle-group>
            </div>
          </div>
        </section>

        <ui-separator />

        <!-- Scroll Area -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Scroll Area</h2>
          <p class="text-muted-foreground">A custom scrollable area with styled scrollbars.</p>
          
          <ui-scroll-area class="h-72 w-48 rounded-md border">
            <div class="p-4">
              <h4 class="mb-4 text-sm font-medium leading-none">Tags</h4>
              @for (tag of ['v1.2.0-beta.18', 'v1.2.0-beta.17', 'v1.2.0-beta.16', 'v1.2.0-beta.15', 'v1.2.0-beta.14', 'v1.2.0-beta.13', 'v1.2.0-beta.12', 'v1.2.0-beta.11', 'v1.2.0-beta.10', 'v1.2.0-beta.9', 'v1.2.0-beta.8', 'v1.2.0-beta.7', 'v1.2.0-beta.6', 'v1.2.0-beta.7', 'v1.2.0-beta.7' , 'v1.2.0-beta.7' , 'v1.2.0-beta.7']; track tag) {
                <div class="text-sm">{{ tag }}</div>
                <ui-separator class="my-2" />
              }
            </div>
          </ui-scroll-area>
        </section>

        <ui-separator />

        <!-- Table -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Table</h2>
          <p class="text-muted-foreground">A responsive table component.</p>
          
          <ui-table class="h-20">
            <ui-table-caption>A list of your recent invoices.</ui-table-caption>
            <ui-table-header>
              <ui-table-row>
                <ui-table-head class="w-[100px]">Invoice</ui-table-head>
                <ui-table-head>Status</ui-table-head>
                <ui-table-head>Method</ui-table-head>
                <ui-table-head class="text-right">Amount</ui-table-head>
              </ui-table-row>
            </ui-table-header>
            <ui-table-body>
              <ui-table-row>
                <ui-table-cell class="font-medium">INV001</ui-table-cell>
                <ui-table-cell>Paid</ui-table-cell>
                <ui-table-cell>Credit Card</ui-table-cell>
                <ui-table-cell class="text-right">$250.00</ui-table-cell>
              </ui-table-row>
              <ui-table-row>
                <ui-table-cell class="font-medium">INV002</ui-table-cell>
                <ui-table-cell>Pending</ui-table-cell>
                <ui-table-cell>PayPal</ui-table-cell>
                <ui-table-cell class="text-right">$150.00</ui-table-cell>
              </ui-table-row>
              <ui-table-row>
                <ui-table-cell class="font-medium">INV003</ui-table-cell>
                <ui-table-cell>Unpaid</ui-table-cell>
                <ui-table-cell>Bank Transfer</ui-table-cell>
                <ui-table-cell class="text-right">$350.00</ui-table-cell>
              </ui-table-row>
            </ui-table-body>
          </ui-table>
        </section>

        <ui-separator />

        <!-- Breadcrumb -->
        <section class="space-y-4" id="breadcrumbSection">
          <h2 class="text-2xl font-semibold">Breadcrumb</h2>
          <p class="text-muted-foreground">Displays the path to the current page.</p>
          
          <ui-breadcrumb>
            <ui-breadcrumb-list>
              <ui-breadcrumb-item>
                <ui-breadcrumb-link href="/">Home</ui-breadcrumb-link>
              </ui-breadcrumb-item>
              <ui-breadcrumb-separator />
              <ui-breadcrumb-item>
                <ui-breadcrumb-link href="/components">Components</ui-breadcrumb-link>
              </ui-breadcrumb-item>
              <ui-breadcrumb-separator />
              <ui-breadcrumb-item>
                <ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page>
              </ui-breadcrumb-item>
            </ui-breadcrumb-list>
          </ui-breadcrumb>
        </section>

        <ui-separator />

        <!-- Hover Card -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Hover Card</h2>
          <p class="text-muted-foreground">A card that appears when hovering over an element.</p>
          
          <ui-hover-card>
            <ui-hover-card-trigger>
              <ui-button variant="link">&#64;angular</ui-button>
            </ui-hover-card-trigger>
            <ui-hover-card-content>
              <div class="flex justify-between space-x-4">
                <ui-avatar>
                  <ui-avatar-image src="https://github.com/angular.png" />
                  <ui-avatar-fallback>NG</ui-avatar-fallback>
                </ui-avatar>
                <div class="space-y-1">
                  <h4 class="text-sm font-semibold">&#64;angular</h4>
                  <p class="text-sm">The modern web developer's platform.</p>
                  <div class="flex items-center pt-2">
                    <span class="text-xs text-muted-foreground">
                      Joined December 2016
                    </span>
                  </div>
                </div>
              </div>
            </ui-hover-card-content>
          </ui-hover-card>
        </section>

        <ui-separator />

        <!-- Context Menu -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Context Menu</h2>
          <p class="text-muted-foreground">A menu that appears on right-click.</p>
          
          <ui-context-menu>
            <ui-context-menu-trigger>
              <div class="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
                Right click here
              </div>
            </ui-context-menu-trigger>
            <ui-context-menu-content>
              <ui-context-menu-item>
                Back
                <ui-context-menu-shortcut>⌘[</ui-context-menu-shortcut>
              </ui-context-menu-item>
              <ui-context-menu-item>
                Forward
                <ui-context-menu-shortcut>⌘]</ui-context-menu-shortcut>
              </ui-context-menu-item>
              <ui-context-menu-item>
                Reload
                <ui-context-menu-shortcut>⌘R</ui-context-menu-shortcut>
              </ui-context-menu-item>
              <ui-context-menu-separator />
              <ui-context-menu-item>
                Save As...
                <ui-context-menu-shortcut>⇧⌘S</ui-context-menu-shortcut>
              </ui-context-menu-item>
              <ui-context-menu-item>Print...</ui-context-menu-item>
            </ui-context-menu-content>
          </ui-context-menu>
        </section>

        <ui-separator />

        <!-- Drawer -->
        <section class="space-y-4">
          <h2 class="text-2xl font-semibold">Drawer</h2>
          <p class="text-muted-foreground">A panel that slides in from the edge of the screen.</p>
          
          <div class="flex gap-2">
            <ui-drawer>
              <ui-drawer-trigger>
                <ui-button variant="outline">Open Bottom Drawer</ui-button>
              </ui-drawer-trigger>
              <ui-drawer-content>
                <ui-drawer-header>
                  <ui-drawer-title>Edit Profile</ui-drawer-title>
                  <ui-drawer-description>Make changes to your profile here.</ui-drawer-description>
                </ui-drawer-header>
                <div class="p-4">
                  <p>Drawer content goes here...</p>
                </div>
                <ui-drawer-footer>
                  <ui-button>Save changes</ui-button>
                  <ui-drawer-close>
                    <ui-button variant="outline">Cancel</ui-button>
                  </ui-drawer-close>
                </ui-drawer-footer>
              </ui-drawer-content>
            </ui-drawer>
          </div>
        </section>

        <ui-separator />

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
