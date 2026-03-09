import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TextareaComponent, LabelComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-textarea-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextareaComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="textarea" class="text-2xl font-semibold scroll-m-20">Textarea</h2>
      <p class="text-muted-foreground">Multi-line text input.</p>

      <div class="grid gap-4 max-w-sm">
        <div class="space-y-2">
          <ui-label>Your message</ui-label>
          <ui-textarea placeholder="Type your message here..." [rows]="4" />
        </div>
        <div class="space-y-2">
          <ui-label>Underline Variant</ui-label>
          <ui-textarea placeholder="Type your message here..." [rows]="4" variant="underline" />
        </div>
        <ui-textarea placeholder="Disabled textarea" [disabled]="true" />
      </div>
    </section>
  `,
})
export class TextareaDemoComponent {}
