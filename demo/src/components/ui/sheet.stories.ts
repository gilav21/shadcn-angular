import { Meta, StoryObj } from '@storybook/angular';
import {
    SheetComponent,
    SheetTriggerComponent,
    SheetContentComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
    SheetDescriptionComponent,
    SheetFooterComponent,
    SheetCloseComponent,
} from './sheet.component';
import { ButtonComponent } from './button.component';
import { InputComponent } from './input.component';
import { LabelComponent } from './label.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<SheetComponent> = {
    title: 'UI/Sheet',
    component: SheetComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                SheetComponent,
                SheetTriggerComponent,
                SheetContentComponent,
                SheetHeaderComponent,
                SheetTitleComponent,
                SheetDescriptionComponent,
                SheetFooterComponent,
                SheetCloseComponent,
                ButtonComponent,
                InputComponent,
                LabelComponent
            ],
        }),
    ],
};

export default meta;
type Story = StoryObj<SheetComponent>;

export const Default: Story = {
    render: () => ({
        template: `
      <ui-sheet>
        <ui-sheet-trigger>
          <ui-button variant="outline">Open Sheet</ui-button>
        </ui-sheet-trigger>
        <ui-sheet-content side="right">
          <ui-sheet-header>
            <ui-sheet-title>Edit profile</ui-sheet-title>
            <ui-sheet-description>
              Make changes to your profile here. Click save when you're done.
            </ui-sheet-description>
          </ui-sheet-header>
          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <ui-label for="name" class="text-right">
                Name
              </ui-label>
              <ui-input id="name" value="Pedro Duarte" class="col-span-3" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <ui-label for="username" class="text-right">
                Username
              </ui-label>
              <ui-input id="username" value="@peduarte" class="col-span-3" />
            </div>
          </div>
          <ui-sheet-footer>
            <ui-sheet-close>
              <ui-button type="submit">Save changes</ui-button>
            </ui-sheet-close>
          </ui-sheet-footer>
        </ui-sheet-content>
      </ui-sheet>
    `,
    }),
};

export const SideInteractions: Story = {
    render: () => ({
        template: `
        <div class="grid grid-cols-2 gap-2">
            <ui-sheet>
                <ui-sheet-trigger><ui-button variant="outline">Top</ui-button></ui-sheet-trigger>
                <ui-sheet-content side="top">
                    <ui-sheet-header>
                        <ui-sheet-title>Top Sheet</ui-sheet-title>
                    </ui-sheet-header>
                </ui-sheet-content>
            </ui-sheet>
             <ui-sheet>
                <ui-sheet-trigger><ui-button variant="outline">Bottom</ui-button></ui-sheet-trigger>
                <ui-sheet-content side="bottom">
                     <ui-sheet-header>
                        <ui-sheet-title>Bottom Sheet</ui-sheet-title>
                    </ui-sheet-header>
                </ui-sheet-content>
            </ui-sheet>
             <ui-sheet>
                <ui-sheet-trigger><ui-button variant="outline">Left</ui-button></ui-sheet-trigger>
                <ui-sheet-content side="left">
                     <ui-sheet-header>
                        <ui-sheet-title>Left Sheet</ui-sheet-title>
                    </ui-sheet-header>
                </ui-sheet-content>
            </ui-sheet>
             <ui-sheet>
                <ui-sheet-trigger><ui-button variant="outline">Right</ui-button></ui-sheet-trigger>
                <ui-sheet-content side="right">
                     <ui-sheet-header>
                        <ui-sheet-title>Right Sheet</ui-sheet-title>
                    </ui-sheet-header>
                </ui-sheet-content>
            </ui-sheet>
        </div>
        `
    })
}
