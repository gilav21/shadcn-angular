import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { AfterViewInit, Component, viewChild } from '@angular/core';
import {
  SpeedDialComponent,
  SpeedDialTriggerComponent,
  SpeedDialMenuComponent,
  SpeedDialItemComponent,
  SpeedDialMaskComponent,
  SpeedDialContextTriggerDirective,
} from './index';
import { ButtonComponent } from '../button';
import { TooltipDirective } from '../tooltip';

// Opens the speed-dial as soon as the story mounts so the dimmed
// ui-speed-dial-mask backdrop is actually rendered/visible without
// requiring the viewer to interact with the trigger first.
@Component({
  selector: 'speed-dial-mask-demo',
  imports: [
    SpeedDialComponent,
    SpeedDialTriggerComponent,
    SpeedDialMenuComponent,
    SpeedDialItemComponent,
    SpeedDialMaskComponent,
    ButtonComponent,
  ],
  template: `
    <div class="h-[400px] w-full relative flex items-center justify-center border rounded-md bg-slate-50">
      <ui-speed-dial #dial type="circle" direction="up" [radius]="80">
        <ui-speed-dial-mask />
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
      <p class="absolute bottom-2 text-xs text-muted-foreground">The dimmed backdrop is <code>ui-speed-dial-mask</code>; click it to close.</p>
    </div>
  `,
})
class SpeedDialMaskDemoComponent implements AfterViewInit {
  private readonly dial = viewChild.required(SpeedDialComponent);

  ngAfterViewInit(): void {
    setTimeout(() => this.dial().show());
  }
}

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
        SpeedDialMaskDemoComponent,
        ButtonComponent,
        TooltipDirective,
      ],
    }),
  ],
  argTypes: {
    type: {
      control: 'select',
      options: ['linear', 'circle', 'semi-circle', 'quarter-circle'],
      description: 'Shape the menu items expand into when the dial opens.',
    },
    direction: {
      control: 'select',
      options: ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'],
      description: 'Direction the menu expands toward from the trigger.',
    },
    radius: {
      control: 'number',
      min: 40,
      max: 160,
      step: 10,
      description: 'Distance in pixels items travel from the trigger for circular types.',
    },
    transitionDelay: {
      control: 'number',
      min: 0,
      max: 200,
      step: 10,
      description: 'Stagger delay in milliseconds applied between successive item animations.',
    },
    disabled: { control: 'boolean', description: 'Disables opening/closing the speed dial.' },
  },
  args: {
    type: 'linear',
    direction: 'up',
    radius: 60,
    transitionDelay: 80,
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<SpeedDialComponent>;

const PLAYGROUND_TEMPLATE = `
  <div class="h-[600px] w-full relative flex items-center justify-center border rounded-md bg-slate-50">
    <ui-speed-dial [type]="type" [direction]="direction" [radius]="radius" [transitionDelay]="transitionDelay" [disabled]="disabled" class="absolute top-1/2">
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
`;

const render: NonNullable<Story['render']> = (args) => ({
  props: args,
  template: PLAYGROUND_TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. Click the round trigger to open. */
export const Playground: Story = { render };

export const Circle: Story = {
  args: { type: 'circle', radius: 90 },
  render,
};

export const SemiCircle: Story = {
  args: { type: 'semi-circle', direction: 'up', radius: 90 },
  render,
};

export const QuarterCircle: Story = {
  args: { type: 'quarter-circle', direction: 'up-right', radius: 90 },
  render,
};

export const Disabled: Story = {
  args: { disabled: true },
  render,
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

/** Renders `ui-speed-dial-mask` — the dimmed backdrop shown while the dial is open — by auto-opening on mount. */
export const MaskBackdrop: Story = {
  render: () => ({
    template: `<speed-dial-mask-demo />`,
  }),
};
