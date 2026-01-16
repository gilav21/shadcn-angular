import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  ElementRef,
  OnDestroy,
  ViewChildren,
  QueryList,
  AfterViewInit,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';
import { ScrollAreaComponent } from './scroll-area.component';
import { LucideAngularModule } from 'lucide-angular';

export interface MentionItem {
  id?: string;
  value: string;
  label: string;
  avatar?: string;
  description?: string;
}

export interface TagItem {
  id?: string;
  value: string;
  label: string;
  color?: string;
}

@Component({
  selector: 'ui-rich-text-mention-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollAreaComponent, LucideAngularModule],
  template: `
    <div
      [class]="containerClasses()"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
      role="listbox"
      [attr.aria-label]="type() === 'mention' ? 'Select a user' : 'Select a tag'"
      (keydown)="onKeydown($event)"
    >
      @if (items().length === 0) {
        <div class="p-3 text-sm text-muted-foreground text-center">
          @if (type() === 'mention') {
            No users found
          } @else {
            No tags found
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

  query = input<string>('');

  items = input<(MentionItem | TagItem)[]>([]);
  position = input<{ x: number; y: number }>({ x: 0, y: 0 });

  itemSelect = output<MentionItem | TagItem>();

  close = output<void>();

  selectedIndex = signal<number>(0);

  private clickListener = (event: MouseEvent) => {
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

  ngAfterViewInit(): void {
    this.document.addEventListener('click', this.clickListener);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('click', this.clickListener);
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.items();
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
        event.preventDefault();
        this.close.emit();
        break;
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
