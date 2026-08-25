import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import {
    NODE_CONTEXT,
    type NodeContext,
    type NodeTypeDefinition,
} from '../../../../../../../packages/components/ui';

/**
 * Renders whatever URL arrives on its input.
 *
 * This node has **no compute at all** — it produces nothing. It reads its
 * input signal and shows it, which is the "the graph IS the app" case: a node
 * can be pure UI and still be a first-class part of the dataflow.
 */
@Component({
    selector: 'app-browser-node',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (safeUrl(); as src) {
      <iframe
        class="h-[160px] w-full rounded-md border bg-background"
        [src]="src"
        [title]="'Preview of ' + (url() ?? '')"
        sandbox="allow-scripts allow-forms allow-popups"
        referrerpolicy="no-referrer"
        loading="lazy"
        data-testid="browser-node-frame"
      ></iframe>
    } @else {
      <p class="flex h-[160px] items-center justify-center rounded-md border
                border-dashed px-3 text-center text-xs text-muted-foreground">
        {{ placeholder() }}
      </p>
    }
  `,
})
export class BrowserNodeComponent {
    private readonly ctx = inject(NODE_CONTEXT) as NodeContext;
    private readonly sanitizer = inject(DomSanitizer);

    protected readonly url = this.ctx.input<string>('url');

    /**
     * Only `http:` and `https:` are ever framed.
     *
     * The value arrives from another node, which means from whatever the user
     * typed — so `javascript:` and `data:` are refused here rather than being
     * handed to the sanitizer to bypass. `allow-same-origin` is deliberately
     * NOT in the sandbox: combined with `allow-scripts` it would let framed
     * content escape the sandbox entirely.
     */
    protected readonly safeUrl = computed<SafeResourceUrl | null>(() => {
        const raw = (this.url() ?? '').trim();
        if (raw === '') return null;

        const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        let parsed: URL;
        try {
            parsed = new URL(withScheme);
        } catch {
            return null;      // not a URL yet — the user is still typing
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        if (parsed.hostname === '') return null;

        return this.sanitizer.bypassSecurityTrustResourceUrl(parsed.href);
    });

    protected readonly placeholder = computed(() =>
        (this.url() ?? '').trim() === '' ? 'Connect a URL' : 'Not a valid web address yet',
    );
}

export const BROWSER_NODE: NodeTypeDefinition = {
    id: 'browser',
    label: 'Browser',
    category: 'Output',
    accent: '#3b82f6',
    ports: [{ id: 'url', direction: 'in', label: 'URL', type: 'text', required: true }],
    view: BrowserNodeComponent,
    bodyHeight: 184,
};
