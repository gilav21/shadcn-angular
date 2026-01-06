import { Meta, StoryObj } from '@storybook/angular';
import {
  ContextMenuComponent,
  ContextMenuTriggerComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  ContextMenuLabelComponent,
  ContextMenuShortcutComponent,
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
        ContextMenuShortcutComponent
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<ContextMenuComponent>;

export const Default: Story = {
  render: () => ({
    template: `
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
    `,
  }),
};
