import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { UI_LOCALE_ID } from '../../../../lib/i18n';
// Through the barrel, never a deep path: a deep import defeats
// sync-registry's component-boundary detection, which then copies the
// command's files into this addon and drops the dependency on it.
import {
  CommandComponent,
  CommandDialogComponent,
  CommandEmptyComponent,
  CommandGroupComponent,
  CommandInputComponent,
  CommandItemComponent,
  CommandListComponent,
} from '../../../command';
import type { CanvasPoint, NodeTypeDefinition } from '../node-editor';
import { NODE_EDITOR_PALETTE_LOCALES } from './node-editor-palette.locales';
import {
  describePorts,
  filterTypes,
  groupByCategory,
  type PaletteQuery,
} from './node-editor-palette.utils';

/** What the palette reports when the user picks something. */
export interface NodeTypePicked {
  readonly typeId: string;
  /** Where the node was asked for, if the palette was opened at a point. */
  readonly at: CanvasPoint | null;
}

/**
 * A searchable picker over the registered node types.
 *
 * ### Why this is an addon
 *
 * R15 puts the *intent* and the *insertion* in the base — `(addNodeRequested)`
 * and `addNode()` — and the picker UI here. The base therefore has a complete
 * add-node story with no palette installed, and a consumer who wants a
 * different picker writes one without forking anything.
 *
 * It composes `ui-command`, which this library already ships, so this is
 * mostly a filter and a grouping rather than a new widget.
 *
 * It takes the type list and emits a choice — it never touches the editor. A
 * consumer wires the two together in one line, and this component can be
 * tested without constructing an editor at all.
 */
@Component({
  selector: 'ui-node-editor-palette',
  exportAs: 'uiNodeEditorPalette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommandDialogComponent,
    CommandComponent,
    CommandInputComponent,
    CommandListComponent,
    CommandEmptyComponent,
    CommandGroupComponent,
    CommandItemComponent,
  ],
  templateUrl: './node-editor-palette.component.html',
  host: { class: 'contents' },
})
export class NodeEditorPaletteComponent {
  /** Every node type the graph may contain — the editor's `definitions`. */
  readonly definitions = input<readonly NodeTypeDefinition[]>([]);

  /** Two-way open state, so a consumer can drive it however they like. */
  readonly open = model(false);

  /**
   * Restrict the offer to types that could take this value type.
   *
   * The query that makes a palette worth having in a typed graph: after
   * dragging from a `table` output, "what can accept this" beats an
   * alphabetical list of everything.
   */
  readonly acceptsType = input<string | undefined>(undefined);
  /** Restrict to types producing this value type. */
  readonly producesType = input<string | undefined>(undefined);

  /** Keyboard shortcut that toggles the picker. Blank disables it. */
  readonly shortcut = input('Mod+K');

  /** Emits the node type the user chose, and where it should be placed. */
  readonly picked = output<NodeTypePicked>();

  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => NODE_EDITOR_PALETTE_LOCALES[this.localeId()] ?? NODE_EDITOR_PALETTE_LOCALES['en'],
  );

  /** Where the node was asked for, when opened via `openAt`. */
  private readonly point = signal<CanvasPoint | null>(null);

  protected readonly groups = computed(() => {
    const query: PaletteQuery = {
      acceptsType: this.acceptsType(),
      producesType: this.producesType(),
    };
    return groupByCategory(filterTypes(this.definitions(), query), this.t().uncategorised);
  });

  protected readonly hasAny = computed(() =>
    this.groups().some(group => group.types.length > 0),
  );

  /**
   * Open at a world point — what `(addNodeRequested)` hands over.
   *
   * The point is remembered rather than passed through the picker, so the
   * chosen node lands exactly where the user double-clicked instead of at
   * some default position.
   */
  openAt(at: CanvasPoint): void {
    this.point.set(at);
    this.open.set(true);
  }

  /** Open with no position; the consumer decides where the node goes. */
  openAnywhere(): void {
    this.point.set(null);
    this.open.set(true);
  }

  protected choose(definition: NodeTypeDefinition): void {
    this.picked.emit({ typeId: definition.id, at: this.point() });
    this.open.set(false);
  }

  protected describe(definition: NodeTypeDefinition): string {
    return describePorts(definition);
  }
}
