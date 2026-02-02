import {
    Component,
    ChangeDetectionStrategy,
    input,
    signal,
    computed,
    ViewEncapsulation,
} from '@angular/core';
import { cn } from '../lib/utils';
import { ButtonComponent } from './button.component';


@Component({
    selector: 'ui-code-block',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [ButtonComponent],
    template: `
    <div [class]="classes()">
      <div class="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-zinc-800">
        <span class="text-xs text-zinc-400 font-mono">{{ language() }}</span>
        <ui-button 
            variant="ghost" 
            size="icon" 
            class="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            (click)="copyToClipboard()"
        >
            @if (copied()) {
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 text-green-500">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            } @else {
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
            }
        </ui-button>
      </div>
      <div class="p-4 overflow-auto font-mono text-sm bg-zinc-950 text-zinc-50">
        <pre><code [class]="'language-' + language()">{{ code() }}</code></pre>
      </div>
    </div>
  `,
})
export class CodeBlockComponent {
    code = input('');
    language = input('typescript');
    class = input('');

    copied = signal(false);

    classes = computed(() => cn('relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 my-4', this.class()));

    copyToClipboard() {
        if (!navigator?.clipboard) return;

        navigator.clipboard.writeText(this.code()).then(() => {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 2000);
        });
    }
}
