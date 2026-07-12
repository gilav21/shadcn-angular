import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    SheetComponent,
    SheetTriggerComponent,
    SheetContentComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
    SheetDescriptionComponent,
    SheetFooterComponent,
    SheetCloseComponent,
} from '../sheet';
import { ButtonComponent } from '../button';
import { InputComponent } from '../input';
import { LabelComponent } from '../label';

// The interactive inputs (side/class/title/description) live on
// SheetContentComponent, not SheetComponent (which only holds open state), so
// `component` points at SheetContentComponent per the sub-component rule.
const meta: Meta<SheetContentComponent> = {
    title: 'UI/Sheet',
    component: SheetContentComponent,
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
                LabelComponent,
            ],
        }),
    ],
    argTypes: {
        side: { control: 'select', options: ['top', 'bottom', 'left', 'right'], description: 'Edge of the viewport the sheet slides in from.' },
        class: { control: 'text', description: 'Extra classes merged onto the sheet content panel.' },
        title: { control: 'text', description: 'Simple-mode title rendered in an auto-generated header.' },
        description: { control: 'text', description: 'Simple-mode description rendered below the title.' },
        locale: { control: false, description: 'Locale dictionary or registry key; falls back to `UI_LOCALE_ID`.' },
    },
    args: {
        side: 'right',
        class: '',
        title: 'Edit profile',
        description: "Make changes to your profile here. Click save when you're done.",
    },
};

export default meta;
type Story = StoryObj<SheetContentComponent>;

/** Interactive playground — every input is wired to the Controls panel (simple/input-driven mode). */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-sheet>
        <ui-sheet-trigger>
          <ui-button variant="outline">Open Sheet</ui-button>
        </ui-sheet-trigger>
        <ui-sheet-content [side]="side" [class]="class" [title]="title" [description]="description">
          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <ui-label for="name-pg" class="text-right">Name</ui-label>
              <ui-input id="name-pg" value="Pedro Duarte" class="col-span-3" />
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

/**
 * Template mode: full control over header/content via projection, using the
 * dedicated sub-components instead of the `title`/`description` inputs.
 */
export const TemplateMode: Story = {
    render: () => ({
        template: `
      <ui-sheet>
        <ui-sheet-trigger>
          <ui-button variant="outline">Open Sheet (Template)</ui-button>
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

/** Simple mode: `title`/`description` inputs auto-generate the header. */
export const SimpleMode: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-sheet>
        <ui-sheet-trigger>
          <ui-button variant="outline">Open Sheet (Simple)</ui-button>
        </ui-sheet-trigger>
        <ui-sheet-content
          [side]="side"
          [title]="title"
          [description]="description"
        >
          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <ui-label for="name-s" class="text-right">Name</ui-label>
              <ui-input id="name-s" value="Pedro Duarte" class="col-span-3" />
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
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        `,
    }),
};
