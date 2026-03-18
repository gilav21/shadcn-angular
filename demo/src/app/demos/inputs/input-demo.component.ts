import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  InputComponent,
  LabelComponent,
  InputGroupComponent,
  InputGroupAddonComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-input-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InputComponent,
    LabelComponent,
    InputGroupComponent,
    InputGroupAddonComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="input" class="text-2xl font-semibold scroll-m-20">Input</h2>
      <p class="text-muted-foreground">Text input with label support.</p>

      <div class="space-y-2 max-w-sm">
        <ui-label>Input Group (Standard Input)</ui-label>
        <ui-input-group>
          <ui-input-group-addon>$</ui-input-group-addon>
          <ui-input placeholder="0.00"></ui-input>
          <ui-input-group-addon>USD</ui-input-group-addon>
        </ui-input-group>
        <p class="text-xs text-muted-foreground">Using standard ui-input inside group (auto-ghost)</p>
      </div>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label for="email">Email</ui-label>
          <ui-input type="email" placeholder="Enter your email" [attr.id]="'email'" />
        </div>

        <div class="space-y-2">
          <ui-label for="password">Password</ui-label>
          <ui-input type="password" placeholder="Enter password" [attr.id]="'password'" />
        </div>

        <div class="space-y-2">
          <ui-label for="underline-input">Underline Variant</ui-label>
          <ui-input placeholder="Underline input" [attr.id]="'underline-input'" variant="underline" />
        </div>

        <ui-input placeholder="Disabled input" [disabled]="true" />
      </div>

      <div class="grid gap-4 max-w-sm pt-4">
        <div class="space-y-2">
          <ui-label>Input Group (Underline)</ui-label>
          <ui-input-group variant="underline">
            <ui-input-group-addon>$</ui-input-group-addon>
            <ui-input placeholder="0.00"></ui-input>
            <ui-input-group-addon>USD</ui-input-group-addon>
          </ui-input-group>
        </div>

        <div class="space-y-2">
          <ui-label>Input Group (Ghost)</ui-label>
          <div class="rounded-lg border p-1">
            <ui-input-group variant="ghost">
              <ui-input-group-addon>$</ui-input-group-addon>
              <ui-input placeholder="0.00"></ui-input>
              <ui-input-group-addon>USD</ui-input-group-addon>
            </ui-input-group>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class InputDemoComponent {}
