import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../lib/i18n';
import { cn } from '../../../../lib/utils';
import type { GraphProblem } from '../..';
import { NODE_EDITOR_PROBLEMS_LOCALES } from './node-editor-problems.locales';

/**
 * The graph's problems, listed.
 *
 * ### Why this is an addon
 *
 * It consumes exactly one thing from the base — the `problems()` signal — and
 * needs nothing else. By the boundary rule in
 * `specs/node-editor-addons-spec.md` that makes it an addon rather than part
 * of the editor: it never touches the graph's internal model, so a consumer
 * who does not want a panel does not install one.
 *
 * It does not take the editor as an input either. It takes an array and emits
 * a selection, which keeps it a pure presentation component and testable
 * without ever constructing an editor.
 *
 * The *inline* half of validation — dimming incompatible ports and explaining
 * a refusal at the pointer — is in the base, because it has to happen during
 * a drag and needs the connection rules.
 */
@Component({
  selector: 'ui-node-editor-problems',
  exportAs: 'uiNodeEditorProblems',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './node-editor-problems.component.html',
  host: { class: 'contents' },
})
export class NodeEditorProblemsComponent {
  /** Problems to list, as produced by validating the graph. */
  readonly problems = input<readonly GraphProblem[]>([]);
  /** Extra classes for the panel root. */
  readonly class = input('');
  /** Hide the heading when the panel already sits under one. */
  readonly heading = input(true);

  /** A row was activated — the consumer decides what to reveal. */
  readonly problemSelected = output<GraphProblem>();

  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => NODE_EDITOR_PROBLEMS_LOCALES[this.localeId()] ?? NODE_EDITOR_PROBLEMS_LOCALES['en'],
  );

  /**
   * Errors first, then warnings, each keeping the runtime's order.
   *
   * Sorted rather than grouped into sections: a graph usually has one or two
   * problems, and two headings around a single row is more chrome than
   * content.
   */
  protected readonly ordered = computed(() =>
    [...this.problems()].sort((a, b) => severityRank(a) - severityRank(b)),
  );

  protected readonly summary = computed(() =>
    this.t().count.replace('{count}', String(this.problems().length)),
  );

  protected readonly rootClasses = computed(() =>
    cn('flex flex-col gap-2', this.class()),
  );

  protected severityLabel(problem: GraphProblem): string {
    return problem.severity === 'error' ? this.t().error : this.t().warning;
  }

  protected rowClasses(problem: GraphProblem): string {
    return cn(
      'flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-start text-sm',
      'pointer-coarse:min-h-11 pointer-coarse:items-center',
      'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      problem.severity === 'error'
        ? 'border-destructive/40 text-destructive'
        : 'border-border text-muted-foreground',
    );
  }

  /** Stable across re-renders, so a row is not rebuilt on every evaluation. */
  protected trackProblem(_index: number, problem: GraphProblem): string {
    return `${problem.nodeId}:${problem.kind}:${problem.portId ?? ''}`;
  }
}

function severityRank(problem: GraphProblem): number {
  return problem.severity === 'error' ? 0 : 1;
}
