import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SeparatorComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-separator-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeparatorComponent],
  template: `
    <section class="space-y-4">
      <h2 id="separator" class="text-2xl font-semibold scroll-m-20">Separator</h2>
      <p class="text-muted-foreground">Visually or semantically separates content.</p>

      <div class="space-y-4">
        <div>
          <h4 class="text-sm font-medium leading-none">Radix Primitives</h4>
          <p class="text-sm text-muted-foreground">
            An open-source UI component library.
          </p>
        </div>
        <ui-separator class="my-4" />
        <div class="flex h-5 items-center space-x-4 text-sm">
          <div>Blog</div>
          <ui-separator orientation="vertical" />
          <div>Docs</div>
          <ui-separator orientation="vertical" />
          <div>Source</div>
        </div>
      </div>
    </section>
  `,
})
export class SeparatorDemoComponent {}
