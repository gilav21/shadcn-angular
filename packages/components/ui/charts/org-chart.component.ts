import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { OrgNode, OrgNodePosition, OrgLayoutDirection, OrgLineType } from './chart.types';
import { getChartColor } from './chart.utils';

@Component({
  selector: 'ui-org-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="containerClasses()" [style.width.px]="svgWidth()" [style.height.px]="svgHeight()">
      <svg
        [attr.width]="svgWidth()"
        [attr.height]="svgHeight()"
        class="overflow-visible"
        role="img"
        [attr.aria-label]="chartAriaLabel()"
      >
        <!-- Connection lines -->
        <g class="org-chart-lines">
          @for (connection of connections(); track connection.id) {
            <path
              [attr.d]="connection.path"
              fill="none"
              stroke="currentColor"
              class="text-border"
              stroke-width="2"
            />
          }
        </g>

        <!-- Node cards using foreignObject -->
        <g class="org-chart-nodes">
          @for (pos of flatNodes(); track pos.node.id) {
            <foreignObject
              [attr.x]="pos.x"
              [attr.y]="pos.y"
              [attr.width]="pos.width"
              [attr.height]="pos.height"
            >
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                class="w-full h-full p-3 rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-center overflow-hidden"
                [style.borderLeftColor]="getNodeColor(pos)"
                [style.borderLeftWidth.px]="4"
                [class.opacity-50]="hoveredId() !== null && hoveredId() !== pos.node.id"
                tabindex="0"
                role="button"
                [attr.aria-label]="getNodeAriaLabel(pos.node)"
                (mouseenter)="onNodeHover(pos.node)"
                (mouseleave)="onNodeLeave()"
                (click)="onNodeClick($event, pos.node)"
                (keydown.enter)="onNodeClick($event, pos.node)"
                (keydown.space)="onNodeClick($event, pos.node)"
              >
                <div class="flex items-center gap-3">
                  @if (showImages() && pos.node.image) {
                    <img
                      [src]="pos.node.image"
                      [alt]="pos.node.name"
                      class="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  } @else if (showImages()) {
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                      [style.backgroundColor]="getNodeColor(pos)"
                    >
                      {{ getInitials(pos.node.name) }}
                    </div>
                  }
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-sm truncate">{{ pos.node.name }}</div>
                    @if (pos.node.title) {
                      <div class="text-xs text-muted-foreground truncate">{{ pos.node.title }}</div>
                    }
                  </div>
                </div>
                @if (pos.node.description) {
                  <div class="text-xs text-muted-foreground mt-2 line-clamp-2">{{ pos.node.description }}</div>
                }
              </div>
            </foreignObject>
          }
        </g>
      </svg>
    </div>
  `,
  host: {
    class: 'block',
  },
})
export class OrgChartComponent {
  data = input.required<OrgNode[]>();
  layout = input<OrgLayoutDirection>('vertical');
  nodeWidth = input(180);
  nodeHeight = input(80);
  nodePaddingX = input(40);
  nodePaddingY = input(60);
  showImages = input(true);
  lineType = input<OrgLineType>('curved');
  class = input('');
  title = input<string | undefined>(undefined);

  nodeClick = output<{ node: OrgNode; event?: MouseEvent }>();
  nodeHover = output<OrgNode | null>();

  hoveredId = signal<string | null>(null);

  tree = computed((): OrgNodePosition | null => {
    const nodes = this.data();
    if (nodes.length === 0) return null;

    const nodeMap = new Map<string, OrgNode>();
    const childrenMap = new Map<string, OrgNode[]>();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
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

  private calculatePositions(root: OrgNodePosition) {
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
    ) => {
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
    const flatten = (node: OrgNodePosition) => {
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

    const generateConnections = (node: OrgNodePosition) => {
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

  containerClasses = computed(() => cn('relative inline-block', this.class()));

  getNodeColor(pos: OrgNodePosition): string {
    if (pos.node.color) return pos.node.color;
    return getChartColor(pos.level);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getNodeAriaLabel(node: OrgNode): string {
    let label = node.name;
    if (node.title) label += `, ${node.title}`;
    return label;
  }

  onNodeHover(node: OrgNode) {
    this.hoveredId.set(node.id);
    this.nodeHover.emit(node);
  }

  onNodeLeave() {
    this.hoveredId.set(null);
    this.nodeHover.emit(null);
  }

  onNodeClick(event: Event, node: OrgNode) {
    this.nodeClick.emit({
      node,
      event: event instanceof MouseEvent ? event : undefined,
    });
  }
}
