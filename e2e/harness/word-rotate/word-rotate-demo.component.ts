import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WordRotateComponent } from '@/components/ui/word-rotate';

/**
 * Harness for the `word-rotate` component. The host is `display: contents`,
 * so the testid goes on a wrapper that actually has a box.
 */
@Component({
    selector: 'app-word-rotate-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [WordRotateComponent],
    template: `
        <main class="p-8">
            <div data-testid="root" class="text-3xl">
                <ui-word-rotate [words]="words" [duration]="300" />
            </div>
        </main>
    `,
})
export class WordRotateDemoComponent {
    readonly words = ['design', 'build'];
}
