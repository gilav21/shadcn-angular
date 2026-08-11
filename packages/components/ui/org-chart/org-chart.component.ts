import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { OrgNode, OrgNodePosition, OrgLayoutDirection, OrgLineType } from '../../lib/chart.types';
import { getChartColor } from '../../lib/chart.utils';
import { readableForeground } from '../../lib/color';

@Component({
  selector: 'ui-org-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './org-chart.component.html',
  host: {
    class: 'block',
  },
})
export class OrgChartComponent {
  /**
   * Flat node list linked by `parentId`; the forest is rebuilt and re-laid out on every
   * change. **Every** node with a null/undefined `parentId` is a root and gets its own
   * subtree, laid out after the previous one (to its right in a `'vertical'` layout,
   * below it in a `'horizontal'` one) — see {@link trees}. Nodes whose `parentId`
   * resolves to no root's subtree (a dangling or cyclic link) are silently dropped
   * from the render.
   */
  data = input.required<OrgNode[]>();
  /**
   * Growth direction: `'vertical'` (default) stacks generations top-to-bottom,
   * `'horizontal'` runs them left-to-right. Also decides which padding is the
   * sibling gap — see {@link nodePaddingX} / {@link nodePaddingY}.
   */
  layout = input<OrgLayoutDirection>('vertical');
  /** Card width in px (default 180). Feeds the layout maths, so the SVG canvas grows with it. */
  nodeWidth = input(180);
  /** Card height in px (default 80). Long titles are not measured, so raise it if text clips. */
  nodeHeight = input(80);
  /** Horizontal gap in px: between siblings in a vertical layout, between generations in a horizontal one. */
  nodePaddingX = input(40);
  /** Vertical gap in px: between generations in a vertical layout, between siblings in a horizontal one. */
  nodePaddingY = input(60);
  /**
   * Renders the avatar slot. When on, a node without an `image` falls back to
   * {@link getInitials} on a disc tinted with {@link getNodeColor}; when off, the
   * avatar is omitted entirely and the text gets the full card width.
   */
  showImages = input(true);
  /** Connector shape — `'curved'` bezier (default) or `'straight'` elbow polyline. */
  lineType = input<OrgLineType>('curved');
  /** Extra classes merged onto the chart wrapper (`relative block w-full max-w-full`). */
  class = input('');
  /** Prefixed onto the SVG's `aria-label` (which always states the member count). Not rendered visually. */
  title = input<string | undefined>(undefined);

  /**
   * Emitted on click or keyboard activation of a node card. `event` is present only for
   * a real mouse click — it is `undefined` for `Enter`/`Space`, so guard before
   * reading coordinates.
   */
  nodeClick = output<{ node: OrgNode; event?: MouseEvent }>();
  /**
   * Emitted with the hovered node and again with `null` when the pointer leaves. Bound
   * to `mouseenter`/`mouseleave` only, so keyboard users never trigger it — do not put
   * information behind hover alone.
   */
  nodeHover = output<OrgNode | null>();

  hoveredId = signal<string | null>(null);

  /**
   * Every parentless node's subtree, positioned and laid out end to end so no
   * subtree is lost when the data has several roots. Empty when `data` is empty
   * or every node claims a parent.
   */
  trees = computed((): OrgNodePosition[] => {
    const nodes = this.data();
    if (nodes.length === 0) return [];

    const { roots, childrenMap } = this.groupByParent(nodes);
    if (roots.length === 0) return [];

    const isVertical = this.layout() === 'vertical';
    const positioned: OrgNodePosition[] = [];
    let offsetX = 0;
    let offsetY = 0;

    for (const root of roots) {
      const positionedRoot = this.buildPositionedTree(root, 0, childrenMap);
      this.calculatePositions(positionedRoot, offsetX, offsetY);
      positioned.push(positionedRoot);

      if (isVertical) {
        offsetX = this.subtreeExtent(positionedRoot).maxX + this.nodePaddingX();
      } else {
        offsetY = this.subtreeExtent(positionedRoot).maxY + this.nodePaddingY();
      }
    }

    return positioned;
  });

  /** The first root's positioned subtree, or `null` when there is none. @see trees */
  tree = computed((): OrgNodePosition | null => this.trees()[0] ?? null);

  private groupByParent(nodes: OrgNode[]): {
    roots: OrgNode[];
    childrenMap: Map<string, OrgNode[]>;
  } {
    const childrenMap = new Map<string, OrgNode[]>();
    for (const node of nodes) {
      if (!childrenMap.has(node.id)) {
        childrenMap.set(node.id, []);
      }
    }

    const roots: OrgNode[] = [];
    for (const node of nodes) {
      if (node.parentId === null || node.parentId === undefined) {
        roots.push(node);
      } else {
        const siblings = childrenMap.get(node.parentId) ?? [];
        siblings.push(node);
        childrenMap.set(node.parentId, siblings);
      }
    }

    return { roots, childrenMap };
  }

  private buildPositionedTree(
    node: OrgNode,
    level: number,
    childrenMap: Map<string, OrgNode[]>
  ): OrgNodePosition {
    const children = childrenMap.get(node.id) ?? [];
    return {
      node,
      x: 0,
      y: 0,
      width: this.nodeWidth(),
      height: this.nodeHeight(),
      level,
      children: children.map(child =>
        this.buildPositionedTree(child, level + 1, childrenMap)
      ),
    };
  }

  private subtreeExtent(root: OrgNodePosition): { maxX: number; maxY: number } {
    let maxX = root.x + root.width;
    let maxY = root.y + root.height;
    for (const child of root.children) {
      const childExtent = this.subtreeExtent(child);
      maxX = Math.max(maxX, childExtent.maxX);
      maxY = Math.max(maxY, childExtent.maxY);
    }
    return { maxX, maxY };
  }

  private calculatePositions(root: OrgNodePosition, originX = 0, originY = 0): void {
    const isVertical = this.layout() === 'vertical';
    const nWidth = this.nodeWidth();
    const nHeight = this.nodeHeight();
    const padX = this.nodePaddingX();
    const padY = this.nodePaddingY();

    const getSubtreeWidth = (node: OrgNodePosition): number => {
      if (node.children.length === 0) {
        return isVertical ? nWidth : nHeight;
      }
      const childWidths = node.children.map(c => getSubtreeWidth(c));
      const gap = isVertical ? padX : padY;
      return childWidths.reduce((sum, w) => sum + w, 0) + (node.children.length - 1) * gap;
    };

    const positionNode = (
      node: OrgNodePosition,
      startX: number,
      startY: number
    ): void => {
      const subtreeWidth = getSubtreeWidth(node);

      if (isVertical) {
        node.x = startX + (subtreeWidth - nWidth) / 2;
        node.y = startY;

        let childX = startX;
        for (const child of node.children) {
          const childWidth = getSubtreeWidth(child);
          positionNode(child, childX, startY + nHeight + padY);
          childX += childWidth + padX;
        }
      } else {
        node.x = startX;
        node.y = startY + (subtreeWidth - nHeight) / 2;

        let childY = startY;
        for (const child of node.children) {
          const childWidth = getSubtreeWidth(child);
          positionNode(child, startX + nWidth + padX, childY);
          childY += childWidth + padY;
        }
      }
    };

    positionNode(root, originX, originY);
  }

  flatNodes = computed((): OrgNodePosition[] => {
    const result: OrgNodePosition[] = [];
    const flatten = (node: OrgNodePosition): void => {
      result.push(node);
      node.children.forEach(flatten);
    };
    this.trees().forEach(flatten);
    return result;
  });

  connections = computed(() => {
    const roots = this.trees();
    if (roots.length === 0) return [];

    const result: { id: string; path: string }[] = [];
    const isVertical = this.layout() === 'vertical';
    const isCurved = this.lineType() === 'curved';

    const generateConnections = (node: OrgNodePosition): void => {
      for (const child of node.children) {
        const parentCenterX = node.x + node.width / 2;
        const parentCenterY = node.y + node.height / 2;
        const parentBottomY = node.y + node.height;
        const parentRightX = node.x + node.width;

        const childCenterX = child.x + child.width / 2;
        const childCenterY = child.y + child.height / 2;
        const childTopY = child.y;
        const childLeftX = child.x;

        let path: string;

        if (isVertical) {
          const startX = parentCenterX;
          const startY = parentBottomY;
          const endX = childCenterX;
          const endY = childTopY;
          const midY = (startY + endY) / 2;

          if (isCurved) {
            path = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
          } else {
            path = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
          }
        } else {
          const startX = parentRightX;
          const startY = parentCenterY;
          const endX = childLeftX;
          const endY = childCenterY;
          const midX = (startX + endX) / 2;

          if (isCurved) {
            path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
          } else {
            path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
          }
        }

        result.push({ id: `${node.node.id}-${child.node.id}`, path });
        generateConnections(child);
      }
    };

    roots.forEach(generateConnections);
    return result;
  });

  svgWidth = computed(() => {
    const nodes = this.flatNodes();
    if (nodes.length === 0) return 400;
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    return maxX + 20;
  });

  svgHeight = computed(() => {
    const nodes = this.flatNodes();
    if (nodes.length === 0) return 300;
    const maxY = Math.max(...nodes.map(n => n.y + n.height));
    return maxY + 20;
  });

  chartAriaLabel = computed(() => {
    const count = this.flatNodes().length;
    const title = this.title();
    return title
      ? `${title}: Organization chart with ${count} members`
      : `Organization chart with ${count} members`;
  });

  containerClasses = computed(() => cn('relative block w-full max-w-full', this.class()));

  /**
   * Accent colour for a node: its own `color` when set, otherwise the palette entry for
   * its depth — so a whole generation shares one colour and the palette cycles once the
   * tree is deeper than the palette.
   */
  getNodeColor(pos: OrgNodePosition): string {
    if (pos.node.color) return pos.node.color;
    return getChartColor(pos.level);
  }

  /**
   * Legible initials colour for the avatar painted in the node's colour. The
   * hardcoded white this replaces failed WCAG AA on light node colours
   * (axe `color-contrast`).
   */
  getNodeForeground(pos: OrgNodePosition): string {
    return readableForeground(this.getNodeColor(pos));
  }

  /**
   * Avatar fallback: the first character of each space-separated word, uppercased and
   * capped at two. Splits on spaces only, so hyphenated names yield one letter.
   */
  getInitials(name: string): string {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Accessible name for one node card — `"name, title"`, or just the name when the node
   * has no title. `description` is deliberately left out to keep the label short.
   */
  getNodeAriaLabel(node: OrgNode): string {
    let label = node.name;
    if (node.title) label += `, ${node.title}`;
    return label;
  }

  /** `(mouseenter)` handler: records the hovered id for the card's highlight and emits {@link nodeHover}. */
  onNodeHover(node: OrgNode): void {
    this.hoveredId.set(node.id);
    this.nodeHover.emit(node);
  }

  /** `(mouseleave)` handler: clears the highlight and emits `null` on {@link nodeHover}. */
  onNodeLeave(): void {
    this.hoveredId.set(null);
    this.nodeHover.emit(null);
  }

  /**
   * Activation handler shared by click, `Enter` and `Space`. Forwards the DOM event on
   * {@link nodeClick} only when it is a `MouseEvent`, so keyboard activations arrive
   * with `event: undefined`.
   */
  onNodeClick(event: Event, node: OrgNode): void {
    this.nodeClick.emit({
      node,
      event: event instanceof MouseEvent ? event : undefined,
    });
  }
}
