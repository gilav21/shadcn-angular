import { Meta, StoryObj } from '@storybook/angular';
import {
  SpeedDialComponent,
  SpeedDialTriggerComponent,
  SpeedDialMenuComponent,
  SpeedDialItemComponent,
  SpeedDialMaskComponent,
} from './speed-dial.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';
import { TooltipDirective } from './tooltip.component';

const meta: Meta<SpeedDialComponent> = {
  title: 'UI/SpeedDial',
  component: SpeedDialComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        SpeedDialComponent,
        SpeedDialTriggerComponent,
        SpeedDialMenuComponent,
        SpeedDialItemComponent,
        SpeedDialMaskComponent,
        ButtonComponent,
        TooltipDirective
      ],
    }),
  ],
  argTypes: {
    type: { control: 'select', options: ['linear', 'circle', 'semi-circle', 'quarter-circle'] },
    direction: { control: 'select', options: ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'] },
  },
  args: {
    type: 'linear',
    direction: 'up',
  },
};

export default meta;
type Story = StoryObj<SpeedDialComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="h-[300px] w-full relative flex items-center justify-center border rounded-md bg-slate-50">
        <ui-speed-dial [type]="type" [direction]="direction">
          <ui-speed-dial-trigger ariaLabel="Toggle actions">
            <ui-button size="icon" class="rounded-full h-12 w-12 shadow-lg" aria-label="Open menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </ui-button>
          </ui-speed-dial-trigger>
          <ui-speed-dial-menu ariaLabel="Speed dial actions">
            <ui-speed-dial-item>
              <ui-button size="icon" class="rounded-full shadow-md" variant="secondary" aria-label="Edit">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon" class="rounded-full shadow-md" variant="secondary" aria-label="Copy">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
               <ui-button size="icon" class="rounded-full shadow-md" variant="secondary" aria-label="Delete">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
              </ui-button>
            </ui-speed-dial-item>
          </ui-speed-dial-menu>
        </ui-speed-dial>
      </div>
    `,
  }),
};
