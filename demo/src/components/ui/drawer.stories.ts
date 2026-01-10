import { Meta, StoryObj } from '@storybook/angular';
import {
  DrawerComponent,
  DrawerTriggerComponent,
  DrawerContentComponent,
  DrawerHeaderComponent,
  DrawerTitleComponent,
  DrawerDescriptionComponent,
  DrawerFooterComponent,
  DrawerCloseComponent,
} from './drawer.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<DrawerComponent> = {
  title: 'UI/Drawer',
  component: DrawerComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        DrawerComponent,
        DrawerTriggerComponent,
        DrawerContentComponent,
        DrawerHeaderComponent,
        DrawerTitleComponent,
        DrawerDescriptionComponent,
        DrawerFooterComponent,
        DrawerCloseComponent,
        ButtonComponent
      ],
    }),
  ],
  argTypes: {
    direction: {
      control: 'radio',
      options: ['top', 'right', 'bottom', 'left'],
    },
    rtl: {
      control: 'boolean',
      description: 'Enable right-to-left layout',
    },
  },
  args: {
    direction: 'bottom',
    rtl: false,
  },
};

export default meta;
type Story = StoryObj<DrawerComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-drawer [direction]="direction" [rtl]="rtl">
        <ui-drawer-trigger>
          <button shButton variant="outline">Open Drawer</button>
        </ui-drawer-trigger>
        <ui-drawer-content>
          <div class="mx-auto w-full max-w-sm">
            <ui-drawer-header>
              <ui-drawer-title>Move Goal</ui-drawer-title>
              <ui-drawer-description>Set your daily activity goal.</ui-drawer-description>
            </ui-drawer-header>
            <div class="p-4 pb-0">
              <div class="flex items-center justify-center space-x-2">
                <div class="flex-1 text-center">
                  <div class="text-7xl font-bold tracking-tighter">
                    350
                  </div>
                  <div class="text-[0.70rem] uppercase text-muted-foreground">
                    Calories/day
                  </div>
                </div>
              </div>
            </div>
            <ui-drawer-footer>
              <button shButton>Submit</button>
              <ui-drawer-close>
                <button shButton variant="outline">Cancel</button>
              </ui-drawer-close>
            </ui-drawer-footer>
          </div>
        </ui-drawer-content>
      </ui-drawer>
    `,
  }),
};
