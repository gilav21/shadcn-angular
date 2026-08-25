import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { IconComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DOCS_LOCALES } from '../docs.locales';
import { PlaygroundService } from './playground.service';
import { buildPayload, submitPayload } from './payload';
import type { PlaygroundDoc } from './project';

/**
 * Opens a runnable StackBlitz playground for one component.
 *
 * Replaces a link that pointed StackBlitz at the whole monorepo and hung
 * forever on "Cloning repo from GitHub". This instead POSTs a generated
 * project — the component's source and its dependency closure, wrapped in a
 * minimal Angular app — which StackBlitz creates directly, with no clone.
 *
 * The click is not instant: the closure has to be fetched. So the button owns
 * a pending state and surfaces failures by name, because a control that
 * appears to do nothing is worse than one that reports why (UC-6).
 *
 * A plain `<button>` rather than `ui-button`: it lives inside the docs install
 * row, needs `aria-busy` and a disabled state of its own, and this file must
 * not depend on the library it is documenting.
 */
@Component({
    selector: 'app-playground-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IconComponent],
    template: `
    @if (available()) {
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-sm
                 hover:bg-accent disabled:cursor-progress disabled:opacity-70"
          [disabled]="busy()"
          [attr.aria-busy]="busy() ? 'true' : null"
          [attr.aria-label]="label()"
          (click)="open()"
          data-slot="playground-button"
        >
          <ui-icon [name]="busy() ? 'loader' : 'external-link'" size="sm" />
          <span>{{ busy() ? t().playgroundOpening : t().openInStackblitz }}</span>
        </button>

        @if (error(); as message) {
          <p
            class="text-xs text-destructive"
            role="alert"
            data-slot="playground-error"
          >{{ message }}</p>
        }
      </div>
    }
  `,
})
export class PlaygroundButtonComponent {
    /** The component this button opens a playground for. */
    readonly doc = input.required<PlaygroundDoc>();

    private readonly service = inject(PlaygroundService);
    private readonly localeId = inject(UI_LOCALE_ID);

    protected readonly busy = signal(false);
    protected readonly error = signal<string | null>(null);

    protected readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);

    /**
     * No snippet — or no class to import — means no playground, and therefore
     * no button at all rather than one that opens an empty page (UC-5).
     */
    protected readonly available = computed(() => {
        const doc = this.doc();
        // A recipe brings its own App component, so it needs no snippet.
        if (doc.recipe) return true;
        return doc.snippet !== null && doc.importStatement !== null;
    });

    protected readonly label = computed(
        () => `${this.t().openInStackblitz} — ${this.doc().name}`,
    );

    protected async open(): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        this.error.set(null);

        try {
            const project = await this.service.project(this.doc());
            if (!project) {
                this.error.set(this.t().playgroundUnavailable);
                return;
            }
            submitPayload(buildPayload(project, this.doc().name));
        } catch (cause: unknown) {
            // Name what failed. "Something went wrong" would leave the reader
            // unable to tell a flaky network from a broken component.
            this.error.set(cause instanceof Error ? cause.message : String(cause));
        } finally {
            this.busy.set(false);
        }
    }
}
