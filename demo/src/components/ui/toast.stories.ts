import { Meta, StoryObj, applicationConfig } from '@storybook/angular';
import { ToastComponent, ToasterComponent, ToastService } from './toast.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';
import { Component, inject } from '@angular/core';

// Create a wrapper component to trigger toasts
@Component({
    selector: 'toast-story-wrapper',
    standalone: true,
    imports: [ButtonComponent, ToasterComponent],
    template: `
    <div class="flex flex-col gap-4">
      <ui-toaster />
      <div class="flex gap-2">
        <ui-button (click)="showDefault()">Default</ui-button>
        <ui-button variant="destructive" (click)="showDestructive()">Destructive</ui-button>
        <ui-button variant="outline" (click)="showSuccess()">Success</ui-button>
        <ui-button variant="secondary" (click)="showWithAction()">With Action</ui-button>
      </div>
    </div>
  `
})
class ToastStoryWrapperComponent {
    private toastService = inject(ToastService);

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

const meta: Meta<ToastStoryWrapperComponent> = {
    title: 'UI/Toast',
    component: ToastStoryWrapperComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ToastComponent, ToasterComponent, ButtonComponent],
            providers: [ToastService], // Ensure service is provided
        }),
    ],
};

export default meta;
type Story = StoryObj<ToastStoryWrapperComponent>;

export const Default: Story = {
    render: () => ({
        template: `<toast-story-wrapper></toast-story-wrapper>`,
    }),
};
