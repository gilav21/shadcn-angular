import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    ElementRef,
    QueryList,
    ViewChildren,
    ViewChild,
    AfterViewInit,
    OnDestroy,
    effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../../../lib/utils';
import { anchorToTopLayer, type TopLayerHandle } from '../../../lib/top-layer';
import { InputComponent } from '../../input';
import { InputGroupComponent, InputGroupAddonComponent } from '../../input-group';
import { ScrollAreaComponent } from '../../scroll-area';
import { TooltipDirective } from '../../tooltip';
import { EMOJI_DATA } from '../emoji-data';
import { EMOJI_PICKER, EMOJI_CATEGORIES, EmojiCategory } from '../emoji-picker.component';

@Component({
    selector: 'ui-emoji-picker-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        ScrollAreaComponent,
        TooltipDirective,
        InputComponent,
        InputGroupComponent,
        InputGroupAddonComponent,
    ],
    template: `
        @if (picker?.open()) {
            <div
                [class]="contentClasses()"
                [style]="contentStyles()"
                [style.visibility]="strategy() === 'fixed' && !fixedReady() ? 'hidden' : null"
                [attr.data-slot]="'emoji-picker-content'"
                [attr.data-state]="picker?.open() ? 'open' : 'closed'"
            >
                <div class="flex flex-col gap-3">
                    <!-- Search Input -->
                    <ui-input-group>
                        <ui-input-group-addon>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                        </ui-input-group-addon>
                        <ui-input
                            type="text"
                            placeholder="Search emojis..."
                            class="text-sm"
                            [ngModel]="searchQuery()"
                            (ngModelChange)="searchQuery.set($event)"
                        />
                    </ui-input-group>

                    <!-- Category Navigation -->
                    <div class="flex gap-1 pb-2 border-b border-border">
                        @for (category of categories; track category.id) {
                            <button
                                type="button"
                                [uiTooltip]="category.name"
                                [class]="categoryButtonClasses(category.id)"
                                (click)="scrollToCategory(category.id)"
                            >
                                {{ category.icon }}
                            </button>
                        }
                    </div>

                    <!-- Emoji Grid -->
                    <ui-scroll-area class="h-64">
                        <div class="pe-3">
                            @for (category of filteredCategories(); track category.id) {
                                <div
                                    class="mb-4 [content-visibility:auto] [contain-intrinsic-size:auto_320px]"
                                    [attr.data-category]="category.id"
                                    #categorySection
                                >
                                    <div class="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-popover py-1">
                                        {{ category.name }}
                                    </div>
                                    <div class="grid grid-cols-8 gap-0.5">
                                        @for (emoji of category.emojis; track emoji) {
                                            <button
                                                type="button"
                                                class="size-8 flex items-center justify-center text-xl rounded-md hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                                                (click)="selectEmoji(emoji)"
                                            >
                                                {{ emoji }}
                                            </button>
                                        }
                                    </div>
                                </div>
                            }
                            @if (filteredCategories().length === 0) {
                                <div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                    <span class="text-3xl mb-2">🔍</span>
                                    <span class="text-sm">No emojis found</span>
                                </div>
                            }
                        </div>
                    </ui-scroll-area>
                </div>
            </div>
        }
    `,
    host: { class: 'contents' },
})
export class EmojiPickerContentComponent implements AfterViewInit, OnDestroy {
    readonly picker = inject(EMOJI_PICKER, { optional: true });
    private readonly el = inject(ElementRef);

    /**
     * Extra classes merged onto the floating panel — after the positioning utilities, so
     * a width or `max-w-` here overrides the default `w-80`.
     */
    class = input('');

    categories: EmojiCategory[] = EMOJI_CATEGORIES;
    searchQuery = signal('');
    activeCategory = signal('smileys');

    @ViewChildren('categorySection') categorySections!: QueryList<ElementRef<HTMLElement>>;

    private _scrollArea?: ScrollAreaComponent;
    @ViewChild(ScrollAreaComponent)
    set scrollArea(value: ScrollAreaComponent | undefined) {
        this._scrollArea = value;
        if (value?.viewportRef?.nativeElement) {
            this.setupScrollListener(value.viewportRef.nativeElement);
        } else {
            this.scrollRemoveListener?.();
            this.scrollRemoveListener = null;
        }
    }

    private scrollRemoveListener: (() => void) | null = null;
    private isScrollingProgrammatically = false;
    private topLayer: TopLayerHandle | null = null;

    /**
     * Positioning mode. `'absolute'` (default) anchors the panel under the trigger and
     * is clipped by any scrolling/`overflow:hidden` ancestor; `'fixed'` measures the
     * trigger on open and pins the panel to the viewport instead — flipping it up and
     * clamping it inside the edges — which escapes such ancestors but does **not**
     * follow the trigger while scrolling (pair it with the picker's `closeOnScroll`).
     */
    strategy = input<'absolute' | 'fixed'>('absolute');
    private readonly fixedPosition = signal({ top: 0, left: 0 });
    /** Gates visibility until the fixed position is measured, so the panel never
     *  flashes at its default 0,0 on the first open. */
    readonly fixedReady = signal(false);

    constructor() {
        effect(() => {
            if (this.picker?.open() && this.strategy() === 'fixed') {
                this.fixedReady.set(false);
                requestAnimationFrame(() => {
                    this.updateFixedPosition();
                    this.fixedReady.set(true);
                });
            } else {
                this.fixedReady.set(false);
            }
        });

        effect(() => {
            if (this.picker?.open() && this.strategy() === 'absolute') {
                requestAnimationFrame(() => this.promotePanel());
            } else {
                this.releasePanel();
            }
        });
    }

    ngAfterViewInit(): void {
        this.categorySections.changes.subscribe(() => {
            this.onScroll();
        });
    }

    ngOnDestroy(): void {
        this.scrollRemoveListener?.();
        this.releasePanel();
    }

    /**
     * Lift the panel into the top layer so the default `absolute` strategy is no
     * longer chopped off by a card, an accordion panel or a scroll area around
     * the trigger. Deferred by a frame because the panel is only rendered once
     * the picker has opened. The `fixed` strategy pins its own viewport
     * coordinates and is left alone.
     */
    private promotePanel(): void {
        if (this.topLayer || !this.picker?.open()) return;

        const root = this.el.nativeElement as HTMLElement;
        const trigger = root
            .closest('[data-slot="emoji-picker"]')
            ?.querySelector<HTMLElement>('[data-slot="emoji-picker-trigger"]');
        const panel = root.querySelector<HTMLElement>('[data-slot="emoji-picker-content"]');
        if (!trigger || !panel) return;

        const rtl = globalThis.getComputedStyle(panel).direction === 'rtl';
        const handle = anchorToTopLayer(panel, trigger, { align: rtl ? 'end' : 'start' });
        if (handle.promoted) {
            this.topLayer = handle;
        }
    }

    /** Return the panel to normal flow; skipping this leaks the top-layer listeners. */
    private releasePanel(): void {
        this.topLayer?.release();
        this.topLayer = null;
    }

    private updateFixedPosition(): void {
        const trigger = this.el.nativeElement.closest('[data-slot="emoji-picker"]')?.querySelector('[data-slot="emoji-picker-trigger"]');
        if (!trigger) return;
        const rect = (trigger as HTMLElement).getBoundingClientRect();
        const pickerWidth = Math.min(320, globalThis.window.innerWidth - 16);
        const left = Math.max(8, Math.min(rect.left, globalThis.window.innerWidth - pickerWidth - 8));
        const top = Math.min(rect.bottom + 4, globalThis.window.innerHeight - 380);
        this.fixedPosition.set({ top, left });
    }

    contentClasses = computed(() =>
        cn(
            this.strategy() === 'fixed'
                ? 'fixed z-50 w-80 max-w-[calc(100vw-2rem)] p-3 rounded-md border bg-popover text-popover-foreground shadow-md outline-none overflow-hidden'
                : 'absolute start-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] p-3 rounded-md border bg-popover text-popover-foreground shadow-md outline-none overflow-hidden',
            'animate-in fade-in-0 zoom-in-95',
            this.class()
        )
    );

    contentStyles = computed(() => {
        if (this.strategy() !== 'fixed') return '';
        const pos = this.fixedPosition();
        return `top:${pos.top}px;left:${pos.left}px;`;
    });

    filteredCategories = computed(() => {
        const query = this.searchQuery().toLowerCase().trim();
        if (!query) {
            return this.categories;
        }

        return this.categories
            .map(category => ({
                ...category,
                emojis: category.emojis.filter(emoji => {
                    if (category.name.toLowerCase().includes(query)) return true;
                    if (emoji.includes(query)) return true;
                    const keywords = EMOJI_DATA[emoji];
                    return keywords?.some(keyword => keyword.toLowerCase().includes(query));
                }),
            }))
            .filter(category => category.emojis.length > 0);
    });

    /**
     * Classes for a category tab, highlighting the one tracked as active — which follows
     * the grid's scroll position, not only explicit clicks.
     */
    categoryButtonClasses(categoryId: string): string {
        const isActive = this.activeCategory() === categoryId;
        return cn(
            'size-8 flex items-center justify-center text-lg rounded-md transition-colors',
            'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
            isActive && 'bg-accent'
        );
    }

    /**
     * Jumps the grid to a category section, clearing the search box first so every
     * category is present to scroll to. The scroll is smooth and the scroll-spy that
     * normally tracks the active tab is suppressed for ~800ms so it cannot fight the
     * animation.
     */
    scrollToCategory(categoryId: string): void {
        this.searchQuery.set('');
        this.activeCategory.set(categoryId);
        this.isScrollingProgrammatically = true;

        setTimeout(() => {
            const viewport = this._scrollArea?.viewportRef?.nativeElement;
            const section = this.el.nativeElement.querySelector(
                `[data-category="${categoryId}"]`
            ) as HTMLElement;

            if (section && viewport) {
                const relativeTop = section.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
                const scrollTop = viewport.scrollTop + relativeTop;

                viewport.scrollTo({ top: scrollTop, behavior: 'smooth' });

                setTimeout(() => {
                    this.isScrollingProgrammatically = false;
                }, 800);
            } else {
                this.isScrollingProgrammatically = false;
            }
        });
    }

    private setupScrollListener(viewport: HTMLElement): void {
        this.scrollRemoveListener?.();

        const listener = (): void => this.onScroll();
        viewport.addEventListener('scroll', listener, { passive: true });
        this.scrollRemoveListener = (): void => viewport.removeEventListener('scroll', listener);

        setTimeout(() => this.onScroll(), 0);
    }

    private onScroll(): void {
        if (this.isScrollingProgrammatically || !this._scrollArea?.viewportRef?.nativeElement) return;

        const viewport = this._scrollArea.viewportRef.nativeElement;
        const scrollTop = viewport.scrollTop;

        const buffer = 50;

        const sections = this.categorySections.toArray();
        let activeId: string | null = null;

        for (const section of sections) {
            const element = section.nativeElement;
            if (element.offsetTop <= scrollTop + buffer) {
                activeId = element.dataset['category'] ?? null;
            } else {
                break;
            }
        }

        if (activeId && activeId !== this.activeCategory()) {
            this.activeCategory.set(activeId);
        }
    }

    /**
     * Forwards a grid click to the parent picker, which emits `emojiSelect` and applies
     * `closeOnSelect`. A no-op when this content is used outside a `ui-emoji-picker`.
     */
    selectEmoji(emoji: string): void {
        this.picker?.selectEmoji(emoji);
    }
}
