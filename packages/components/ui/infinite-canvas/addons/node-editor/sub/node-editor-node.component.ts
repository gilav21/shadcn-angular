import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
  type Injector,
  type TemplateRef,
  type Type,
} from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { cn } from '../../../../../lib/utils';
import {
  PORT_LIST_PADDING,
  portListTop,
  portRowsHeight,
  type PortMetrics,
} from '../node-editor.layout';
import type { NodeStatus } from '../node-editor.runtime.types';
import type { EditorNode, NodeId, PortRef } from '../node-editor.types';
import { NodeEditorPortComponent, type PortDropState } from './node-editor-port.component';

/** Context handed to a projected node template. */
export interface NodeTemplateContext {
  $implicit: EditorNode;
}

/**
 * One node card on the plane.
 *
 * The card body is replaceable — project a `*uiNodeEditorNode` template and it
 * renders in place of the default header. **The ports are not replaceable**:
 * a projected template that rendered its own ports would have to re-derive the
 * layout maths that keeps the dot and the wire together, and would get it
 * wrong. So the editor keeps them in both modes.
 *
 * Like the port, this component handles no events of its own — the editor
 * delegates from its root, because the canvas's view pool creates and recycles
 * these elements outside any single binding scope.
 */
@Component({
  selector: 'ui-node-editor-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, NgTemplateOutlet, NodeEditorPortComponent],
  templateUrl: './node-editor-node.component.html',
  host: { class: 'contents' },
})
export class NodeEditorNodeComponent {
  /** The node this element renders. */
  readonly node = input.required<EditorNode>();
  /** Port geometry, shared with the canvas so edges meet the ports exactly. */
  readonly metrics = input.required<PortMetrics>();
  /** Whether the node is part of the current selection. */
  readonly selected = input(false);
  /** Whether this node holds the roving tab stop. */
  readonly focused = input(false);
  /** Ports that already have at least one connection. */
  readonly connectedPorts = input<ReadonlySet<string>>(new Set<string>());
  /** The port a connection is currently being dragged over, if it is on this node. */
  readonly dropPort = input<PortRef | null>(null);
  /** Whether dropping on {@link dropPort} would be accepted. */
  readonly dropValid = input(false);
  /** The port the keyboard is currently on within this node. */
  readonly activePort = input<string | null>(null);
  /** Optional replacement for the default header. */
  readonly bodyTemplate = input<TemplateRef<NodeTemplateContext> | null>(null);
  /** The node type's view component, rendered inside the card. */
  readonly view = input<Type<unknown> | null>(null);
  /** Injector carrying this node's NODE_CONTEXT to that view. */
  readonly viewInjector = input<Injector | null>(null);
  /** Runtime status, surfaced on the card so a run is visible. */
  readonly status = input<NodeStatus | null>(null);
  /** Ports that would accept the connection in flight; passed straight down. */
  readonly connectable = input<ReadonlySet<string> | null>(null);
  /** Extra classes merged onto the node card. */
  readonly class = input('');

  /** Briefly true just after this node finished work — see the editor. */
  readonly recentlyRan = input(false);

  /** This node contains something worth opening; double-click descends into it. */
  readonly openable = input(false);

  /**
   * The header's height, derived from the same rule the port geometry uses.
   *
   * It must equal `portListTop(node) - PORT_LIST_PADDING`, because the ports
   * are positioned from the node's top edge while the header is laid out by
   * flow: if the two disagree the ports land on the body. They DID disagree —
   * this restated only `NODE_HEADER_HEIGHT` and dropped the subtitle, so every
   * node with a subtitle drew its ports NODE_SUBTITLE_HEIGHT too low.
   *
   * Invisible without a subtitle, because both expressions then reduce to the
   * same number, which is why it survived. Derive, never restate.
   */
  protected readonly headerHeight = computed(
    () => portListTop(this.node()) - PORT_LIST_PADDING,
  );

  /**
   * The vertical band the ports occupy.
   *
   * Ports are absolutely positioned siblings of the card, so without a spacer
   * of exactly this height the card's body renders UNDERNEATH them — which is
   * what the first live demo screenshot showed: port labels sitting on top of
   * a text field and a value display.
   */
  protected readonly portBandHeight = computed(() =>
    portRowsHeight(this.node(), this.metrics()),
  );

  /**
   * Whether someone other than the editor owns this card's body.
   *
   * A projected template or a node type's view may both contain the
   * consumer's own controls, so neither may be wrapped in a <button> — see
   * the template.
   */
  /**
   * Short status text in the header, or `null` when there is nothing to say.
   *
   * `idle` and `done` are the resting states of a healthy graph, and labelling
   * every node in a large graph "done" is noise rather than information.
   */
  protected readonly statusLabel = computed(() => {
    const status = this.status();
    if (status === null || status === 'idle' || status === 'done') return null;
    return status;
  });

  protected readonly bodyIsForeign = computed(
    () => this.bodyTemplate() !== null || this.view() !== null,
  );

  protected readonly cardClasses = computed(() =>
    cn(
      'relative h-full w-full overflow-visible rounded-lg border bg-card text-card-foreground shadow-sm',
      /*
       * The default card is a real <button>, so the UA's own button styling
       * has to be neutralised: it would otherwise impose its font and centre
       * the text — in BOTH axes.
       *
       * The vertical half was missed, and it was not subtle. A button centres
       * its content block, so on a node with no body the 40px header floated
       * to the middle of the card and its bottom border landed exactly on the
       * port row. The port geometry is computed from the top of the node and
       * was right all along; the header had drifted 20px down to meet it.
       *
       * The result read as a divider BETWEEN the inputs and the outputs, and
       * was reported as one: "the line between the input and output is a bug?
       * what does an output under the line or above it mean?" Nothing — it is
       * the title's underline, and every port belongs below it.
       */
      'flex flex-col items-stretch justify-start',
      'appearance-none text-start font-[inherit]',
      'transition-[box-shadow,border-color]',
      this.selected() ? 'border-primary ring-2 ring-primary/40' : 'border-border',
      this.node().locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      this.class(),
    ),
  );

  /**
   * The card's accessible name.
   *
   * The full graph structure lives in the editor's parallel accessible model;
   * this is the spatial view's short label, so it states only what a sighted
   * user reads off the card plus the state they see.
   */
  protected readonly ariaLabel = computed(() => {
    const node = this.node();
    const parts = [node.title];
    if (node.subtitle) parts.push(node.subtitle);
    // The glyph is aria-hidden, so this is where a screen reader learns the
    // node has an inside at all.
    if (this.openable()) parts.push('contains a graph, opens on double-click');
    if (node.locked) parts.push('locked');
    return parts.join(', ');
  });

  /**
   * The projected variant is a `<fieldset>`, which brings UA margin, padding
   * and — the one that actually bites — `min-inline-size: min-content`.
   */
  protected readonly projectedCardClasses = computed(() =>
    cn(this.cardClasses(), 'm-0 min-w-0 p-0'),
  );

  /**
   * The rendered height of a projected body, in CSS pixels.
   *
   * An OUTPUT rather than an input because a consumer cannot know it: the
   * height depends on the font, the density, the locale and on content that
   * changes at runtime — a title wrapping to a second line is enough to move
   * it. The declared `node.bodyHeight` is only a first-frame floor; this is
   * what the body actually took.
   *
   * Emitted per node id rather than per card because the canvas RECYCLES these
   * views: the same component instance renders a different node as one scrolls
   * past, so a height remembered on the instance would be attributed to the
   * wrong node.
   */
  readonly bodyMeasured = output<{ node: NodeId; height: number }>();

  private readonly bodyRef = viewChild<ElementRef<HTMLElement>>('projectedBody');

  /**
   * The node's id, as its own signal.
   *
   * The measuring effect depends on THIS rather than on `node()`, because the
   * node object is replaced on every drag frame and every edit while its id
   * stays put, and there is nothing to re-measure then.
   */
  private readonly nodeId = computed(() => this.node().id);

  /**
   * Last height emitted for a given node, so an unchanged measurement is not
   * re-emitted. Each emission costs the editor a signal write and the canvas a
   * re-render; emitting only on a real change is what makes that a settling
   * rather than a loop.
   */
  private lastEmitted: { node: NodeId; height: number } | null = null;

  /** Created on first render, so constructing a card never touches a browser API. */
  private observer: ResizeObserver | null = null;

  constructor() {
    afterRenderEffect(() => {
      const element = this.bodyRef()?.nativeElement;
      /*
       * Read for the dependency, defensively. Today the view pool DETACHES a
       * released card and re-inserts it for its next node, so the body drops
       * out of layout and back and the observer reports it anyway. A pool that
       * swapped the node on an attached card would not, and without this the
       * new node would never be measured.
       */
      this.nodeId();
      this.observer?.disconnect();
      if (!element) {
        this.lastEmitted = null;
        return;
      }
      /*
       * A new observation always delivers an initial size, so a node is
       * measured on mount even when nothing about it resizes.
       *
       * `contentRect` is the LAYOUT box, before transforms. That matters: the
       * canvas zooms with a CSS `scale()`, so an on-screen measurement is the
       * world height times the zoom — reading one made cards twice as tall at
       * 200% and half as tall at 50%. The wrapper has no padding or border, so
       * its content box is the whole of it.
       */
      this.observer ??= new ResizeObserver(entries => {
        const entry = entries[0];
        /*
         * A card going back to the view pool is DETACHED, not destroyed, and a
         * detached element measures 0 x 0. Reported, that zeroed the body of
         * the node that just scrolled away and shrank its world box for
         * everything reading it off screen. The observer records the zero all
         * the same, so re-attaching the card still reports afresh.
         */
        if (entry?.target.isConnected) this.emitBody(this.nodeId(), entry.contentRect.height);
      });
      this.observer.observe(element);
    });

    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  private emitBody(node: NodeId, height: number): void {
    // Rounded up, never down: a body a fraction of a pixel taller than its
    // card would poke out of it.
    const rounded = Math.ceil(height);
    if (this.lastEmitted?.node === node && this.lastEmitted.height === rounded) return;
    this.lastEmitted = { node, height: rounded };
    this.bodyMeasured.emit({ node, height: rounded });
  }

  protected dropStateFor(portId: string): PortDropState {
    const over = this.dropPort();
    if (over?.node !== this.node().id || over.port !== portId) return null;
    return this.dropValid() ? 'valid' : 'invalid';
  }
}
