import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbdComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-kbd-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KbdComponent],
  template: `
    <section class="space-y-4">
      <h2 id="kbd" class="text-2xl font-semibold scroll-m-20">Kbd</h2>
      <p class="text-muted-foreground">Display keyboard shortcuts or keystrokes.</p>

      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <span>Press</span>
          <ui-kbd>Ctrl</ui-kbd>
          <span>+</span>
          <ui-kbd>K</ui-kbd>
          <span>to search</span>
        </div>
        <div class="flex items-center gap-2">
          <span>Press</span>
          <ui-kbd>&#8984;</ui-kbd>
          <ui-kbd>&#8679;</ui-kbd>
          <ui-kbd>P</ui-kbd>
          <span>to open command palette</span>
        </div>
      </div>
    </section>
  `,
})
export class KbdDemoComponent {}
