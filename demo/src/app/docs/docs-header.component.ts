import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
} from '@angular/core';
import { ComponentDocsService } from './component-docs.service';
import { DocsForComponent } from './docs-for.component';
import type { ComponentDoc } from './component-docs.types';

/**
 * The install command and generated API tables for whatever
 * the current demo route previews — rendered once in the app shell rather than
 * pasted into 113 demo pages, which is the only way this stays correct as demos
 * move around.
 *
 * The install command is always visible: it is the reason the block exists. The
 * API tables are long, so they sit behind a collapsible so they do not push the
 * live demo below the fold.
 *
 * **Single-component routes only.** A route can preview several components —
 * `/charts` previews 28 — and listing all of them here put 28 install commands
 * above the first chart, so the reader got halfway down the page before seeing
 * the thing they came for. Details belong beside the demo they describe, so
 * those pages place an {@link DocsForComponent} in each section instead and
 * this block stands down rather than duplicating them.
 *
 * `component-docs.spec.ts` asserts that every multi-component route's page
 * carries a per-section block for each of its components, so standing down
 * here can never silently lose the documentation.
 */
@Component({
    selector: 'app-docs-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DocsForComponent],
    // A custom element defaults to display:inline, and vertical margin does
    // not apply to an inline box — so the shell's space-y left this block flush
    // against the demo above it once it moved below the router outlet.
    host: { class: 'block' },
    template: `
    @if (soleComponent(); as name) {
      <div data-slot="docs-header">
        <app-docs-for [name]="name" />
      </div>
    }
  `,
})
export class DocsHeaderComponent {
    /** Current demo route path, e.g. `buttons`. */
    readonly route = input.required<string>();

    private readonly service = inject(ComponentDocsService);

    /**
     * Components previewed by the current route. Reactive without any local
     * "loaded" flag: the service's index is a signal, so the block appears by
     * itself the moment the payload lands.
     */
    readonly docs = computed<readonly ComponentDoc[]>(() => this.service.forRoute(this.route()));

    /**
     * The one component this route previews, or `null` when it previews none or
     * several. Several means the page documents each component in its own
     * section, so rendering here too would duplicate every block.
     */
    readonly soleComponent = computed<string | null>(() => {
        const docs = this.docs();
        return docs.length === 1 ? docs[0].name : null;
    });

    constructor() {
        // The payload is ~850 KB, so it is fetched only once a route is known —
        // and only once for the whole session (the service deduplicates).
        effect(() => {
            if (this.route() === '') return;
            this.service.load().catch(() => undefined);
        });
    }
}
