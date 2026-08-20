import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
    BadgeComponent,
    ButtonComponent,
    CodeBlockComponent,
    IconComponent,
} from '../../../../packages/components/ui';
// Not re-exported by the `ui` barrel — the flat directives are imported by path.
import { CopyToDirective } from '../../../../packages/components/ui/directives/copy-to.directive';
import { UI_LOCALE_ID } from '../../../../packages/components/lib/i18n';
import { DOCS_LOCALES } from './docs.locales';
import type { ComponentDoc } from './component-docs.types';

/**
 * The "how do I get this" half of a component's documentation: install command
 * with one-click copy, the canonical import, a compiling usage snippet, the
 * dependency closure, and the StackBlitz link.
 *
 * Kept separate from the API tables because it is the part that must always be
 * visible — on a demo page the tables are collapsed by default, but the install
 * command is the whole point of the page.
 */
@Component({
    selector: 'app-docs-install',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent, ButtonComponent, CodeBlockComponent, CopyToDirective, IconComponent],
    template: `
    <section class="space-y-3" data-slot="docs-install" [attr.data-component]="doc().name">
      <div class="flex flex-wrap items-center gap-2">
        <ui-badge variant="secondary">{{ doc().category }}</ui-badge>
        @if (doc().selector; as selector) {
          <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ selector }}</code>
        }
        @if (doc().stackblitz; as url) {
          <a
            class="ms-auto"
            [href]="url"
            target="_blank"
            rel="noopener noreferrer"
            data-slot="stackblitz-link">
            <ui-button variant="outline" size="sm">
              <ui-icon name="external-link" size="sm" class="me-1" />
              {{ t().openInStackblitz }}
            </ui-button>
          </a>
        }
      </div>

      @if (doc().description) {
        <p class="text-muted-foreground">{{ doc().description }}</p>
      }

      <div class="space-y-1">
        <h4 class="text-sm font-semibold">{{ t().install }}</h4>
        <div class="flex flex-wrap items-center gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded border bg-muted px-2 py-1 font-mono text-xs sm:text-sm"
            data-slot="install-command">{{ doc().install }}</code>
          <ui-button
            variant="outline"
            size="sm"
            [uiCopyTo]="doc().install"
            data-slot="copy-install"
            [ariaLabel]="t().copy + ': ' + doc().install">
            <ui-icon name="copy" size="sm" />
          </ui-button>
        </div>
      </div>

      @if (doc().importStatement; as statement) {
        <div class="space-y-1">
          <h4 class="text-sm font-semibold">{{ t().importLabel }}</h4>
          <ui-code-block [code]="statement" language="typescript" [lineNumbers]="false" />
        </div>
      }

      <div class="space-y-1">
        <h4 class="text-sm font-semibold">{{ t().usage }}</h4>
        @if (doc().snippet; as snippet) {
          <ui-code-block [code]="snippet" language="html" [lineNumbers]="false" />
        } @else {
          <p class="text-sm text-muted-foreground" data-slot="no-snippet">
            {{ t().noSnippet }}: {{ doc().snippetSkipReason }}
          </p>
        }
      </div>

      <dl class="grid gap-1 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
        <dt class="font-semibold">{{ t().dependsOn }}</dt>
        <dd class="text-muted-foreground">{{ joined(doc().dependencies) }}</dd>
        <dt class="font-semibold">{{ t().npmDependencies }}</dt>
        <dd class="text-muted-foreground">{{ joined(doc().npmDependencies) }}</dd>
      </dl>
    </section>
  `,
})
export class DocsInstallComponent {
    /** The generated documentation to render. */
    readonly doc = input.required<ComponentDoc>();

    private readonly localeId = inject(UI_LOCALE_ID);
    readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);

    /** Comma-joined list, or the localized "none" for an empty one. */
    joined(values: readonly string[]): string {
        return values.length > 0 ? values.join(', ') : this.t().none;
    }
}
