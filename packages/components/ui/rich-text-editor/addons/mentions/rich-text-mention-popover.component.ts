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

  /**
   * Which trigger opened the list, which picks the row layout: `'mention'`
   * renders the avatar/label/description row and narrows items with
   * {@link asMention}; `'tag'` renders the color dot and uses {@link asTag}.
   * Also selects the empty-state and `aria-label` strings from {@link locale}.
   */
  readonly type = input<'mention' | 'tag'>('mention');
  /** Translated strings for the `aria-label` and the "no results" message. Defaults to English. */
  readonly locale = input<RichTextMentionsLocale>(RICH_TEXT_MENTIONS_LOCALES['en']);

  /**
   * The text typed after the trigger character. The popover does not filter on
   * it — {@link items} arrives already filtered by the caller's search
   * function — it is passed in so a customized template can highlight the
   * matched substring.
   */
  readonly query = input<string>('');

  /**
   * The candidate rows, in display order; an empty array renders the "no
   * results" message instead of the list. Changing it clamps
   * `selectedIndex` back into range (to the last row, or 0 when empty) so the
   * highlight never points past the end while results stream in.
   */
  readonly items = input<(MentionItem | TagItem)[]>([]);
  /**
   * Top-left offset in pixels, applied as `left`/`top` on the absolutely
   * positioned panel — so it is relative to the nearest positioned ancestor
   * (the editor's overlay anchor), not the viewport. The caller is responsible
   * for clamping it inside that anchor.
   */
  readonly position = input<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * A row was chosen, by click or by `Enter`. The popover does not close
   * itself on selection — the host is expected to insert the entity and tear
   * the popover down.
   */
  readonly itemSelect = output<MentionItem | TagItem>();

  /**
   * The user dismissed the list: `Escape`/`Tab`, or a click anywhere outside
   * the `ui-rich-text-mention-popover` element. The host owns the teardown;
   * this component stays rendered until it is destroyed.
   */
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

  /**
   * Classes for the row button at `index`, adding the accent highlight when it
   * is the keyboard-selected row. Reads `selectedIndex`, so it re-runs on
   * every change detection pass as the highlight moves.
   */
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

  /**
   * Drives keyboard navigation. Consumes `ArrowDown`/`ArrowUp` (move the
   * highlight, clamped at the ends, scrolling the row into view), `Enter`
   * (emits {@link itemSelect} for the highlighted row) and `Escape`/`Tab`
   * (emits {@link closed}); every one of those calls `preventDefault()`, all
   * other keys are ignored and left alone. With no {@link items} only
   * `Escape`/`Tab` are handled. Public because the host directive forwards the
   * editor's keydown here — the popover never takes focus itself.
   */
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

  /**
   * Emits {@link itemSelect} for a clicked row. The row button also
   * `preventDefault()`s its `mousedown`, so the editor keeps focus and its
   * caret survives the click.
   */
  onItemClick(item: MentionItem | TagItem): void {
    this.itemSelect.emit(item);
  }

  private scrollToSelected(): void {
    const buttons = this.itemButtons?.toArray();
    const selected = buttons?.[this.selectedIndex()];
    selected?.nativeElement.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Template-only narrowing cast: returns `item` unchanged so the template can
   * reach `avatar`/`description` in the `type() === 'mention'` branch, which
   * the union type hides. Unchecked — only call it where {@link type} is
   * already known to be `'mention'`.
   */
  asMention(item: MentionItem | TagItem): MentionItem {
    return item;
  }

  /**
   * Template-only narrowing cast for the tag branch, giving access to `color`.
   * The mirror of {@link asMention}, and equally unchecked.
   */
  asTag(item: MentionItem | TagItem): TagItem {
    return item;
  }
}
