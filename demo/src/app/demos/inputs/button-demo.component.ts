import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent, IconComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-buttons-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent],
  template: `
    <section class="space-y-4">
      <h2 id="buttons" class="text-2xl font-semibold scroll-m-20">Buttons</h2>
      <p class="text-muted-foreground">Button component with multiple variants and sizes.</p>

      <div class="flex flex-wrap gap-4">
        <ui-button>Default</ui-button>
        <ui-button variant="secondary">Secondary</ui-button>
        <ui-button variant="outline">Outline</ui-button>
        <ui-button variant="ghost">Ghost</ui-button>
        <ui-button variant="link">Link</ui-button>
        <ui-button variant="destructive">Destructive</ui-button>
      </div>

      <div class="flex flex-wrap gap-4 items-center">
        <ui-button size="sm">Small</ui-button>
        <ui-button>Default</ui-button>
        <ui-button size="lg">Large</ui-button>
        <ui-button size="icon">
          <ui-icon name="plus" size="sm" />
        </ui-button>
      </div>

      <ui-button [disabled]="true">Disabled</ui-button>

      <div class="flex flex-wrap gap-4 items-center mt-4">
        <ui-button [ripple]="true">Default Ripple</ui-button>
        <ui-button variant="secondary" [ripple]="true">Secondary Ripple</ui-button>
        <ui-button variant="outline" [ripple]="true">Outline Ripple</ui-button>
        <ui-button variant="ghost" [ripple]="true">Ghost Ripple</ui-button>
        <ui-button variant="link" [ripple]="true">Link Ripple</ui-button>
        <ui-button variant="destructive" [ripple]="true">Destructive Ripple</ui-button>
      </div>

      <div class="flex flex-wrap gap-4 items-center mt-4">
        <ui-button [ripple]="true" rippleColor="rgba(255, 0, 0, 0.5)">Custom Red Ripple</ui-button>
        <ui-button variant="secondary" [ripple]="true" rippleColor="rgba(0, 255, 0, 0.5)">Custom Green Ripple</ui-button>
        <ui-button variant="outline" [ripple]="true" rippleColor="rgba(0, 0, 255, 0.5)">Custom Blue Ripple</ui-button>
        <ui-button variant="ghost" [ripple]="true" rippleColor="rgba(255, 255, 0, 0.5)">Custom Yellow Ripple</ui-button>
        <ui-button variant="link" [ripple]="true" rippleColor="rgba(255, 0, 255, 0.5)">Custom Magenta Ripple</ui-button>
        <ui-button variant="destructive" [ripple]="true" rippleColor="rgba(0, 255, 255, 0.5)">Custom Cyan Ripple</ui-button>
      </div>
    </section>
  `,
})
export class ButtonDemoComponent {}
