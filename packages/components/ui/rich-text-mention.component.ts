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
import { cn } from '../lib/utils';
import { ScrollAreaComponent } from './scroll-area';
import { RichTextLocale, RICH_TEXT_LOCALES } from './rich-text-locales';

/**
 * A user/entity candidate for the `@mention` popover.
 *
 * Return an array of these from your `[mentionSearch]` function.
 * The popover displays `label` as the primary text and `description`
 * as secondary text beneath it. If `avatar` is provided, it renders
 * as a circular thumbnail; otherwise the first letter of `label` is shown.
 *
 * @example
 * ```ts
 * const users: MentionItem[] = [
 *   { id: 'u-1', value: 'jane', label: 'Jane Doe', avatar: '/avatars/jane.png', description: 'Engineering' },
 *   { id: 'u-2', value: 'bob',  label: 'Bob Smith' },
 * ];
 * ```
 */
export interface MentionItem {
  /**
   * Unique identifier for this user/entity. Used as the entity `id` in
   * {@link RichTextEntityRenderContext} and emitted in {@link RichTextEntityInsertEvent}.
   * If omitted, `value` is used as the identifier.
   */
  id?: string;

  /**
   * Machine-friendly value (e.g. username, slug). Used as a fallback `id`
   * and stored in the `data-mention` attribute on the rendered DOM element.
   */
  value: string;

  /**
   * Human-readable display name shown in the popover list and as the
   * default inserted text (e.g. `"@Jane Doe"`).
   */
  label: string;

  /** URL of an avatar image. Rendered as a 24×24 circular thumbnail in the popover. */
  avatar?: string;

  /** Secondary text shown below the label in the popover (e.g. job title, team name). */
  description?: string;
}

/**
 * A tag candidate for the `#tag` popover.
 *
 * Return an array of these from your `[tagSearch]` function.
 * The popover displays a small colored dot (from `color`) next to the `label`.
 *
 * @example
 * ```ts
 * const tags: TagItem[] = [
 *   { id: 't-1', value: 'bug',     label: 'Bug',     color: '#ef4444' },
 *   { id: 't-2', value: 'feature', label: 'Feature',  color: '#3b82f6' },
 * ];
 * ```
 */
export interface TagItem {
  /**
   * Unique identifier for this tag. Used as the entity `id` in
   * {@link RichTextEntityRenderContext}. If omitted, `value` is used.
   */
  id?: string;

  /**
   * Machine-friendly value (e.g. slug). Used as a fallback `id`
   * and stored in the `data-tag` attribute on the rendered DOM element.
   */
  value: string;

  /** Human-readable tag name shown in the popover and as the default inserted text. */
  label: string;

  /**
   * CSS color for the dot indicator in the popover. Accepts any valid CSS
   * color value (hex, rgb, hsl, named colors). Defaults to the theme's accent color.
   */
  color?: string;
}

@Component({
  selector: 'ui-rich-text-mention-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollAreaComponent],
  template: `
    <div
      [class]="containerClasses()"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
      role="listbox"
      [attr.aria-label]="type() === 'mention' ? locale().mentions.selectUser : locale().mentions.selectTag"
      (keydown)="onKeydown($event)"
    >
      @if (items().length === 0) {
        <div class="p-3 text-sm text-muted-foreground text-center">
          @if (type() === 'mention') {
            {{ locale().mentions.noUsersFound }}
          } @else {
            {{ locale().mentions.noTagsFound }}
          }
        </div>
      } @else {
        <ui-scroll-area class="max-h-48">
          <div class="p-1">
            @for (item of items(); track item.value; let i = $index) {
              <button
                #itemButton
                type="button"
                [class]="itemClasses(i)"
                [attr.data-index]="i"
                [attr.aria-selected]="i === selectedIndex()"
                role="option"
                (mousedown)="$event.preventDefault()"
                (click)="onItemClick(item)"
                (mouseenter)="selectedIndex.set(i)"
              >
                @if (type() === 'mention') {
                  <!-- Mention item with avatar -->
                  <div class="flex items-center gap-2">
                    @if (asMention(item).avatar) {
                      <img 
                        [src]="asMention(item).avatar" 
                        [alt]="item.label"
                        class="w-6 h-6 rounded-full object-cover"
                      />
                    } @else {
                      <div class="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-medium">
                        {{ item.label.charAt(0).toUpperCase() }}
                      </div>
                    }
                    <div class="flex flex-col items-start">
                      <span class="text-sm font-medium">{{ item.label }}</span>
                      @if (asMention(item).description) {
                        <span class="text-xs text-muted-foreground">{{ asMention(item).description }}</span>
                      }
                    </div>
                  </div>
                } @else {
                  <!-- Tag item with color -->
                  <div class="flex items-center gap-2">
                    <div 
                      class="w-3 h-3 rounded-full"
                      [style.background-color]="asTag(item).color || 'var(--accent)'"
                    ></div>
                    <span class="text-sm">{{ item.label }}</span>
                  </div>
                }
              </button>
            }
          </div>
        </ui-scroll-area>
      }
    </div>
  `,
  host: {
    class: 'contents',
  },
})
export class RichTextMentionPopoverComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);

  @ViewChildren('itemButton') itemButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  type = input<'mention' | 'tag'>('mention');
  locale = input<RichTextLocale>(RICH_TEXT_LOCALES['en']);

  query = input<string>('');

  items = input<(MentionItem | TagItem)[]>([]);
  position = input<{ x: number; y: number }>({ x: 0, y: 0 });

  itemSelect = output<MentionItem | TagItem>();

  close = output<void>();

  selectedIndex = signal<number>(0);

  private readonly clickListener = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('ui-rich-text-mention-popover')) {
      this.close.emit();
    }
  };

  containerClasses = computed(() =>
    cn(
      'absolute z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md',
      'animate-in fade-in-0 zoom-in-95'
    )
  );

  itemClasses(index: number) {
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
        this.close.emit();
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
        this.close.emit();
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
    return item as MentionItem;
  }

  asTag(item: MentionItem | TagItem): TagItem {
    return item as TagItem;
  }
}
