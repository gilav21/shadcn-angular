/**
 * A display that takes text AND how to draw it.
 *
 * ### Why a node like this has to exist
 *
 * A graph can compose data all day and still not colour anything, because
 * colour is not a transformation of a value — it is rendering, and rendering
 * is code. `Set field` can build `{ text, color }`; only a component can turn
 * that into coloured pixels.
 *
 * So this is deliberately the most GENERAL sink that is still one node. Every
 * style field is optional and arrives as data, which means "colour this text"
 * stops being a node someone has to write and becomes a graph someone can
 * build:
 *
 *     Text ──→ Upper case ─────────────────┐
 *                                          ├→ Set field(text) → Set field(color) → Text output
 *     Colour ──────────────────────────────┘
 *
 * One component, unlimited compositions. The alternative — a `colorText` node,
 * then `boldText`, then `alignText` — is a combinatorial pile of components
 * that only ever covers what someone thought of in advance.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NODE_CONTEXT, type NodeContext, type NodeTypeDefinition } from '../node-editor';
import {
  TEXT_OUTPUT_ALIGNS,
  TEXT_OUTPUT_MAX_SIZE,
  TEXT_OUTPUT_MIN_SIZE,
  TEXT_OUTPUT_WEIGHTS,
  safeColor,
  type TextOutputAlign,
  type TextOutputStyle,
  type TextOutputWeight,
} from './node-editor-text-output.types';

/*
 * Written out rather than built.
 *
 * Tailwind finds class names by scanning source text, so `text-${align}` is a
 * class that exists in the running code and not in the stylesheet — it works
 * in dev, where every utility is available, and silently does nothing once the
 * CSS is generated. Both maps spell every class in full for that reason.
 */
const WEIGHT_CLASS: Readonly<Record<TextOutputWeight, string>> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const ALIGN_CLASS: Readonly<Record<TextOutputAlign, string>> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

@Component({
  selector: 'ui-node-editor-text-output',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './node-editor-text-output.component.html',
})
export class NodeEditorTextOutputComponent {
  private readonly ctx = inject(NODE_CONTEXT) as NodeContext;

  private readonly text = this.ctx.input<unknown>('text');
  private readonly color = this.ctx.input<unknown>('color');
  private readonly style = this.ctx.input<unknown>('style');

  /**
   * The style object, with the direct `color` port laid over it.
   *
   * The port wins: it is the more specific instruction, and wiring a colour
   * straight in is what someone tries first. The `style` port is there for
   * everything else, and for a graph that already carries a style around.
   */
  private readonly resolved = computed<TextOutputStyle>(() => {
    const style = this.style();
    // Narrowing is enough: every field of TextOutputStyle is optional, so a
    // plain object already satisfies it, and each one is re-checked below
    // before it reaches CSS anyway.
    const base: TextOutputStyle =
      typeof style === 'object' && style !== null && !Array.isArray(style) ? style : {};
    const direct = safeColor(this.color());
    return direct === null ? base : { ...base, color: direct };
  });

  /** Shown as text, never as markup — this is a display, not a renderer of HTML. */
  protected readonly shown = computed(() => {
    const value = this.text();
    if (value === undefined || value === null || value === '') return '—';
    return typeof value === 'string' ? value : JSON.stringify(value);
  });

  protected readonly color$ = computed(() => safeColor(this.resolved().color));
  protected readonly background$ = computed(() => safeColor(this.resolved().background));

  /** Clamped, and only when it really is a number — `size: "big"` styles nothing. */
  protected readonly size$ = computed(() => {
    const size = this.resolved().size;
    if (typeof size !== 'number' || Number.isNaN(size)) return null;
    return Math.min(Math.max(size, TEXT_OUTPUT_MIN_SIZE), TEXT_OUTPUT_MAX_SIZE);
  });

  protected readonly classes = computed(() => {
    const style = this.resolved();
    const weight = TEXT_OUTPUT_WEIGHTS.includes(style.weight as TextOutputWeight)
      ? WEIGHT_CLASS[style.weight as TextOutputWeight]
      : 'font-normal';
    const align = TEXT_OUTPUT_ALIGNS.includes(style.align as TextOutputAlign)
      ? ALIGN_CLASS[style.align as TextOutputAlign]
      : ALIGN_CLASS.start;
    return [
      weight,
      align,
      style.italic === true ? 'italic' : '',
      style.underline === true ? 'underline' : '',
      style.mono === true ? 'font-mono' : '',
    ]
      .filter(Boolean)
      .join(' ');
  });
}

/**
 * The node type.
 *
 * `text` is the only required wire; a graph that wants plain text wires one
 * thing and is done, and the styling ports stay out of the way until wanted.
 */
export const TEXT_OUTPUT_NODE: NodeTypeDefinition = {
  id: 'text-output',
  label: 'Text output',
  category: 'Output',
  accent: '#6366f1',
  ports: [
    { id: 'text', direction: 'in', label: 'Text', type: 'text', required: true },
    { id: 'color', direction: 'in', label: 'Colour', type: 'text' },
    { id: 'style', direction: 'in', label: 'Style', type: 'object' },
  ],
  view: NodeEditorTextOutputComponent,
  bodyHeight: 56,
};
