import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    HoverCardComponent,
    HoverCardTriggerComponent,
    HoverCardContentComponent,
} from './index';
import { ButtonComponent } from '../button';
import { AvatarComponent, AvatarImageComponent, AvatarFallbackComponent } from '../avatar';

type HoverCardStoryProps = HoverCardContentComponent;

const meta: Meta<HoverCardStoryProps> = {
    title: 'UI/HoverCard',
    component: HoverCardContentComponent,
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
                AvatarFallbackComponent,
            ],
        }),
    ],
    argTypes: {
        align: {
            control: 'select',
            options: ['start', 'center', 'end'],
            description: 'Horizontal alignment of the content relative to the trigger.',
        },
        side: {
            control: 'select',
            options: ['top', 'bottom'],
            description: 'Which side of the trigger the content opens on.',
        },
        title: { control: 'text', description: 'Simple-mode title text.' },
        description: { control: 'text', description: 'Simple-mode description text.' },
        class: { control: 'text', description: 'Extra classes merged onto the content panel.' },
    },
    args: {
        align: 'center',
        side: 'bottom',
        title: '@angular',
        description: 'The modern web developer\'s platform.',
        class: '',
    },
};

export default meta;
type Story = StoryObj<HoverCardStoryProps>;

const SIMPLE_TEMPLATE = `
    <ui-hover-card>
        <ui-hover-card-trigger>
            <ui-button variant="link">@angular</ui-button>
        </ui-hover-card-trigger>
        <ui-hover-card-content
            [align]="align" [side]="side"
            [title]="title" [description]="description" [class]="class"
        />
    </ui-hover-card>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: SIMPLE_TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel (simple/data-driven mode). */
export const Playground: Story = { render };

export const SimpleMode: Story = {
    render,
};

export const CustomContent: Story = {
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

export const SideTop: Story = {
    args: { side: 'top' },
    render,
};

export const AlignStart: Story = {
    args: { align: 'start' },
    render,
};

export const AlignEnd: Story = {
    args: { align: 'end' },
    render,
};
