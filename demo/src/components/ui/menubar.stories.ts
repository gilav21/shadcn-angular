import { Meta, StoryObj } from '@storybook/angular';
import {
    MenubarComponent,
    MenubarMenuComponent,
    MenubarTriggerComponent,
    MenubarContentComponent,
    MenubarItemComponent,
    MenubarSeparatorComponent,
    MenubarShortcutComponent,
    MenubarSubComponent,
    MenubarSubTriggerComponent,
    MenubarSubContentComponent,
} from './menubar.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<MenubarComponent> = {
    title: 'UI/Menubar',
    component: MenubarComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                MenubarComponent,
                MenubarMenuComponent,
                MenubarTriggerComponent,
                MenubarContentComponent,
                MenubarItemComponent,
                MenubarSeparatorComponent,
                MenubarShortcutComponent,
                MenubarSubComponent,
                MenubarSubTriggerComponent,
                MenubarSubContentComponent,
            ],
        }),
    ],
};

export default meta;
type Story = StoryObj<MenubarComponent>;

export const Default: Story = {
    render: () => ({
        template: `
      <ui-menubar>
        <ui-menubar-menu>
          <ui-menubar-trigger>File</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item>
              New Tab <ui-menubar-shortcut>⌘T</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item>
              New Window <ui-menubar-shortcut>⌘N</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item [disabled]="true">
              New Incognito Window
            </ui-menubar-item>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-sub>
              <ui-menubar-sub-trigger>Share</ui-menubar-sub-trigger>
              <ui-menubar-sub-content>
                <ui-menubar-item>Email link</ui-menubar-item>
                <ui-menubar-item>Messages</ui-menubar-item>
                <ui-menubar-item>Notes</ui-menubar-item>
              </ui-menubar-sub-content>
            </ui-menubar-sub>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-item>
              Print... <ui-menubar-shortcut>⌘P</ui-menubar-shortcut>
            </ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>Edit</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item>
              Undo <ui-menubar-shortcut>⌘Z</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item>
              Redo <ui-menubar-shortcut>⇧⌘Z</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-sub>
              <ui-menubar-sub-trigger>Find</ui-menubar-sub-trigger>
              <ui-menubar-sub-content>
                <ui-menubar-item>Search the web</ui-menubar-item>
                <ui-menubar-separator></ui-menubar-separator>
                <ui-menubar-item>Find...</ui-menubar-item>
                <ui-menubar-item>Find Next</ui-menubar-item>
                <ui-menubar-item>Find Previous</ui-menubar-item>
              </ui-menubar-sub-content>
            </ui-menubar-sub>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-item>Cut</ui-menubar-item>
            <ui-menubar-item>Copy</ui-menubar-item>
            <ui-menubar-item>Paste</ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>View</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item [inset]="true">
              Reload <ui-menubar-shortcut>⌘R</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item [disabled]="true" [inset]="true">
              Force Reload <ui-menubar-shortcut>⇧⌘R</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-item [inset]="true">Toggle Fullscreen</ui-menubar-item>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-item [inset]="true">Hide Sidebar</ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>Profiles</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item [inset]="true">
              Andy
            </ui-menubar-item>
            <ui-menubar-item [inset]="true">
              Benoit
            </ui-menubar-item>
            <ui-menubar-item [inset]="true">
              Luis
            </ui-menubar-item>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-item [inset]="true">
              Edit...
            </ui-menubar-item>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-item [inset]="true">
              Add Profile...
            </ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
      </ui-menubar>
    `,
    }),
};
