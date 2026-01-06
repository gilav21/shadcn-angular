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
import { LabelComponent } from './label.component'; // Assuming Label exists, if not I might need to skip or mock
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
          <ui-card-title>Create project</ui-card-title>
          <ui-card-description>Deploy your new project in one-click.</ui-card-description>
        </ui-card-header>
        <ui-card-content>
          <form>
            <div class="grid w-full items-center gap-4">
              <div class="flex flex-col space-y-1.5">
                <ui-label htmlFor="name">Name</ui-label>
                <ui-input id="name" placeholder="Name of your project" />
              </div>
            </div>
          </form>
        </ui-card-content>
        <ui-card-footer class="flex justify-between">
          <button shButton variant="outline">Cancel</button>
          <button shButton>Deploy</button>
        </ui-card-footer>
      </ui-card>
    `,
    }),
};
