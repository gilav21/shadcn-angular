import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonComponent, SpinnerComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-spinner-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent, ButtonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="spinner" class="text-2xl font-semibold scroll-m-20">Spinner</h2>
      <p class="text-muted-foreground">
        Loading indicator with animated spinning. Supports preset sizes and custom pixel sizes.
      </p>

      <div class="flex flex-wrap items-end gap-6">
        <div class="flex flex-col items-center gap-2">
          <ui-spinner size="xs" />
          <span class="text-xs text-muted-foreground">XS</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <ui-spinner size="sm" />
          <span class="text-xs text-muted-foreground">SM</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <ui-spinner />
          <span class="text-xs text-muted-foreground">Default</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <ui-spinner size="lg" />
          <span class="text-xs text-muted-foreground">LG</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <ui-spinner size="xl" />
          <span class="text-xs text-muted-foreground">XL</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <ui-spinner size="page" />
          <span class="text-xs text-muted-foreground">Page</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <ui-spinner [customSize]="64" />
          <span class="text-xs text-muted-foreground">64px</span>
        </div>
      </div>

      <div class="flex items-center gap-4 mt-4">
        <ui-button [disabled]="true">
          <ui-spinner size="xs" class="mr-2" />
          Loading...
        </ui-button>
      </div>
    </section>
  `,
})
export class SpinnerDemoComponent {}
