import { Meta, StoryObj } from '@storybook/angular';
import {
  ContextMenuComponent,
  ContextMenuTriggerComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  ContextMenuLabelComponent,
  ContextMenuShortcutComponent,
  ContextMenuTriggerDirective,
} from './context-menu.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<ContextMenuComponent> = {
  title: 'UI/ContextMenu',
  component: ContextMenuComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        ContextMenuComponent,
        ContextMenuTriggerComponent,
        ContextMenuContentComponent,
        ContextMenuItemComponent,
        ContextMenuSeparatorComponent,
        ContextMenuLabelComponent,
        ContextMenuShortcutComponent,
        ContextMenuTriggerDirective,
      ],
    }),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<ContextMenuComponent>;

export const Default: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => ({
    template: `
      <div class="flex w-[1000px] items-center justify-center">
        <ui-context-menu>
          <ui-context-menu-trigger>
           <div class="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
              Right click here
            </div>
          </ui-context-menu-trigger>
          <ui-context-menu-content class="w-64">
            <ui-context-menu-item inset>
              Back
              <ui-context-menu-shortcut>⌘[</ui-context-menu-shortcut>
            </ui-context-menu-item>
            <ui-context-menu-item inset [disabled]="true">
              Forward
              <ui-context-menu-shortcut>⌘]</ui-context-menu-shortcut>
            </ui-context-menu-item>
            <ui-context-menu-item inset>
              Reload
              <ui-context-menu-shortcut>⌘R</ui-context-menu-shortcut>
            </ui-context-menu-item>
            <ui-context-menu-separator></ui-context-menu-separator>
            <ui-context-menu-item inset>
              Save Page As...
              <ui-context-menu-shortcut>⇧⌘S</ui-context-menu-shortcut>
            </ui-context-menu-item>
            <ui-context-menu-item inset>Printing</ui-context-menu-item>
            <ui-context-menu-item inset>Cast...</ui-context-menu-item>
            <ui-context-menu-item inset>Create QR Code for this Page</ui-context-menu-item>
            <ui-context-menu-separator></ui-context-menu-separator>
            <ui-context-menu-item inset>
              Translate to English
            </ui-context-menu-item>
            <ui-context-menu-separator></ui-context-menu-separator>
            <ui-context-menu-label inset>People</ui-context-menu-label>
            <ui-context-menu-separator></ui-context-menu-separator>
            <ui-context-menu-item inset>
              Pedro Duarte
            </ui-context-menu-item>
            <ui-context-menu-item inset>
              Colm Tuite  
            </ui-context-menu-item>
          </ui-context-menu-content>
        </ui-context-menu>
      </div>
    `,
  }),
};

export const TriggerDirective: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Use the `[uiContextMenuTrigger]` directive to attach a context menu to any element. Right-click anywhere in the trigger area to open the menu at the cursor position.',
      },
    },
  },
  render: () => ({
    template: `
      <ui-context-menu #contextMenu>
        <ui-context-menu-content class="w-56">
          <ui-context-menu-item>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            Edit
            <ui-context-menu-shortcut>⌘E</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            Copy
            <ui-context-menu-shortcut>⌘C</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><polyline points="8 17 12 21 16 17"/><line x1="12" x2="12" y1="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
            Share
          </ui-context-menu-item>
          <ui-context-menu-separator></ui-context-menu-separator>
          <ui-context-menu-item variant="destructive">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Delete
            <ui-context-menu-shortcut>⌘⌫</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-content>
      </ui-context-menu>

      <div
        [uiContextMenuTrigger]="contextMenu"
        class="h-[300px] w-full flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/50 text-muted-foreground"
      >
        Right-click anywhere in this area to open the context menu
      </div>
    `,
  }),
};
