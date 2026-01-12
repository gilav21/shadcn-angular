import { Meta, StoryObj, applicationConfig } from '@storybook/angular';
import { ToastComponent, ToasterComponent, ToastService } from './toast.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';
import { Component, inject, input } from '@angular/core';

// Create a wrapper component to trigger toasts with configurable position
@Component({
    selector: 'toast-story-wrapper',
    imports: [ButtonComponent, ToasterComponent],
    template: `
    <div class="flex flex-col gap-4">
      <ui-toaster [vertical]="vertical()" [horizontal]="horizontal()" />
      <div class="flex gap-2 flex-wrap">
        <ui-button (click)="showDefault()">Default</ui-button>
        <ui-button variant="destructive" (click)="showDestructive()">Destructive</ui-button>
        <ui-button variant="outline" (click)="showSuccess()">Success</ui-button>
        <ui-button variant="secondary" (click)="showWithAction()">With Action</ui-button>
      </div>
      <p class="text-sm text-muted-foreground">
        Position: {{ vertical() }}-{{ horizontal() }}
      </p>
    </div>
  `
})
class ToastStoryWrapperComponent {
    private toastService = inject(ToastService);

    vertical = input<'top' | 'center' | 'bottom'>('bottom');
    horizontal = input<'start' | 'center' | 'end'>('end');

    showDefault() {
        this.toastService.toast({
            title: 'Scheduled: Catch up',
            description: 'Friday, February 10, 2023 at 5:57 PM',
        });
    }

    showDestructive() {
        this.toastService.error('Uh oh! Something went wrong.', 'There was a problem with your request.');
    }

    showSuccess() {
        this.toastService.success('Success!', 'Your changes have been saved.');
    }

    showWithAction() {
        this.toastService.toast({
            title: 'Uh oh! Something went wrong.',
            description: 'There was a problem with your request.',
            action: {
                label: 'Try again',
                onClick: () => console.log('Undo'),
            },
        });
    }
}

const meta: Meta<ToastStoryWrapperComponent & { vertical: string; horizontal: string }> = {
    title: 'UI/Toast',
    component: ToastStoryWrapperComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ToastComponent, ToasterComponent, ButtonComponent],
            providers: [ToastService],
        }),
    ],
    argTypes: {
        vertical: {
            control: 'select',
            options: ['top', 'center', 'bottom'],
            description: 'Vertical position of toasts',
        },
        horizontal: {
            control: 'select',
            options: ['start', 'center', 'end'],
            description: 'Horizontal position of toasts',
        }
    },
    args: {
        vertical: 'bottom',
        horizontal: 'end',
    },
};

export default meta;
type Story = StoryObj<ToastStoryWrapperComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<toast-story-wrapper [vertical]="vertical" [horizontal]="horizontal"></toast-story-wrapper>`,
    }),
};

export const TopStart: Story = {
    args: {
        vertical: 'top',
        horizontal: 'start',
    },
    render: (args) => ({
        props: args,
        template: `<toast-story-wrapper [vertical]="vertical" [horizontal]="horizontal"></toast-story-wrapper>`,
    }),
};

export const TopCenter: Story = {
    args: {
        vertical: 'top',
        horizontal: 'center',
    },
    render: (args) => ({
        props: args,
        template: `<toast-story-wrapper [vertical]="vertical" [horizontal]="horizontal"></toast-story-wrapper>`,
    }),
};

export const TopEnd: Story = {
    args: {
        vertical: 'top',
        horizontal: 'end',
    },
    render: (args) => ({
        props: args,
        template: `<toast-story-wrapper [vertical]="vertical" [horizontal]="horizontal"></toast-story-wrapper>`,
    }),
};

export const CenterStart: Story = {
    args: {
        vertical: 'center',
        horizontal: 'start',
    },
    render: (args) => ({
        props: args,
        template: `<toast-story-wrapper [vertical]="vertical" [horizontal]="horizontal"></toast-story-wrapper>`,
    }),
};

export const CenterEnd: Story = {
    args: {
        vertical: 'center',
        horizontal: 'end',
    },
    render: (args) => ({
        props: args,
        template: `<toast-story-wrapper [vertical]="vertical" [horizontal]="horizontal"></toast-story-wrapper>`,
    }),
};

export const BottomStart: Story = {
    args: {
        vertical: 'bottom',
        horizontal: 'start',
    },
    render: (args) => ({
        props: args,
        template: `<toast-story-wrapper [vertical]="vertical" [horizontal]="horizontal"></toast-story-wrapper>`,
    }),
};

export const BottomCenter: Story = {
    args: {
        vertical: 'bottom',
        horizontal: 'center',
    },
    render: (args) => ({
        props: args,
        template: `<toast-story-wrapper [vertical]="vertical" [horizontal]="horizontal"></toast-story-wrapper>`,
    }),
};
