import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    contentChild,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    Injector,
    input,
    model,
    output,
    signal,
    TemplateRef,
    untracked,
    viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { cn, isRtl } from '../../lib/utils';
import { createLocaleBindings, provideComponentLocale, type LocaleInput } from '../../lib/i18n';
import { createFlip } from '../../lib/flip';
import { startAutoScroll, type AutoScrollController } from '../../lib/auto-scroll';
import { createResizeObserver } from '../../lib/observers';
import { ButtonComponent } from '../button';
import { IconComponent } from '../icon';
import { InputComponent } from '../input';
import { NativeSelectComponent } from '../native-select';
import { FIELD_MAPPER_LOCALES, type FieldMapperLocale } from './field-mapper-locales';
import {
    addLink,
    alignEndRows,
    filterItems,
    linkPath,
    navigate,
    removeLinks,
    resolveMaxLinks,
    sameLink,
    type FieldMapperLinkChange,
} from './field-mapper.utils';
import type {
    FieldMapperItem,
    FieldMapperItemContext,
    FieldMapperLayout,
    FieldMapperLink,
    FieldMapperLinkLabelContext,
    FieldMapperLinkTone,
    FieldMapperMaxLinks,
    FieldMapperSide,
} from './field-mapper.types';
import { FieldMapperItemDirective } from './sub/field-mapper-item.directive';
import { FieldMapperLinkLabelDirective } from './sub/field-mapper-link-label.directive';

/** One drawn line, in the grid's coordinate space. */
export interface FieldMapperLine {
    readonly key: string;
    readonly link: FieldMapperLink;
    readonly path: string;
    readonly midX: number;
    readonly midY: number;
    readonly tone: FieldMapperLinkTone;
    /** One end is hidden by a filter, so the line runs to that list's edge. */
    readonly toEdge: boolean;
}

interface Geometry {
    readonly width: number;
    readonly height: number;
    readonly gutter: number;
    readonly lines: readonly FieldMapperLine[];
    readonly rubberBand: string | null;
}

interface Point {
    readonly x: number;
    readonly y: number;
}

/** What the grid looked like at one measurement. */
interface Frame {
    readonly origin: DOMRect;
    readonly handles: ReadonlyMap<string, Point>;
    readonly columns: Readonly<Record<FieldMapperSide, DOMRect | null>>;
    readonly notes: Readonly<Record<FieldMapperSide, number | null>>;
}

interface PickedItem {
    readonly side: FieldMapperSide;
    readonly id: string;
}

interface DragState extends PickedItem {
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    moved: boolean;
    clientX: number;
    clientY: number;
}

const EMPTY_GEOMETRY: Geometry = { width: 0, height: 0, gutter: 0, lines: [], rubberBand: null };
/** Below this container width (in rem) the gutter no longer fits and the rows layout takes over. */
const NARROW_BELOW_REM = 28;
/** Pointer travel (px) before a press on a handle becomes a drag rather than a tap. */
const DRAG_THRESHOLD = 4;
const REALIGN_MS = 220;
const HEADER_ROWS = 1;
const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

let nextId = 0;

function handleKey(side: FieldMapperSide, id: string): string {
    return `${side}\u0000${id}`;
}

function otherSide(side: FieldMapperSide): FieldMapperSide {
    return side === 'start' ? 'end' : 'start';
}

function centerOf(rect: DOMRect, origin: DOMRect): Point {
    return { x: rect.left + rect.width / 2 - origin.left, y: rect.top + rect.height / 2 - origin.top };
}

/** The x of whichever vertical edge of `column` is nearer to `x`. */
function nearestEdge(column: DOMRect, origin: DOMRect, x: number): number {
    const left = column.left - origin.left;
    const right = column.right - origin.left;
    return Math.abs(left - x) < Math.abs(right - x) ? left : right;
}

/**
 * Field Mapper — two lists side by side, joined by lines that say which goes
 * with which: import field mapping, schema mapping, pairing columns across two
 * tables.
 *
 * Lists are `start` and `end`, never left and right: in a right-to-left
 * document the start list is on the right and the whole component mirrors.
 * A line can be drawn three ways, each complete on its own — drag from an
 * item's dot, tap one item then one in the other list, or the keyboard — and
 * every change is announced in a polite live region.
 *
 * Both lists sit in one CSS grid inside one scroll container, so the lines
 * (an SVG in the same scrolled content) can never drift from their items.
 * Below about 28rem of its own width the component switches to stacked rows,
 * each start item with a picker for its partner.
 *
 * ```html
 * <ui-field-mapper [start]="fileColumns" [end]="fields" [(links)]="mapping" />
 * ```
 */
@Component({
    selector: 'ui-field-mapper',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgTemplateOutlet, FormsModule, ButtonComponent, IconComponent, InputComponent, NativeSelectComponent],
    templateUrl: './field-mapper.component.html',
    styleUrl: './field-mapper.component.css',
    host: { class: 'block' },
    providers: [provideComponentLocale(() => FieldMapperComponent)],
})
export class FieldMapperComponent {
    private readonly injector = inject(Injector);

    /** Items of the start list — on the left in LTR, on the right in RTL. */
    readonly start = input<readonly FieldMapperItem[]>([]);
    /** Items of the end list. */
    readonly end = input<readonly FieldMapperItem[]>([]);
    /**
     * The links, as a two-way `model()`. The component never invents one:
     * every change comes from the user and is emitted through `linksChange`.
     */
    readonly links = model<readonly FieldMapperLink[]>([]);
    /**
     * How many links one item may hold, per side; default 1 on each. Going
     * over moves the item's oldest link rather than doubling up: drawing
     * `b → x` while `a → x` exists removes `a → x` when `end` is 1. Pass
     * `Infinity` to allow any number.
     */
    readonly maxLinks = input<FieldMapperMaxLinks>({ start: 1, end: 1 });
    /** Heading over the start list. Falls back to the locale's. */
    readonly startHeading = input<string>();
    /** Heading over the end list. Falls back to the locale's. */
    readonly endHeading = input<string>();
    /**
     * Orders the end list so each linked item sits level with its partner and
     * lines run straight across; unlinked items keep their order in the rows
     * left free. Re-alignment animates unless reduced motion is preferred.
     */
    readonly align = input(true);
    /**
     * `auto` shows the two lists side by side and switches to stacked rows
     * when the component is narrower than about 28rem; `columns` and `rows`
     * force one layout whatever the width.
     */
    readonly layout = input<FieldMapperLayout>('auto');
    /** Adds a filter box over each list. A line to a filtered-out item runs to that list's edge. */
    readonly searchable = input(false);
    /** Picks each line's tone, e.g. `muted` for a proposed-but-weak link. */
    readonly linkTone = input<((link: FieldMapperLink) => FieldMapperLinkTone) | undefined>(undefined);
    /** Locale code or dictionary for every built-in string. Falls back to `UI_LOCALE_ID`, then English. */
    readonly locale = input<LocaleInput<FieldMapperLocale>>();
    /** Extra classes merged onto the root element. */
    readonly class = input('');

    /** Emits the line the user selected (click, tap, or a key from its item), or `null` when cleared. */
    readonly linkSelect = output<FieldMapperLink | null>();

    protected readonly itemTemplate = contentChild(FieldMapperItemDirective, { read: TemplateRef });
    protected readonly linkLabelTemplate = contentChild(FieldMapperLinkLabelDirective, { read: TemplateRef });

    private readonly i18n = createLocaleBindings(this.locale, FIELD_MAPPER_LOCALES);
    /** The active locale strings. */
    readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
    private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');

    private readonly baseId = `ui-field-mapper-${++nextId}`;
    protected readonly ids = {
        startHeading: `${this.baseId}-start-heading`,
        endHeading: `${this.baseId}-end-heading`,
        instructions: `${this.baseId}-instructions`,
    };

    /** Whether the container is narrower than ~28rem, as last measured. */
    private readonly measuredNarrow = signal(false);
    /** Whether the stacked rows layout is showing. */
    readonly narrow = computed(() => {
        const layout = this.layout();
        if (layout === 'auto') return this.measuredNarrow();
        return layout === 'rows';
    });
    /** Text of each list's filter box. */
    readonly startQuery = signal('');
    readonly endQuery = signal('');
    /** The item picked by a tap or Enter, waiting for a partner in the other list. */
    readonly pending = signal<PickedItem | null>(null);
    /** The line selected for removal or inspection. */
    readonly selectedLink = signal<FieldMapperLink | null>(null);
    protected readonly geometry = signal<Geometry>(EMPTY_GEOMETRY);
    protected readonly liveMessage = signal('');
    protected readonly dragging = signal<PickedItem | null>(null);
    private readonly activeId = signal<Record<FieldMapperSide, string | null>>({ start: null, end: null });

    readonly limits = computed(() => resolveMaxLinks(this.maxLinks()));
    readonly startHeadingText = computed(() => this.startHeading() ?? this.t().startHeading);
    readonly endHeadingText = computed(() => this.endHeading() ?? this.t().endHeading);

    readonly startVisible = computed(() => filterItems(this.start(), this.startQuery()));
    readonly endVisible = computed(() => filterItems(this.end(), this.endQuery()));

    private readonly startById = computed(() => new Map(this.start().map(item => [item.id, item])));
    private readonly endById = computed(() => new Map(this.end().map(item => [item.id, item])));

    /** End items in row order; `null` is a row with no end item. */
    readonly endRows = computed<readonly (FieldMapperItem | null)[]>(() =>
        this.align()
            ? alignEndRows(this.startVisible(), this.endVisible(), this.links())
            : this.endVisible(),
    );

    private readonly endRowById = computed(() => {
        const rows = new Map<string, number>();
        this.endRows().forEach((item, row) => {
            if (item) rows.set(item.id, row);
        });
        return rows;
    });

    /** Ids of each list in the order they appear on screen — what the arrow keys walk. */
    private readonly visualIds = computed<Record<FieldMapperSide, readonly string[]>>(() => ({
        start: this.startVisible().map(item => item.id),
        end: this.endRows().flatMap(item => (item ? [item.id] : [])),
    }));

    /** Each list's 1-based on-screen position of every item, for `aria-posinset`. */
    private readonly positions = computed<Record<FieldMapperSide, ReadonlyMap<string, number>>>(() => {
        const ids = this.visualIds();
        return {
            start: new Map(ids.start.map((id, index) => [id, index + 1])),
            end: new Map(ids.end.map((id, index) => [id, index + 1])),
        };
    });

    /** The one item of each list that Tab reaches: the last one focused while it is visible, else the first. */
    private readonly tabStops = computed<Record<FieldMapperSide, string>>(() => {
        const active = this.activeId();
        const positions = this.positions();
        const ids = this.visualIds();
        const stop = (side: FieldMapperSide): string => {
            const id = active[side];
            return id !== null && positions[side].has(id) ? id : (ids[side].at(0) ?? '');
        };
        return { start: stop('start'), end: stop('end') };
    });

    /** Links grouped by the item they touch, so per-item lookups stay O(1) on long lists. */
    private readonly linkIndex = computed(() => {
        const index = new Map<string, FieldMapperLink[]>();
        const add = (key: string, link: FieldMapperLink): void => {
            const list = index.get(key);
            if (list) list.push(link);
            else index.set(key, [link]);
        };
        for (const link of this.links()) {
            add(handleKey('start', link.startId), link);
            add(handleKey('end', link.endId), link);
        }
        return index;
    });

    protected readonly rowCount = computed(() => Math.max(this.startVisible().length, this.endRows().length));

    /** Per side, how many items the filter hides that are linked to a visible item. */
    readonly hiddenLinked = computed<Record<FieldMapperSide, number>>(() => {
        const startShown = new Set(this.startVisible().map(item => item.id));
        const endShown = new Set(this.endVisible().map(item => item.id));
        const hiddenStart = new Set<string>();
        const hiddenEnd = new Set<string>();
        for (const link of this.links()) {
            const startIn = startShown.has(link.startId);
            const endIn = endShown.has(link.endId);
            if (startIn && !endIn && this.endById().has(link.endId)) hiddenEnd.add(link.endId);
            if (endIn && !startIn && this.startById().has(link.startId)) hiddenStart.add(link.startId);
        }
        return { start: hiddenStart.size, end: hiddenEnd.size };
    });

    protected readonly classes = computed(() =>
        cn('flex w-full min-w-0 flex-col gap-2 text-sm', this.class()),
    );

    private readonly flip = createFlip(() => this.endItemElements());
    private animating = false;
    private frameHandle = 0;
    private drag: DragState | null = null;
    private stopDrag: (() => void) | null = null;
    private autoScroll: AutoScrollController | null = null;
    private suppressClick = false;
    private liveToggle = false;

    constructor() {
        const destroyRef = inject(DestroyRef);
        const observer = createResizeObserver(() => this.onResize());

        afterNextRender(() => {
            observer?.observe(this.root().nativeElement);
            this.onResize();
        });

        effect(onCleanup => {
            const grid = this.grid()?.nativeElement;
            if (!grid || !observer) return;
            observer.observe(grid);
            onCleanup(() => observer.unobserve(grid));
        });

        effect(() => {
            this.endRows();
            this.links();
            this.narrow();
            this.hiddenLinked();
            this.linkLabelTemplate();
            this.linkTone();
            untracked(() => this.scheduleMeasure());
        });

        destroyRef.onDestroy(() => {
            observer?.disconnect();
            this.endDrag();
            if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
        });
    }

    // ---- reading the model -------------------------------------------------

    /** The label of an item, or its id when the item is not in the list. */
    labelOf(side: FieldMapperSide, id: string): string {
        const items = side === 'start' ? this.startById() : this.endById();
        return items.get(id)?.label ?? id;
    }

    /** Links that touch an item. */
    linksOf(side: FieldMapperSide, id: string): readonly FieldMapperLink[] {
        return this.linkIndex().get(handleKey(side, id)) ?? [];
    }

    protected partnerIds(side: FieldMapperSide, id: string): readonly string[] {
        return this.linksOf(side, id).map(link => (side === 'start' ? link.endId : link.startId));
    }

    /** A start item's partner in the single-link picker, or `''` for "not linked". */
    protected partnerOf(startId: string): string {
        return this.partnerIds('start', startId).at(0) ?? '';
    }

    protected isLinked(side: FieldMapperSide, id: string): boolean {
        return this.linksOf(side, id).length > 0;
    }

    /** Accessible name of an item: its label and what it is linked to. */
    protected itemName(side: FieldMapperSide, item: FieldMapperItem): string {
        const partners = this.partnerIds(side, item.id).map(id => this.labelOf(otherSide(side), id));
        const state = partners.length > 0 ? this.t().linkedTo(partners.join(', ')) : this.t().notLinked;
        return `${item.label}, ${state}`;
    }

    protected itemContext(side: FieldMapperSide, item: FieldMapperItem): FieldMapperItemContext {
        return { $implicit: item, side, linked: this.isLinked(side, item.id) };
    }

    protected labelContext(link: FieldMapperLink): FieldMapperLinkLabelContext | null {
        const start = this.startById().get(link.startId);
        const end = this.endById().get(link.endId);
        return start && end ? { $implicit: link, start, end } : null;
    }

    protected itemState(side: FieldMapperSide, id: string): string | null {
        const pending = this.pending();
        if (pending?.side === side && pending.id === id) return 'choosing';
        const dragging = this.dragging();
        if (dragging?.side === side && dragging.id === id) return 'dragging';
        return null;
    }

    protected isSelectedLink(link: FieldMapperLink): boolean {
        const selected = this.selectedLink();
        return selected !== null && sameLink(selected, link);
    }

    protected endRow(id: string): number {
        return (this.endRowById().get(id) ?? 0) + HEADER_ROWS + 1;
    }

    protected endPosition(id: string): number {
        return this.positions().end.get(id) ?? 0;
    }

    protected tabIndexOf(side: FieldMapperSide, id: string): number {
        return this.tabStops()[side] === id ? 0 : -1;
    }

    protected unlinkedEnds(startId: string): readonly FieldMapperItem[] {
        const taken = new Set(this.partnerIds('start', startId));
        return this.end().filter(item => !taken.has(item.id));
    }

    // ---- changing the model ------------------------------------------------

    /** Links two items, moving older links out where `maxLinks` requires. */
    link(startId: string, endId: string): void {
        const start = this.startById().get(startId);
        const end = this.endById().get(endId);
        if (!start || !end || start.disabled || end.disabled) return;
        this.commit(addLink(this.links(), { startId, endId }, this.limits()));
    }

    /** Removes one link. */
    unlink(link: FieldMapperLink): void {
        this.commit(removeLinks(this.links(), candidate => sameLink(candidate, link)));
    }

    /** Removes every link of one item. */
    unlinkItem(side: FieldMapperSide, id: string): void {
        this.commit(removeLinks(this.links(), link => (side === 'start' ? link.startId : link.endId) === id));
    }

    private commit(change: FieldMapperLinkChange): void {
        if (change.added === null && change.removed.length === 0) return;
        const animate = this.align() && !this.narrow() && this.grid() !== undefined;
        if (animate) this.flip.measure();

        this.links.set(change.links);
        const selected = this.selectedLink();
        if (selected && change.removed.some(link => sameLink(link, selected))) this.setSelectedLink(null);
        this.announce(this.describe(change));

        if (animate) afterNextRender(() => this.playRealign(), { injector: this.injector });
    }

    private describe(change: FieldMapperLinkChange): string {
        const t = this.t();
        const parts = change.added
            ? [t.linked(this.labelOf('start', change.added.startId), this.labelOf('end', change.added.endId))]
            : [];
        for (const link of change.removed) {
            parts.push(t.unlinked(this.labelOf('start', link.startId), this.labelOf('end', link.endId)));
        }
        return parts.join('. ');
    }

    private announce(message: string): void {
        // A trailing no-break space that alternates makes a repeated message a
        // text change, so a screen reader reads it again.
        this.liveToggle = !this.liveToggle;
        this.liveMessage.set(this.liveToggle ? message : `${message}${NO_BREAK_SPACE}`);
    }

    // ---- picking: tap, click, Enter ---------------------------------------

    /**
     * The tap / Enter path. The first pick marks an item as choosing; a pick in
     * the other list links the two; picking the chosen item again cancels.
     */
    pick(side: FieldMapperSide, item: FieldMapperItem): void {
        if (item.disabled) return;
        const pending = this.pending();
        if (pending === null || pending.side === side) {
            this.choose(side, item, pending);
            return;
        }
        this.pending.set(null);
        if (side === 'end') this.link(pending.id, item.id);
        else this.link(item.id, pending.id);
    }

    private choose(side: FieldMapperSide, item: FieldMapperItem, pending: PickedItem | null): void {
        if (pending?.id === item.id) {
            this.cancel();
            return;
        }
        this.pending.set({ side, id: item.id });
        const otherList = side === 'start' ? this.endHeadingText() : this.startHeadingText();
        this.announce(this.t().choosing(item.label, otherList));
    }

    /** Drops a pending pick and any selected line. */
    cancel(): void {
        if (this.pending() === null && this.selectedLink() === null) return;
        this.pending.set(null);
        if (this.selectedLink()) this.setSelectedLink(null);
        this.announce(this.t().cancelled);
    }

    protected onItemClick(side: FieldMapperSide, item: FieldMapperItem): void {
        if (this.suppressClick) return;
        this.setActive(side, item.id);
        this.pick(side, item);
    }

    // ---- selecting a line ---------------------------------------------------

    /** Selects a line (or clears the selection with `null`), emits `linkSelect` and announces it. */
    selectLink(link: FieldMapperLink | null): void {
        this.setSelectedLink(link);
        this.announce(
            link
                ? this.t().linkSelected(this.labelOf('start', link.startId), this.labelOf('end', link.endId))
                : this.t().cancelled,
        );
    }

    private setSelectedLink(link: FieldMapperLink | null): void {
        this.selectedLink.set(link);
        this.linkSelect.emit(link);
    }

    protected onLineClick(link: FieldMapperLink): void {
        this.selectLink(this.isSelectedLink(link) ? null : link);
    }

    private cycleLinkSelection(side: FieldMapperSide, id: string): void {
        const own = this.linksOf(side, id);
        if (own.length === 0) return;
        const selected = this.selectedLink();
        const index = selected ? own.findIndex(link => sameLink(link, selected)) : -1;
        this.selectLink(own[(index + 1) % own.length]);
    }

    protected removeSelected(): void {
        const selected = this.selectedLink();
        if (selected) this.unlink(selected);
    }

    // ---- keyboard ---------------------------------------------------------

    protected onItemKeydown(event: KeyboardEvent, side: FieldMapperSide, item: FieldMapperItem): void {
        const next = navigate(this.visualIds()[side], item.id, event.key);
        if (next !== null) {
            event.preventDefault();
            this.focusItem(side, next);
            return;
        }
        if (this.handleCommandKey(event.key, side, item)) event.preventDefault();
    }

    /** Runs the non-navigation key bindings; returns whether the key was used. */
    private handleCommandKey(key: string, side: FieldMapperSide, item: FieldMapperItem): boolean {
        switch (key) {
            case 'Enter':
            case ' ':
                this.pick(side, item);
                return true;
            case 'Delete':
            case 'Backspace':
                this.removeFromItem(side, item.id);
                return true;
            case 'Escape':
                this.cancel();
                return true;
            default:
                if (key !== this.keyTowardGutter(side)) return false;
                this.cycleLinkSelection(side, item.id);
                return true;
        }
    }

    /** The arrow key that points from a list toward the other one, which mirrors in RTL. */
    private keyTowardGutter(side: FieldMapperSide): string {
        const startOnLeft = !isRtl(this.root().nativeElement);
        return (side === 'start') === startOnLeft ? 'ArrowRight' : 'ArrowLeft';
    }

    /** Delete on an item: the selected line if it is this item's, otherwise all of its links. */
    private removeFromItem(side: FieldMapperSide, id: string): void {
        const selected = this.selectedLink();
        if (selected && this.linksOf(side, id).some(link => sameLink(link, selected))) this.unlink(selected);
        else this.unlinkItem(side, id);
    }

    protected setActive(side: FieldMapperSide, id: string): void {
        if (this.activeId()[side] === id) return;
        this.activeId.update(current => ({ ...current, [side]: id }));
    }

    private focusItem(side: FieldMapperSide, id: string): void {
        const previous = this.itemElement(side, this.tabStops()[side]);
        const next = this.itemElement(side, id);
        this.setActive(side, id);
        // Move the tab stop now, not at the next render: a Tab pressed before
        // then would otherwise land on the stale stop in this same list.
        previous?.setAttribute('tabindex', '-1');
        next?.setAttribute('tabindex', '0');
        next?.focus();
    }

    // ---- pointer drag -------------------------------------------------------

    protected onHandlePointerDown(event: PointerEvent, side: FieldMapperSide, item: FieldMapperItem): void {
        if (item.disabled || event.button !== 0 || this.drag) return;
        this.drag = {
            side,
            id: item.id,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            clientX: event.clientX,
            clientY: event.clientY,
            moved: false,
        };
        const move = (e: PointerEvent): void => this.onDragMove(e);
        const up = (e: PointerEvent): void => this.onDrop(e);
        const cancel = (e: PointerEvent): void => this.onDragCancel(e);
        const doc = this.root().nativeElement.ownerDocument;
        doc.addEventListener('pointermove', move);
        doc.addEventListener('pointerup', up);
        doc.addEventListener('pointercancel', cancel);
        this.stopDrag = () => {
            doc.removeEventListener('pointermove', move);
            doc.removeEventListener('pointerup', up);
            doc.removeEventListener('pointercancel', cancel);
        };
    }

    private onDragMove(event: PointerEvent): void {
        const drag = this.drag;
        if (drag?.pointerId !== event.pointerId) return;
        drag.clientX = event.clientX;
        drag.clientY = event.clientY;
        if (!drag.moved) {
            if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
            drag.moved = true;
            this.pending.set(null);
            this.dragging.set({ side: drag.side, id: drag.id });
            this.autoScroll = startAutoScroll();
        }
        event.preventDefault();
        this.autoScroll?.update(event.clientX, event.clientY);
        this.scheduleMeasure();
    }

    private onDragCancel(event: PointerEvent): void {
        if (this.drag?.pointerId === event.pointerId) this.endDrag();
    }

    private onDrop(event: PointerEvent): void {
        const drag = this.drag;
        if (drag?.pointerId !== event.pointerId) return;
        this.endDrag();
        if (!drag.moved) return;
        // The click that follows a drag lands on whatever the pointer was
        // released over; it must not count as a tap.
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false));
        const target = this.dropTarget(event.clientX, event.clientY, drag.side);
        if (!target) return;
        if (drag.side === 'start') this.link(drag.id, target);
        else this.link(target, drag.id);
    }

    private endDrag(): void {
        this.stopDrag?.();
        this.stopDrag = null;
        this.autoScroll?.stop();
        this.autoScroll = null;
        this.drag = null;
        if (this.dragging() !== null) this.dragging.set(null);
        this.scheduleMeasure();
    }

    /** Id of the item of the other list under the pointer, if any. */
    private dropTarget(x: number, y: number, from: FieldMapperSide): string | null {
        const hit = this.root().nativeElement.ownerDocument.elementFromPoint(x, y);
        const item = hit?.closest<HTMLElement>('[data-slot="field-mapper-item"]');
        if (!item || !this.grid()?.nativeElement.contains(item)) return null;
        if (item.dataset['side'] === from || item.getAttribute('aria-disabled') === 'true') return null;
        return item.dataset['id'] ?? null;
    }

    // ---- narrow layout ------------------------------------------------------

    protected onPartnerPicked(startId: string, endId: string): void {
        if (endId === '') this.unlinkItem('start', startId);
        else this.link(startId, endId);
    }

    // ---- geometry -----------------------------------------------------------

    private onResize(): void {
        const root = this.root().nativeElement;
        const rem = Number.parseFloat(getComputedStyle(root.ownerDocument.documentElement).fontSize) || 16;
        const narrow = root.getBoundingClientRect().width < NARROW_BELOW_REM * rem;
        if (narrow !== this.measuredNarrow()) {
            this.pending.set(null);
            this.measuredNarrow.set(narrow);
        }
        this.scheduleMeasure();
    }

    protected onScroll(): void {
        if (this.drag?.moved) this.scheduleMeasure();
    }

    /** Batches every reason to re-measure into one frame. */
    private scheduleMeasure(): void {
        if (this.frameHandle || typeof requestAnimationFrame !== 'function') return;
        this.frameHandle = requestAnimationFrame(() => {
            this.frameHandle = 0;
            this.measure();
            if (this.animating) this.scheduleMeasure();
        });
    }

    /** Animates the end list into its new order, redrawing the lines every frame while it moves. */
    private playRealign(): void {
        this.animating = true;
        this.scheduleMeasure();
        this.flip.play(REALIGN_MS).then(() => {
            this.animating = false;
            this.scheduleMeasure();
        });
    }

    private measure(): void {
        const grid = this.grid()?.nativeElement;
        if (!grid || this.narrow()) {
            this.geometry.set(EMPTY_GEOMETRY);
            return;
        }
        const frame = this.readFrame(grid);
        const tone = this.linkTone();
        const lines: FieldMapperLine[] = [];
        for (const link of this.links()) {
            const line = this.lineFor(link, frame, tone?.(link) ?? 'default');
            if (line) lines.push(line);
        }
        const { start, end } = frame.columns;
        this.geometry.set({
            width: grid.scrollWidth,
            height: grid.scrollHeight,
            gutter: start && end ? Math.max(0, Math.max(start.left, end.left) - Math.min(start.right, end.right)) : 0,
            lines,
            rubberBand: this.rubberBand(frame),
        });
    }

    private readFrame(grid: HTMLElement): Frame {
        const origin = grid.getBoundingClientRect();
        const handles = new Map<string, Point>();
        for (const handle of grid.querySelectorAll<HTMLElement>('[data-slot="field-mapper-handle"]')) {
            const { side, id } = handle.dataset;
            if (side && id !== undefined) handles.set(handleKey(side as FieldMapperSide, id), centerOf(handle.getBoundingClientRect(), origin));
        }
        const column = (side: FieldMapperSide): DOMRect | null =>
            grid.querySelector(`[data-slot="field-mapper-heading"][data-side="${side}"]`)?.getBoundingClientRect() ?? null;
        const note = (side: FieldMapperSide): number | null => {
            const el = grid.querySelector(`[data-slot="field-mapper-hidden-note"][data-side="${side}"]`);
            return el ? centerOf(el.getBoundingClientRect(), origin).y : null;
        };
        return {
            origin,
            handles,
            columns: { start: column('start'), end: column('end') },
            notes: { start: note('start'), end: note('end') },
        };
    }

    private lineFor(link: FieldMapperLink, frame: Frame, tone: FieldMapperLinkTone): FieldMapperLine | null {
        const from = frame.handles.get(handleKey('start', link.startId)) ?? null;
        const to = frame.handles.get(handleKey('end', link.endId)) ?? null;
        if (from && to) return this.makeLine(link, from, to, tone, false);
        if (from && this.endById().has(link.endId)) {
            return this.makeLine(link, from, this.edgePoint(frame, 'end', from), tone, true);
        }
        if (to && this.startById().has(link.startId)) {
            return this.makeLine(link, this.edgePoint(frame, 'start', to), to, tone, true);
        }
        return null;
    }

    /** Where a line to a filtered-out item on `side` ends: that list's inner edge, beside its note. */
    private edgePoint(frame: Frame, side: FieldMapperSide, from: Point): Point {
        const column = frame.columns[side];
        const x = column ? nearestEdge(column, frame.origin, from.x) : from.x;
        return { x, y: frame.notes[side] ?? frame.origin.height };
    }

    private makeLine(link: FieldMapperLink, from: Point, to: Point, tone: FieldMapperLinkTone, toEdge: boolean): FieldMapperLine {
        return {
            key: handleKey('start', link.startId) + handleKey('end', link.endId),
            link,
            path: linkPath(from.x, from.y, to.x, to.y),
            midX: (from.x + to.x) / 2,
            midY: (from.y + to.y) / 2,
            tone,
            toEdge,
        };
    }

    private rubberBand(frame: Frame): string | null {
        const drag = this.drag;
        if (!drag?.moved) return null;
        const from = frame.handles.get(handleKey(drag.side, drag.id));
        if (!from) return null;
        const x = drag.clientX - frame.origin.left;
        const y = drag.clientY - frame.origin.top;
        return drag.side === 'start' ? linkPath(from.x, from.y, x, y) : linkPath(x, y, from.x, from.y);
    }

    private itemElement(side: FieldMapperSide, id: string): HTMLElement | null {
        const grid = this.grid()?.nativeElement;
        if (!grid) return null;
        for (const el of grid.querySelectorAll<HTMLElement>(`[data-slot="field-mapper-item"][data-side="${side}"]`)) {
            if (el.dataset['id'] === id) return el;
        }
        return null;
    }

    private endItemElements(): HTMLElement[] {
        const grid = this.grid()?.nativeElement;
        return grid ? Array.from(grid.querySelectorAll<HTMLElement>('[data-slot="field-mapper-item"][data-side="end"]')) : [];
    }
}
