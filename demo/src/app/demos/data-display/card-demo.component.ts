import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  CardComponent,
  CardContentComponent,
  CardDescriptionComponent,
  CardFooterComponent,
  CardHeaderComponent,
  CardTitleComponent,
  InputComponent,
  LabelComponent,
  SwitchComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-card-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
    ButtonComponent,
    InputComponent,
    LabelComponent,
    SwitchComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="card" class="text-2xl font-semibold scroll-m-20">Card</h2>
      <p class="text-muted-foreground">Card component with header, content, and footer.</p>

      <div class="grid md:grid-cols-2 gap-6">
        <ui-card>
          <ui-card-header>
            <ui-card-title>Create Project</ui-card-title>
            <ui-card-description>Deploy your new project in one-click.</ui-card-description>
          </ui-card-header>
          <ui-card-content>
            <div class="space-y-4">
              <div class="space-y-2">
                <ui-label for="project-name">Name</ui-label>
                <ui-input id="project-name" placeholder="Name of your project" />
              </div>
              <div class="space-y-2">
                <ui-label for="project-framework">Framework</ui-label>
                <ui-input id="project-framework" placeholder="Angular" />
              </div>
            </div>
          </ui-card-content>
          <ui-card-footer class="flex justify-between">
            <ui-button variant="outline">Cancel</ui-button>
            <ui-button>Deploy</ui-button>
          </ui-card-footer>
        </ui-card>

        <ui-card>
          <ui-card-header>
            <ui-card-title>Notifications</ui-card-title>
            <ui-card-description>Manage your notification preferences.</ui-card-description>
          </ui-card-header>
          <ui-card-content>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <ui-label>Push Notifications</ui-label>
                <ui-switch />
              </div>
              <div class="flex items-center justify-between">
                <ui-label>Email Notifications</ui-label>
                <ui-switch />
              </div>
            </div>
          </ui-card-content>
        </ui-card>
      </div>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using title, description, and content inputs instead of content
        projection.</p>
      <div class="grid md:grid-cols-2 gap-6">
        <ui-card title="Quick Card" description="A card created with simple inputs."
          content="This card content was passed via the [content] input." />
        <ui-card title="Another Card" description="Minimal configuration required." />
      </div>
    </section>
  `,
})
export class CardDemoComponent {}
