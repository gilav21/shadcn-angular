import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
  inject,
  ElementRef,
  OnDestroy,
  ViewChildren,
  QueryList,
  AfterViewInit,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../../../lib/utils';
import { ScrollAreaComponent } from '../../../scroll-area';
import { RICH_TEXT_MENTIONS_LOCALES, type RichTextMentionsLocale } from './rich-text-mentions.locales';
import type { MentionItem, TagItem } from './rich-text-mentions.types';

@Component({
  selector: 'ui-rich-text-mention-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollAreaComponent],
  templateUrl: './rich-text-mention-popover.component.html',
  host: {
    class: 'contents',
  },
})
export class RichTextMentionPopoverComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);

  @ViewChildren('itemButton') itemButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly type = input<'mention' | 'tag'>('mention');
  readonly locale = input<RichTextMentionsLocale>(RICH_TEXT_MENTIONS_LOCALES['en']);

  readonly query = input<string>('');

  readonly items = input<(MentionItem | TagItem)[]>([]);
  readonly position = input<{ x: number; y: number }>({ x: 0, y: 0 });

  readonly itemSelect = output<MentionItem | TagItem>();

  readonly closed = output<void>();

  readonly selectedIndex = signal<number>(0);

  private readonly clickListener = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (!target.closest('ui-rich-text-mention-popover')) {
      this.closed.emit();
    }
  };

  readonly containerClasses = computed(() =>
    cn(
      'absolute z-50 w-64 max-w-[calc(100vw-2rem)] rounded-md border bg-popover text-popover-foreground shadow-md',
      'animate-in fade-in-0 zoom-in-95'
    )
  );

  itemClasses(index: number): string {
    return cn(
      'w-full flex items-start rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
      'hover:bg-accent hover:text-accent-foreground',
      'focus:bg-accent focus:text-accent-foreground',
      index === this.selectedIndex() && 'bg-accent text-accent-foreground'
    );
  }

  constructor() {
    effect(() => {
      const length = this.items().length;
      const currentIndex = this.selectedIndex();
      if (length === 0) {
        if (currentIndex !== 0) {
          this.selectedIndex.set(0);
        }
        return;
      }
      if (currentIndex >= length) {
        this.selectedIndex.set(length - 1);
      }
    });
  }

  ngAfterViewInit(): void {
    this.document.addEventListener('click', this.clickListener);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('click', this.clickListener);
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.items();
    if (items.length === 0) {
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault();
        this.closed.emit();
      }
      return;
    }
    const currentIndex = this.selectedIndex();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.set(Math.min(currentIndex + 1, items.length - 1));
        this.scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.set(Math.max(currentIndex - 1, 0));
        this.scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        if (items[currentIndex]) {
          this.itemSelect.emit(items[currentIndex]);
        }
        break;
      case 'Escape':
      case 'Tab':
        event.preventDefault();
        this.closed.emit();
        break;
    }
  }

  onItemClick(item: MentionItem | TagItem): void {
    this.itemSelect.emit(item);
  }

  private scrollToSelected(): void {
    const buttons = this.itemButtons?.toArray();
    const selected = buttons?.[this.selectedIndex()];
    selected?.nativeElement.scrollIntoView({ block: 'nearest' });
  }

  asMention(item: MentionItem | TagItem): MentionItem {
    return item;
  }

  asTag(item: MentionItem | TagItem): TagItem {
    return item;
  }
}
