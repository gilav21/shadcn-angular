import { Meta, StoryObj } from '@storybook/angular';
import {
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
} from './card.component';
import { ButtonComponent } from './button.component';
import { InputComponent } from './input.component';
import { moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';

// Simple mock for Label if it doesn't exist yet, or just assume it does. 
// I'll check if Label exists. If NOT, I'll remove it from the template.
// Checking file list: label.component.ts exists (Step 5).

import { LabelComponent as RealLabelComponent } from './label.component';

const meta: Meta<CardComponent> = {
  title: 'UI/Card',
  component: CardComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        CardComponent,
        CardHeaderComponent,
        CardTitleComponent,
        CardDescriptionComponent,
        CardContentComponent,
        CardFooterComponent,
        ButtonComponent,
        InputComponent,
        RealLabelComponent,
        FormsModule
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<CardComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <ui-card class="w-[350px]">
              <ui-card-header>
                <ui-card-title>Create Project</ui-card-title>
                <ui-card-description>Deploy your new project in one-click.</ui-card-description>
              </ui-card-header>
              <ui-card-content>
                <div class="space-y-4">
                  <div class="space-y-2">
                    <ui-label for="name">Name</ui-label>
                    <ui-input placeholder="Name of your project" />
                  </div>
                  <div class="space-y-2">
                    <ui-label for="framework">Framework</ui-label>
                    <ui-input placeholder="Angular" />
                  </div>
                </div>
              </ui-card-content>
              <ui-card-footer class="flex justify-between">
                <ui-button variant="outline">Cancel</ui-button>
                <ui-button>Deploy</ui-button>
              </ui-card-footer>
            </ui-card>
    `,
  }),
};
