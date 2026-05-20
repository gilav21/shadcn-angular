import { Meta, StoryObj } from '@storybook/angular';
import { DockComponent } from './dock.component';
import { DockItemComponent } from './sub/dock-item.component';
import { DockIconComponent } from './sub/dock-icon.component';
import { DockLabelComponent } from './sub/dock-label.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<DockComponent> = {
  title: 'UI/Dock',
  component: DockComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [DockItemComponent, DockIconComponent, DockLabelComponent],
    }),
  ],
  argTypes: {
    magnification: {
      control: { type: 'range', min: 40, max: 100, step: 1 },
      description: 'The maximum width of the magnified item.',
    },
    distance: {
      control: { type: 'range', min: 0, max: 300, step: 10 },
      description: 'The distance from the cursor where the magnification effect is applied.',
    },
    position: {
      control: 'select',
      options: ['bottom', 'top', 'left', 'right'],
      description: 'The position of the dock on the screen.',
    },
    class: {
      control: 'text',
      description: 'Additional CSS classes to apply to the dock container.',
    },
  },
  args: {
    magnification: 60,
    distance: 100,
    position: 'bottom',
    class: '',
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="h-[400px] w-full flex items-center justify-center bg-gray-100 relative overflow-hidden">
        <div class="absolute inset-0 pointer-events-none border border-dashed border-gray-300"></div>
        <ui-dock [magnification]="magnification" [distance]="distance" [position]="position" [class]="class">
          <ui-dock-item>
            <ui-dock-label>Finder</ui-dock-label>
            <ui-dock-icon class="bg-blue-500 text-white rounded-xl shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </ui-dock-icon>
          </ui-dock-item>
          <ui-dock-item>
            <ui-dock-label>Mail</ui-dock-label>
            <ui-dock-icon class="bg-blue-600 text-white rounded-xl shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </ui-dock-icon>
          </ui-dock-item>
          <ui-dock-item>
            <ui-dock-label>Photos</ui-dock-label>
            <ui-dock-icon class="bg-linear-to-tr from-yellow-400 via-red-500 to-purple-500 text-white rounded-xl shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </ui-dock-icon>
          </ui-dock-item>
          <ui-dock-item>
            <ui-dock-label>Settings</ui-dock-label>
            <ui-dock-icon class="bg-gray-500 text-white rounded-xl shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </ui-dock-icon>
          </ui-dock-item>
        </ui-dock>
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<DockComponent>;

export const Default: Story = {};

export const SmallMagnification: Story = {
  args: {
    magnification: 50,
    distance: 80,
  },
};

export const LargeMagnification: Story = {
  args: {
    magnification: 100,
    distance: 200,
  },
};

export const TopPosition: Story = {
  args: {
    position: 'top',
  }
}

export const SimpleMode: Story = {
  args: {
    items: [
      { label: 'Home', icon: '🏠' },
      { label: 'Profile', icon: '👤' },
      { label: 'Settings', icon: '⚙️' },
      { label: 'Messages', icon: '✉️' },
    ],
    magnification: 60,
    distance: 100,
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="h-[300px] w-full flex items-center justify-center bg-gray-100 relative">
        <ui-dock [items]="items" [magnification]="magnification" [distance]="distance" />
      </div>
    `
  })
}
