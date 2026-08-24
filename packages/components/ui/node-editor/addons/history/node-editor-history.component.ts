import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { UI_LOCALE_ID } from '../../../../lib/i18n';
import { cn } from '../../../../lib/utils';
import type { NodeId } from '../..';
import { NODE_EDITOR_HISTORY_LOCALES } from './node-editor-history.locales';
import type { RunNodeRecord, RunRecord } from './node-editor-history.types';
import {
  describeValue,
  exportRun,
  formatDuration,
  formatStartedAt,
  shareOfRun,
  slowestNode,
} from './node-editor-history.utils';

/** A run and the JSON a consumer asked for. */
export interface RunExportEvent {
  readonly run: RunRecord;
  readonly json: string;
}

/**
 * What happened, run by run.
 *
 * ### Why this is an addon
 *
 * It consumes three lifecycle outputs and nothing else — it never touches the
 * graph model, and it takes an array of records rather than the editor. A
 * consumer who does not want a history panel does not install one, and the
 * runtime is not carrying a recorder nobody reads.
 *
 * ### Why it does not choose storage or write files
 *
 * `runExported` hands over a JSON string and stops there. Downloading it, or
 * putting it on the clipboard, means a permission prompt in one host and a
 * file dialog in another — decisions that belong to the application, not to a
 * list. The same reasoning that keeps `RunSink` an interface.
 */
@Component({
  selector: 'ui-node-editor-history',
  exportAs: 'uiNodeEditorHistory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './node-editor-history.component.html',
  host: { class: 'contents' },
})
export class NodeEditorHistoryComponent {
  readonly runs = input<readonly RunRecord[]>([]);
  /** The run being inspected, by id. */
  readonly selectedRun = model<number | null>(null);
  /** Whether the selected run's values are being shown in the editor. */
  readonly replaying = model(false);
  readonly class = input('');
  /** Hide the heading when the panel already sits under one. */
  readonly heading = input(true);

  /**
   * The run to show in the editor, or `null` to return to the present.
   *
   * The consumer binds this to the editor's `replay` input — via
   * `replayFrame()` — rather than the addon reaching into the editor.
   */
  readonly replayChange = output<RunRecord | null>();
  /** A node row was activated; the consumer decides what to reveal. */
  readonly nodeSelected = output<NodeId>();
  readonly runExported = output<RunExportEvent>();
  readonly clearRequested = output<void>();

  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => NODE_EDITOR_HISTORY_LOCALES[this.localeId()] ?? NODE_EDITOR_HISTORY_LOCALES['en'],
  );

  protected readonly selected = computed(
    () => this.runs().find(run => run.id === this.selectedRun()) ?? null,
  );

  /** The slowest node of the selected run — the one worth naming. */
  protected readonly slowest = computed(() => {
    const run = this.selected();
    return run ? slowestNode(run) : null;
  });

  protected readonly rootClasses = computed(() => cn('flex flex-col gap-2', this.class()));

  protected select(run: RunRecord): void {
    this.selectedRun.set(run.id);
    // Selecting a different run WHILE replaying moves the replay with it,
    // rather than silently leaving the editor showing the previous one.
    if (this.replaying()) this.replayChange.emit(run);
  }

  protected toggleReplay(): void {
    const run = this.selected();
    if (!run) return;
    const next = !this.replaying();
    this.replaying.set(next);
    this.replayChange.emit(next ? run : null);
  }

  protected exportSelected(): void {
    const run = this.selected();
    if (!run) return;
    this.runExported.emit({ run, json: exportRun(run) });
  }

  protected clear(): void {
    this.selectedRun.set(null);
    if (this.replaying()) {
      this.replaying.set(false);
      this.replayChange.emit(null);
    }
    this.clearRequested.emit();
  }

  protected runLabel(run: RunRecord): string {
    return this.t()
      .runLabel.replace('{id}', String(run.id))
      .replace('{time}', formatStartedAt(run.startedAt, this.localeId()))
      .replace('{duration}', formatDuration(run.durationMs))
      .replace('{count}', String(run.nodes.length));
  }

  protected runClasses(run: RunRecord): string {
    return cn(
      'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-start text-sm',
      // A row is a target on touch, not just a line of text.
      'pointer-coarse:min-h-11',
      'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      run.status === 'error' ? 'border-destructive/40 text-destructive' : 'border-border',
      run.id === this.selectedRun() ? 'bg-accent' : '',
    );
  }

  protected time(value: number): string {
    return formatStartedAt(value, this.localeId());
  }

  protected duration(ms: number): string {
    return formatDuration(ms);
  }

  /** Width of the timing bar, as a percentage of the run's total work. */
  protected sharePercent(node: RunNodeRecord): number {
    const run = this.selected();
    return run ? Math.round(shareOfRun(run, node.durationMs) * 100) : 0;
  }

  protected values(values: Record<string, unknown>): readonly { key: string; text: string }[] {
    return Object.entries(values).map(([key, value]) => ({
      key,
      text: describeValue(value),
    }));
  }

  protected statusLabel(status: string): string {
    const text = this.t();
    if (status === 'error') return text.failed;
    return status === 'done' ? text.succeeded : status;
  }

  protected trackRun(_index: number, run: RunRecord): number {
    return run.id;
  }

  protected trackNode(_index: number, node: RunNodeRecord): string {
    return String(node.nodeId);
  }
}
