import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StreamingTextComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-streaming-text-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamingTextComponent],
  template: `
    <section class="space-y-4">
      <h2 id="streaming-text" class="text-2xl font-semibold scroll-m-20">Streaming Text</h2>
      <p class="text-muted-foreground">Typewriter effect for text.</p>

      <div class="border rounded-md p-6 min-h-[100px]">
        <ui-streaming-text text="The quick brown fox jumps over the lazy dog." class="font-mono text-lg" />
      </div>
    </section>
  `,
})
export class StreamingTextDemoComponent {}
