import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StreamingTextComponent } from '@/components/ui/streaming-text';

/** Harness for the `streaming-text` component (types text out char-by-char). */
@Component({
    selector: 'app-streaming-text-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [StreamingTextComponent],
    template: `
        <main class="p-8">
            <ui-streaming-text
                data-testid="root"
                class="block"
                text="Hello from the stream"
                [speed]="5"
                (complete)="done.set(true)"
            ></ui-streaming-text>
            <p data-testid="complete">{{ done() ? 'complete' : 'streaming' }}</p>
        </main>
    `,
})
export class StreamingTextDemoComponent {
    readonly done = signal(false);
}
