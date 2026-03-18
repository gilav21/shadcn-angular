import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
  ButtonComponent,
  IconComponent,
  VirtualScrollComponent,
  VirtualItemDirective,
  VirtualScrollState,
} from '../../../../../packages/components/ui';
import { VirtualScrollItem } from '../shared/types';

@Component({
  selector: 'app-virtual-scroll-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VirtualScrollComponent, VirtualItemDirective, ButtonComponent, IconComponent],
  templateUrl: './virtual-scroll-demo.component.html',
})
export class VirtualScrollDemoComponent {
  readonly virtualScrollRef = viewChild<VirtualScrollComponent<VirtualScrollItem>>('virtualScrollRef');
  readonly virtualScrollItems = signal<VirtualScrollItem[]>([]);
  readonly virtualScrollLoading = signal(false);
  readonly virtualScrollHasMoreBottom = signal(true);
  readonly virtualScrollWindowStart = signal(0);
  readonly virtualScrollWindowEnd = signal(0);
  readonly virtualScrollVisibleCount = signal(0);
  readonly virtualScrollProgress = signal(0);
  private virtualScrollPageBottom = 0;
  private readonly ITEMS_PER_PAGE = 50;

  constructor() {
    this.generateVirtualScrollItems();
  }

  private generateVirtualScrollItems() {
    const items: VirtualScrollItem[] = [];
    const types = ['card', 'list', 'image', 'chart'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

    for (let i = 0; i < this.ITEMS_PER_PAGE * 2; i++) {
      const height = this.getVirtualScrollItemHeight();
      const type = types[Math.floor(Math.random() * types.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const id = i + 1;

      items.push(this.createItem(id, type, color, height));
    }

    this.virtualScrollItems.set(items);
    this.virtualScrollPageBottom = 2;
  }

  loadMoreBottom() {
    if (this.virtualScrollLoading() || !this.virtualScrollHasMoreBottom()) return;

    this.virtualScrollLoading.set(true);

    setTimeout(() => {
      const currentItems = this.virtualScrollItems();
      const newItems: VirtualScrollItem[] = [];
      const types = ['card', 'list', 'image', 'chart'];
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
      const startId = currentItems.length + 1;

      for (let i = 0; i < this.ITEMS_PER_PAGE; i++) {
        const height = this.getVirtualScrollItemHeight();
        const type = types[Math.floor(Math.random() * types.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const id = startId + i;

        newItems.push(this.createItem(id, type, color, height));
      }

      this.virtualScrollItems.set([...currentItems, ...newItems]);
      this.virtualScrollPageBottom++;
      this.virtualScrollLoading.set(false);

      if (this.virtualScrollPageBottom >= 10) {
        this.virtualScrollHasMoreBottom.set(false);
      }
    }, 500);
  }

  onVirtualScrollStateChange(state: VirtualScrollState) {
    this.virtualScrollWindowStart.set(state.windowStart);
    this.virtualScrollWindowEnd.set(state.windowEnd);
    this.virtualScrollVisibleCount.set(state.windowSize);
    this.virtualScrollProgress.set(state.scrollProgress);
  }

  scrollVirtualToTop() {
    this.virtualScrollRef()?.scrollToTop();
  }

  scrollVirtualToBottom() {
    this.virtualScrollRef()?.scrollToBottom();
  }

  private getVirtualScrollItemHeight(): number {
    const rand = Math.random();
    if (rand < 0.4) return 50 + Math.floor(Math.random() * 100);
    if (rand < 0.7) return 150 + Math.floor(Math.random() * 200);
    if (rand < 0.9) return 350 + Math.floor(Math.random() * 400);
    return 750 + Math.floor(Math.random() * 1250);
  }

  private createItem(id: number, type: string, color: string, height: number): VirtualScrollItem {
    return {
      id,
      title: `Complex Item #${id}`,
      description: `This is a ${type} item with ${height}px height. It demonstrates the virtual scroll's ability to handle dramatically different item sizes efficiently.`,
      height,
      type,
      color,
      tags: type === 'card' ? ['Tag A', 'Tag B', 'Tag C'] : [],
      subItems: type === 'list' ? [
        { id: 1, name: 'Sub-item One' },
        { id: 2, name: 'Sub-item Two' },
        { id: 3, name: 'Sub-item Three' },
        { id: 4, name: 'Sub-item Four' },
      ] : [],
      imageSize: type === 'image' ? '1920x1080' : '',
      chartData: type === 'chart' ? [
        { month: 'Jan', value: 30 + Math.random() * 70 },
        { month: 'Feb', value: 30 + Math.random() * 70 },
        { month: 'Mar', value: 30 + Math.random() * 70 },
        { month: 'Apr', value: 30 + Math.random() * 70 },
        { month: 'May', value: 30 + Math.random() * 70 },
        { month: 'Jun', value: 30 + Math.random() * 70 },
      ] : [],
      expandedContent: height > 500 ?
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. '.repeat(5) : '',
    };
  }
}
