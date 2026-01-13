import { Meta, StoryObj } from '@storybook/angular';
import {
  SpeedDialComponent,
  SpeedDialTriggerComponent,
  SpeedDialMenuComponent,
  SpeedDialItemComponent,
  SpeedDialMaskComponent,
  SpeedDialContextTriggerDirective,
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
        SpeedDialContextTriggerDirective,
        ButtonComponent,
        TooltipDirective
      ],
    }),
  ],
  argTypes: {
    type: { control: 'select', options: ['linear', 'circle', 'semi-circle', 'quarter-circle'] },
    direction: { control: 'select', options: ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'] },
    radius: { control: 'number' }
  },
  args: {
    type: 'linear',
    direction: 'up',
    radius: 60
  },
};

export default meta;
type Story = StoryObj<SpeedDialComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="h-[600px] w-full relative flex items-center justify-center border rounded-md bg-slate-50">
        <ui-speed-dial [type]="type" [direction]="direction" [radius]="radius" class="absolute top-1/2">
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

export const ContextTriggerDirective: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Use the `[uiSpeedDialContextTrigger]` directive to show the speed dial at the right-click position on any element.',
      },
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <ui-speed-dial #speedDial [type]="type" [direction]="direction" [radius]="radius">
        <ui-speed-dial-menu ariaLabel="Context actions">
          <ui-speed-dial-item>
            <ui-button size="icon" class="rounded-full shadow-md" variant="secondary" aria-label="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </ui-button>
          </ui-speed-dial-item>
          <ui-speed-dial-item>
            <ui-button size="icon" class="rounded-full shadow-md" variant="secondary" aria-label="Copy">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </ui-button>
          </ui-speed-dial-item>
          <ui-speed-dial-item>
            <ui-button size="icon" class="rounded-full shadow-md" variant="destructive" aria-label="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </ui-button>
          </ui-speed-dial-item>
        </ui-speed-dial-menu>
      </ui-speed-dial>

      <div
        [uiSpeedDialContextTrigger]="speedDial"
        class="h-[250px] w-full flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/50 text-muted-foreground"
      >
        Right-click anywhere in this area to open the speed dial menu
      </div>
    `,
  }),
};
