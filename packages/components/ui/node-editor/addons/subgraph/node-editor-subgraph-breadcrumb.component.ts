import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../lib/i18n';
import { cn } from '../../../../lib/utils';
import { NODE_EDITOR_SUBGRAPH_LOCALES } from './node-editor-subgraph.locales';
import type { SubgraphFrame } from './node-editor-subgraph.types';

/**
 * Where you are in a nest of graphs, and the way back out.
 *
 * Takes the path and emits an index — it never touches the navigator, the
 * editor or a runtime, which is what keeps it renderable and testable on its
 * own. The same shape as every other addon in this folder.
 */
@Component({
  selector: 'ui-node-editor-subgraph-breadcrumb',
  exportAs: 'uiNodeEditorSubgraphBreadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './node-editor-subgraph-breadcrumb.component.html',
  host: { class: 'contents' },
})
export class NodeEditorSubgraphBreadcrumbComponent {
  /** Root first. A single entry means the editor is showing the root graph. */
  readonly path = input<readonly SubgraphFrame[]>([]);
  readonly class = input('');

  /** Go to this level. The index into `path`. */
  readonly navigate = output<number>();

  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => NODE_EDITOR_SUBGRAPH_LOCALES[this.localeId()] ?? NODE_EDITOR_SUBGRAPH_LOCALES['en'],
  );

  protected readonly rootClasses = computed(() =>
    cn('flex flex-wrap items-center gap-1 text-sm', this.class()),
  );

  protected isLast(index: number): boolean {
    return index === this.path().length - 1;
  }

  protected crumbClasses(index: number): string {
    return cn(
      'rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center',
      this.isLast(index)
        ? 'font-medium text-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
    );
  }

  protected trackFrame(index: number, frame: SubgraphFrame): string {
    return `${index}:${String(frame.nodeId ?? 'root')}`;
  }
}
