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
   * Flat node list linked by `parentId`; the tree is rebuilt and re-laid out on every
   * change. Exactly one node must have a null/undefined `parentId` — it becomes the
   * root, the **last** such node wins if there are several, and nodes whose `parentId`
   * does not resolve to the root's subtree are silently dropped from the render.
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

  tree = computed((): OrgNodePosition | null => {
    const nodes = this.data();
    if (nodes.length === 0) return null;

    const childrenMap = new Map<string, OrgNode[]>();

    for (const node of nodes) {
      if (!childrenMap.has(node.id)) {
        childrenMap.set(node.id, []);
      }
    }

    let root: OrgNode | null = null;
    for (const node of nodes) {
      if (node.parentId === null || node.parentId === undefined) {
        root = node;
      } else {
        const siblings = childrenMap.get(node.parentId) ?? [];
        siblings.push(node);
        childrenMap.set(node.parentId, siblings);
      }
    }

    if (!root) return null;

    const buildPositionedTree = (
      node: OrgNode,
      level: number
    ): OrgNodePosition => {
      const children = childrenMap.get(node.id) ?? [];
      const childPositions = children.map(child =>
        buildPositionedTree(child, level + 1)
      );

      return {
        node,
        x: 0,
        y: 0,
        width: this.nodeWidth(),
        height: this.nodeHeight(),
        level,
        children: childPositions,
      };
    };

    const positionedRoot = buildPositionedTree(root, 0);
    this.calculatePositions(positionedRoot);
    return positionedRoot;
  });

  private calculatePositions(root: OrgNodePosition): void {
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

    positionNode(root, 0, 0);
  }

  flatNodes = computed((): OrgNodePosition[] => {
    const root = this.tree();
    if (!root) return [];

    const result: OrgNodePosition[] = [];
    const flatten = (node: OrgNodePosition): void => {
      result.push(node);
      node.children.forEach(flatten);
    };
    flatten(root);
    return result;
  });

  connections = computed(() => {
    const root = this.tree();
    if (!root) return [];

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

    generateConnections(root);
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
