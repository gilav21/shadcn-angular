import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  LabelComponent,
  SplitButtonComponent,
  SplitButtonPrimaryComponent,
  SplitButtonMenuComponent,
  SplitButtonItemComponent,
  SplitButtonItem,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-split-button-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LabelComponent,
    SplitButtonComponent,
    SplitButtonPrimaryComponent,
    SplitButtonMenuComponent,
    SplitButtonItemComponent,
  ],
  template: `
    <section class="space-y-8">
      <div class="space-y-4">
        <h2 id="split-button" class="text-2xl font-semibold scroll-m-20">Split Button</h2>
        <p class="text-muted-foreground">A button with primary action and dropdown menu.</p>
      </div>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>Data Driven</ui-label>
          <ui-split-button label="Save Changes" [items]="splitButtonItems" (primaryClick)="onSplitPrimaryClick()"
            (itemClick)="onSplitItemClick($event)" />
        </div>

        <div class="space-y-2">
          <ui-label>Content Projection</ui-label>
          <ui-split-button>
            <ui-split-button-primary (click)="onSplitPrimaryClick()" (keydown.enter)="onSplitPrimaryClick()">
              Deploy
            </ui-split-button-primary>
            <ui-split-button-menu>
              <ui-split-button-item (click)="onSplitItemClick({label: 'Staging'})" (keydown.enter)="onSplitItemClick({label: 'Staging'})">
                Deploy to Staging
              </ui-split-button-item>
              <ui-split-button-item (click)="onSplitItemClick({label: 'Production'})" (keydown.enter)="onSplitItemClick({label: 'Production'})">
                Deploy to Production
              </ui-split-button-item>
            </ui-split-button-menu>
          </ui-split-button>
        </div>

        <div class="space-y-2">
          <ui-label>Variants</ui-label>
          <div class="flex gap-2 flex-wrap">
            <ui-split-button label="Secondary" variant="secondary" [items]="splitButtonItems" />
            <ui-split-button label="Destructive" variant="destructive" [items]="splitButtonItems" />
            <ui-split-button label="Outline" variant="outline" [items]="splitButtonItems" />
          </div>
        </div>

        <div class="space-y-2">
          <ui-label>Sizes</ui-label>
          <div class="flex gap-2 items-center flex-wrap">
            <ui-split-button label="Small" size="sm" [items]="splitButtonItems" />
            <ui-split-button label="Default" [items]="splitButtonItems" />
            <ui-split-button label="Large" size="lg" [items]="splitButtonItems" />
          </div>
        </div>
      </div>
    </section>
  `,
})
export class SplitButtonDemoComponent {
  readonly splitButtonItems: SplitButtonItem[] = [
    { label: 'Edit', value: 'edit', icon: '✎' },
    { label: 'Duplicate', value: 'duplicate', icon: '📄' },
    { label: 'Delete', value: 'delete', icon: '🗑️', disabled: true },
  ];

  onSplitPrimaryClick() {
    alert('Primary action triggered!');
  }

  onSplitItemClick(item: Partial<SplitButtonItem>) {
    alert(`Menu item clicked: ${item.label}`);
  }
}
