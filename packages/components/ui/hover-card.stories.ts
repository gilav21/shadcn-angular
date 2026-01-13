import { Meta, StoryObj } from '@storybook/angular';
import {
    HoverCardComponent,
    HoverCardTriggerComponent,
    HoverCardContentComponent,
} from './hover-card.component';
import { ButtonComponent } from './button.component';
import { AvatarComponent, AvatarImageComponent, AvatarFallbackComponent } from './avatar.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<HoverCardComponent> = {
    title: 'UI/HoverCard',
    component: HoverCardComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                HoverCardComponent,
                HoverCardTriggerComponent,
                HoverCardContentComponent,
                ButtonComponent,
                AvatarComponent,
                AvatarImageComponent,
                AvatarFallbackComponent
            ],
        }),
    ],
};

export default meta;
type Story = StoryObj<HoverCardComponent>;

export const Default: Story = {
    render: () => ({
        template: `
      <ui-hover-card>
        <ui-hover-card-trigger>
          <ui-button variant="link">@nextjs</ui-button>
        </ui-hover-card-trigger>
        <ui-hover-card-content class="w-80">
          <div class="flex justify-between space-x-4">
            <ui-avatar>
              <ui-avatar-image src="https://github.com/vercel.png" />
              <ui-avatar-fallback>VC</ui-avatar-fallback>
            </ui-avatar>
            <div class="space-y-1">
              <h4 class="text-sm font-semibold">@nextjs</h4>
              <p class="text-sm">
                The React Framework – created and maintained by @vercel.
              </p>
              <div class="flex items-center pt-2">
                <span class="text-xs text-muted-foreground mr-2">
                  <svg class="mr-1 h-3 w-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Joined December 2021
                </span>
              </div>
            </div>
          </div>
        </ui-hover-card-content>
      </ui-hover-card>
    `,
    }),
};
