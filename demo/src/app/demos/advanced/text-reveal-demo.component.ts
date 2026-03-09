import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TextRevealComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-text-reveal-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextRevealComponent],
  template: `
    <section class="space-y-4">
      <h2 id="text-reveal" class="text-2xl font-semibold scroll-m-20">Text Reveal</h2>
      <p class="text-muted-foreground">Blur-in animation for text.</p>
      <div class="border rounded-md p-6 flex justify-center items-center">
        <ui-text-reveal text="The truth will be revealed." class="text-3xl font-bold" />
      </div>
    </section>
  `,
})
export class TextRevealDemoComponent {}
