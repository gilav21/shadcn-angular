import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
    SortableHandleDirective,
    SORTABLE_LAND_EFFECTS,
    type SortableReorderEvent,
    type SortableDropRejectedEvent,
} from './sortable.component';
import { provideUiLocale } from '../../lib/i18n';
import type { SortableLocale } from './sortable-locales';
import { SortableGhostTemplateDirective } from './sub/sortable-ghost.directive';
import { SortablePlaceholderTemplateDirective } from './sub/sortable-placeholder.directive';
import { peersInGroup, groupSize, clearRegistry } from '../../lib/sortable-registry';

interface TestRow {
    id: number;
    name: string;
}

@Component({
    selector: 'app-test-host',
    standalone: true,
    imports: [
        SortableComponent,
        SortableItemComponent,
        SortableItemTemplateDirective,
        SortableHandleDirective,
    ],
    template: `
        <ui-sortable
            [(items)]="rows"
            [orientation]="orientation()"
            [handleOnly]="handleOnly()"
            [disabled]="disabled()"
            [class]="extraClass()"
            (reorder)="lastReorder = $event"
        >
            <ng-template uiSortableItem let-row let-i="index">
                <ui-sortable-item [index]="i">
                    <span uiSortableHandle class="handle">⠿</span>
                    <span class="name">{{ $any(row).name }}</span>
                </ui-sortable-item>
            </ng-template>
        </ui-sortable>
    `,
})
class TestHostComponent {
    readonly rows = signal<TestRow[]>([
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
        { id: 3, name: 'Gamma' },
    ]);
    readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
    readonly handleOnly = signal(false);
    readonly disabled = signal(false);
    readonly extraClass = signal('');
    lastReorder: import('./sortable.types').SortableReorderEvent<TestRow> | null = null;
}

function getSortable<T>(fixture: ComponentFixture<TestHostComponent>): SortableComponent<T> {
    return fixture.debugElement
        .query(el => el.componentInstance instanceof SortableComponent)
        ?.componentInstance as SortableComponent<T>;
}

/*
 * ---------------------------------------------------------------------------
 * jsdom drag/layout stubs
 * ---------------------------------------------------------------------------
 * jsdom performs no layout, has no Web Animations API, and no matchMedia. The
 * sortable's pointer-drag math reads getBoundingClientRect(); FLIP + land
 * effects call element.animate(); reduced-motion checks call matchMedia(). We
 * install deterministic stubs so index math is stable: every list is a
 * 200px-wide column, list N sits at x = N * 300, and item I sits at y = I * 40.
 * Originals are saved in beforeAll and restored in afterAll.
 */
const STUB_ITEM_H = 40;
const STUB_LIST_W = 200;
const STUB_LIST_H = 1000;
const STUB_LIST_GAP = 300;

function stubRect(x: number, y: number, w: number, h: number): DOMRect {
    return {
        x, y, width: w, height: h,
        top: y, left: x, right: x + w, bottom: y + h,
        toJSON(): unknown { return {}; },
    } as DOMRect;
}

function listOffsetLeft(container: Element): number {
    const all = Array.from(container.ownerDocument.querySelectorAll('[data-slot="sortable"]'));
    return Math.max(0, all.indexOf(container)) * STUB_LIST_GAP;
}

function deterministicRect(el: Element): DOMRect | null {
    const slot = (el as HTMLElement).dataset?.slot;
    if (slot === 'sortable-item') {
        const container = el.closest('[data-slot="sortable"]');
        if (!container) return stubRect(0, 0, STUB_LIST_W, STUB_ITEM_H);
        const items = Array.from(container.querySelectorAll('[data-slot="sortable-item"]'));
        const idx = Math.max(0, items.indexOf(el));
        return stubRect(listOffsetLeft(container), idx * STUB_ITEM_H, STUB_LIST_W, STUB_ITEM_H);
    }
    if (slot === 'sortable') {
        return stubRect(listOffsetLeft(el), 0, STUB_LIST_W, STUB_LIST_H);
    }
    return null;
}

interface FakeAnimation {
    finished: Promise<void>;
    cancel(): void;
}

type ElementProtoStub = {
    getBoundingClientRect: (this: Element) => DOMRect;
    animate?: (...args: unknown[]) => FakeAnimation;
};
type WindowStub = { matchMedia?: (query: string) => unknown };

let savedGetRect: ((this: Element) => DOMRect) | null = null;
let hadAnimate = false;
let savedAnimate: ((...args: unknown[]) => FakeAnimation) | undefined;
let hadMatchMedia = false;
let savedMatchMedia: ((query: string) => unknown) | undefined;

function installDomStubs(): void {
    const elProto = Element.prototype as unknown as ElementProtoStub;
    savedGetRect = elProto.getBoundingClientRect;
    elProto.getBoundingClientRect = function (this: Element): DOMRect {
        return deterministicRect(this) ?? (savedGetRect as (this: Element) => DOMRect).call(this);
    };

    const htmlProto = HTMLElement.prototype as unknown as ElementProtoStub;
    hadAnimate = 'animate' in HTMLElement.prototype;
    savedAnimate = htmlProto.animate;
    htmlProto.animate = (): FakeAnimation => ({ finished: Promise.resolve(), cancel(): void {} });

    const win = globalThis.window as unknown as WindowStub;
    hadMatchMedia = 'matchMedia' in globalThis.window;
    savedMatchMedia = win.matchMedia;
    win.matchMedia = (query: string) => ({
        matches: false, media: query, onchange: null,
        addEventListener(): void {}, removeEventListener(): void {},
        addListener(): void {}, removeListener(): void {},
        dispatchEvent(): boolean { return false; },
    });
}

function restoreDomStubs(): void {
    const elProto = Element.prototype as unknown as ElementProtoStub;
    if (savedGetRect) elProto.getBoundingClientRect = savedGetRect;

    const htmlProto = HTMLElement.prototype as unknown as ElementProtoStub;
    if (hadAnimate) htmlProto.animate = savedAnimate;
    else delete htmlProto.animate;

    const win = globalThis.window as unknown as WindowStub;
    if (hadMatchMedia) win.matchMedia = savedMatchMedia;
    else delete win.matchMedia;
}

/** Build a touch-like event carrying a `touches` array jsdom otherwise lacks. */
function makeTouchEvent(type: string, clientX: number, clientY: number): TouchEvent {
    const evt = new Event(type, { bubbles: true, cancelable: true });
    const point = { clientX, clientY };
    Object.assign(evt, { touches: [point], changedTouches: [point] });
    return evt as unknown as TouchEvent;
}

beforeAll(() => {
    installDomStubs();
});

afterAll(() => {
    restoreDomStubs();
});

describe('SortableComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(host).toBeTruthy();
    });

    it('should render the container with data-slot="sortable"', () => {
        const el: HTMLElement = fixture.nativeElement.querySelector('[data-slot="sortable"]');
        expect(el).toBeTruthy();
    });

    it('should render one item per entry in items()', () => {
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(items).toHaveLength(3);
    });

    it('should render data-slot="sortable-item" on each row', () => {
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items.forEach(item => expect(item.getAttribute('data-slot')).toBe('sortable-item'));
    });

    it('should apply custom class to the sortable container', () => {
        host.extraClass.set('my-custom');
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement.querySelector('[data-slot="sortable"]');
        expect(el.className).toContain('my-custom');
    });

    it('should render item names from the projected template', () => {
        const names: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.name');
        const texts = Array.from(names).map(n => n.textContent?.trim());
        expect(texts).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('should update items() and emit reorder on keyboard move (Space + ArrowDown)', () => {
        const sortable = getSortable<TestRow>(fixture);
        expect(sortable).toBeTruthy();

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');
        expect(host.rows()[1].name).toBe('Alpha');
        expect(host.lastReorder?.from.index).toBe(0);
        expect(host.lastReorder?.to.index).toBe(1);
        expect(host.lastReorder?.from.listId).toBe(host.lastReorder?.to.listId);
        expect(host.lastReorder?.item).toBeTruthy();
    });

    it('should not reorder when disabled', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);
        const before = host.rows().map(r => r.name);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();

        expect(host.rows().map(r => r.name)).toEqual(before);
        expect(host.lastReorder).toBeNull();
    });

    it('should cancel keyboard drag on Escape and restore original order', () => {
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');

        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Alpha');
        expect(host.rows()[1].name).toBe('Beta');
        expect(host.rows()[2].name).toBe('Gamma');
    });

    it('should move item up on ArrowUp in vertical orientation', () => {
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        fixture.detectChanges();

        expect(host.rows()[1].name).toBe('Gamma');
        expect(host.rows()[2].name).toBe('Beta');
        expect(host.lastReorder?.from.index).toBe(2);
        expect(host.lastReorder?.to.index).toBe(1);
    });

    it('should use ArrowRight to move item in horizontal orientation', () => {
        host.orientation.set('horizontal');
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');
        expect(host.rows()[1].name).toBe('Alpha');
    });

    it('should use ArrowLeft to move item back in horizontal orientation', () => {
        host.orientation.set('horizontal');
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');
        expect(host.rows()[1].name).toBe('Alpha');
    });

    it('handleOnly prevents item body from starting drag', () => {
        host.handleOnly.set(true);
        fixture.detectChanges();

        const itemComps = fixture.debugElement
            .queryAll(el => el.componentInstance instanceof SortableItemComponent);
        const firstItem = itemComps[0]?.componentInstance as SortableItemComponent;

        const sortable = getSortable<TestRow>(fixture);

        firstItem.onMouseDown(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
        expect(sortable.dragSource()).toBeNull();
    });

    it('startDrag respects disabled flag', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);
        sortable.startDrag(0, 0, 0);
        expect(sortable.dragSource()).toBeNull();
    });

    it('orientation affects which arrow keys move items', () => {
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Alpha');
        expect(host.lastReorder).toBeNull();
    });

    it('should reorder via real keydown DOM events dispatched on the item element', () => {
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');
        expect(host.rows()[1].name).toBe('Alpha');
        expect(host.lastReorder?.from.index).toBe(0);
        expect(host.lastReorder?.to.index).toBe(1);
        expect(host.lastReorder?.from.listId).toBe(host.lastReorder?.to.listId);
        expect(host.lastReorder?.item).toBeTruthy();
    });

    it('should start a drag on mousedown and clean up on mouseup via the DOM wiring', () => {
        const sortable = getSortable<TestRow>(fixture);
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 5, bubbles: true }));
        expect(sortable.dragSource()).toBe(0);

        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 40 }));
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 40 }));
        fixture.detectChanges();

        expect(sortable.dragSource()).toBeNull();
    });

    it('should not start a drag on mousedown when disabled', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 5, bubbles: true }));

        expect(sortable.dragSource()).toBeNull();
    });

    function flushTimers(): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    function attachAndSizeFixture(): void {
        document.body.appendChild(fixture.nativeElement);
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        for (const item of Array.from(items)) {
            item.style.display = 'block';
            item.style.height = '40px';
            item.style.width = '200px';
        }
        fixture.detectChanges();
    }

    function detachFixture(): void {
        if (fixture.nativeElement.parentNode === document.body) {
            document.body.removeChild(fixture.nativeElement);
        }
    }

    it('animates sibling items via element.animate() after a keyboard reorder', async () => {
        attachAndSizeFixture();
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();
        await flushTimers();
        fixture.detectChanges();

        expect(animateSpy).toHaveBeenCalled();
        animateSpy.mockRestore();
        detachFixture();
    });

    it('projects uiSortableHeader content above the items', () => {
        @Component({
            selector: 'app-slot-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <div uiSortableHeader data-testid="header">HEADER</div>
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">
                            <span class="name">{{ $any(row).name }}</span>
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class SlotHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
        }
        const f = TestBed.createComponent(SlotHost);
        f.detectChanges();
        const header: HTMLElement | null = f.nativeElement.querySelector('[data-testid="header"]');
        expect(header).not.toBeNull();
        expect(header?.textContent).toBe('HEADER');
    });

    it('projects uiSortableFooter content below the items', () => {
        @Component({
            selector: 'app-footer-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                    <div uiSortableFooter data-testid="footer">FOOTER</div>
                </ui-sortable>
            `,
        })
        class FooterHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        const f = TestBed.createComponent(FooterHost);
        f.detectChanges();
        const footer: HTMLElement | null = f.nativeElement.querySelector('[data-testid="footer"]');
        expect(footer).not.toBeNull();
    });

    it('projects uiSortableEmpty only when items is empty', () => {
        @Component({
            selector: 'app-empty-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <div uiSortableEmpty data-testid="empty">No items</div>
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class EmptyHost {
            readonly rows = signal<TestRow[]>([]);
        }
        const f = TestBed.createComponent(EmptyHost);
        f.detectChanges();
        expect(f.nativeElement.querySelector('[data-testid="empty"]')).not.toBeNull();

        f.componentInstance.rows.set([{ id: 1, name: 'A' }]);
        f.detectChanges();
        expect(f.nativeElement.querySelector('[data-testid="empty"]')).toBeNull();
    });

    it('renders a default translucent ghost (item preview at opacity-60) at the projected drop position', () => {
        attachAndSizeFixture();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        items[2].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 95, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 10 }));
        fixture.detectChanges();

        const ghost: HTMLElement | null = fixture.nativeElement.querySelector('[data-slot="sortable-ghost"]');
        expect(ghost).not.toBeNull();
        expect(ghost?.className).toContain('opacity-60');
        expect(ghost?.className).toContain('ui-sortable-ghost-fade');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 10 }));
        detachFixture();
    });

    it('uses a custom uiSortableGhost template when provided, instead of the default ghost', () => {
        @Component({
            selector: 'app-ghost-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                SortableGhostTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                    <ng-template uiSortableGhost let-row>
                        <div data-testid="custom-ghost">Drop: {{ $any(row).name }}</div>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class GhostHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
                { id: 3, name: 'C' },
            ]);
        }
        const f = TestBed.createComponent(GhostHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[2].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 95, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 10 }));
        f.detectChanges();

        const custom: HTMLElement | null = f.nativeElement.querySelector('[data-testid="custom-ghost"]');
        const defaultGhost: HTMLElement | null = f.nativeElement.querySelector('[data-slot="sortable-ghost"]');
        expect(custom).not.toBeNull();
        expect(custom?.textContent).toContain('C');
        expect(defaultGhost).toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 10 }));
        document.body.removeChild(f.nativeElement);
    });

    it('renders a default placeholder at the lift origin while dragging', () => {
        attachAndSizeFixture();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 10, bubbles: true }));
        fixture.detectChanges();

        const placeholder: HTMLElement | null = document.querySelector('[data-slot="sortable-placeholder"]');
        expect(placeholder).not.toBeNull();
        expect(placeholder?.className).toContain('border-dashed');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 10 }));
        fixture.detectChanges();
        expect(document.querySelector('[data-slot="sortable-placeholder"]')).toBeNull();
        detachFixture();
    });

    it('uses a custom uiSortablePlaceholder template when provided', () => {
        @Component({
            selector: 'app-placeholder-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                SortablePlaceholderTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                    <ng-template uiSortablePlaceholder let-row>
                        <div data-testid="custom-placeholder">Was here: {{ $any(row).name }}</div>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class PlaceholderHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
                { id: 3, name: 'C' },
            ]);
        }
        const f = TestBed.createComponent(PlaceholderHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[1].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 50, bubbles: true }));
        f.detectChanges();

        const custom: HTMLElement | null = document.querySelector('[data-testid="custom-placeholder"]');
        const defaultPlaceholder: HTMLElement | null = document.querySelector('[data-slot="sortable-placeholder"]');
        expect(custom).not.toBeNull();
        expect(custom?.textContent).toContain('B');
        expect(defaultPlaceholder).toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 50 }));
        document.body.removeChild(f.nativeElement);
    });

    it('applies lift effect (scale + rotate + shadow + z-50) to the source while dragging', () => {
        attachAndSizeFixture();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        const sourceEl = items[0];
        sourceEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 30 }));
        fixture.detectChanges();

        expect(sourceEl.className).toContain('z-50');
        expect(sourceEl.className).toContain('shadow-2xl');
        const transform = sourceEl.style.transform;
        expect(transform).toContain('translate');
        expect(transform).toContain('scale(1.02)');
        expect(transform).toContain('rotate(1.5deg)');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 30 }));
        detachFixture();
    });

    it('shows cursor-grab on body-draggable items, hides it when handleOnly is set', () => {
        const sortable = getSortable<TestRow>(fixture);
        expect(sortable).toBeTruthy();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(items[0].className).toContain('cursor-grab');

        host.handleOnly.set(true);
        fixture.detectChanges();
        const itemsAfter: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(itemsAfter[0].className).not.toContain('cursor-grab');
    });

    it('exports SORTABLE_LAND_EFFECTS with the four built-in class names', () => {
        expect(SORTABLE_LAND_EFFECTS.flash).toBe('ui-sortable-land-flash');
        expect(SORTABLE_LAND_EFFECTS.pulse).toBe('ui-sortable-land-pulse');
        expect(SORTABLE_LAND_EFFECTS.shake).toBe('ui-sortable-land-shake');
        expect(SORTABLE_LAND_EFFECTS.glow).toBe('ui-sortable-land-glow');
    });

    it('SORTABLE_LAND_EFFECTS is readonly (frozen-shape const)', () => {
        const keys = Object.keys(SORTABLE_LAND_EFFECTS).sort((a, b) => a.localeCompare(b));
        expect(keys).toEqual(['flash', 'glow', 'pulse', 'shake']);
    });

    it('applies positionClass to each item wrapper, re-evaluating on reorder', () => {
        @Component({
            selector: 'app-pos-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows" [positionClass]="posFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class PosHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
                { id: 3, name: 'C' },
            ]);
            readonly posFn = (_item: TestRow, i: number, total: number): string => {
                if (i === 0) { return 'pos-first'; }
                if (i === total - 1) { return 'pos-last'; }
                return 'pos-middle';
            };
        }
        const f = TestBed.createComponent(PosHost);
        f.detectChanges();

        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(items[0].className).toContain('pos-first');
        expect(items[1].className).toContain('pos-middle');
        expect(items[2].className).toContain('pos-last');

        f.componentInstance.rows.update((rs) => [rs[2], rs[0], rs[1]]);
        f.detectChanges();

        const reorderedItems: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(reorderedItems[0].textContent?.trim()).toBe('C');
        expect(reorderedItems[0].className).toContain('pos-first');
        expect(reorderedItems[2].textContent?.trim()).toBe('B');
        expect(reorderedItems[2].className).toContain('pos-last');
    });

    it('adds the landEffect class transiently to the landed item after a keyboard reorder', async () => {
        @Component({
            selector: 'app-land-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows" [landEffect]="landFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class LandHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
            ]);
            readonly landFn = (): string => 'land-test-class';
        }
        const f = TestBed.createComponent(LandHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 10));
        f.detectChanges();

        const landed: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(landed?.className).toContain('land-test-class');

        await new Promise<void>(r => setTimeout(r, 800));
        f.detectChanges();
        const after: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(after?.className).not.toContain('land-test-class');

        document.body.removeChild(f.nativeElement);
    });

    it('landEffect returning null does not add any class', async () => {
        let calls = 0;
        @Component({
            selector: 'app-land-null',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows" [landEffect]="landFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class LandNullHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
            ]);
            readonly landFn = (): string | null => { calls++; return null; };
        }
        const f = TestBed.createComponent(LandNullHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 20));
        f.detectChanges();

        const item: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(item?.className ?? '').not.toMatch(/land-/);
        expect(calls).toBeGreaterThan(0);
        document.body.removeChild(f.nativeElement);
    });

    it('trackBy default returns the item itself (object identity)', () => {
        const sortable = getSortable<TestRow>(fixture);
        const trackFn = sortable.trackBy();
        const item: TestRow = { id: 99, name: 'X' };
        expect(trackFn(item, 0)).toBe(item);
    });

    it('registers with the group registry when [group] is non-empty', () => {
        clearRegistry();
        @Component({
            selector: 'app-grp-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" group="my-grp" listId="A">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class GrpHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        const f = TestBed.createComponent(GrpHost);
        f.detectChanges();
        expect(groupSize('my-grp')).toBe(1);
        const peers = peersInGroup('my-grp');
        expect(peers[0].listId).toBe('A');
        expect(peers[0].group).toBe('my-grp');
        expect(peers[0].orientation).toBe('vertical');
    });

    it('does not register when [group] is empty (the default)', () => {
        clearRegistry();
        const sortable = getSortable<TestRow>(fixture);
        expect(sortable).toBeTruthy();
        expect(groupSize('')).toBe(0);
        expect(groupSize('any')).toBe(0);
    });

    it('unregisters on destroy', () => {
        clearRegistry();
        @Component({
            selector: 'app-destroy-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" group="ephemeral">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class DestroyHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        const f = TestBed.createComponent(DestroyHost);
        f.detectChanges();
        expect(groupSize('ephemeral')).toBe(1);
        f.destroy();
        expect(groupSize('ephemeral')).toBe(0);
    });

    it('hit-tests cross-list peers and exposes hoverPeer + hoverPeerTarget', () => {
        clearRegistry();
        @Component({
            selector: 'app-cross-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable
                    [(items)]="left"
                    group="board"
                    listId="left"
                    style="display:block; position:fixed; left:0px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">L{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable
                    [(items)]="right"
                    group="board"
                    listId="right"
                    style="display:block; position:fixed; left:300px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">R{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class CrossHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly right = signal<TestRow[]>([{ id: 3, name: 'X' }, { id: 4, name: 'Y' }]);
        }

        const f = TestBed.createComponent(CrossHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        expect(peersInGroup('board')).toHaveLength(2);
        const leftS = f.debugElement.queryAll(el => el.componentInstance instanceof SortableComponent)
            .map(d => d.componentInstance as SortableComponent<TestRow>)
            .find(c => c.listId() === 'left')!;
        expect(leftS).toBeTruthy();

        const leftItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (leftItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 50 }));
        f.detectChanges();

        expect(leftS.hoverPeer()?.listId).toBe('right');
        expect(leftS.hoverPeerTarget()).not.toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
        f.detectChanges();
        expect(leftS.hoverPeer()).toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50 }));
        document.body.removeChild(f.nativeElement);
    });

    it('evaluateAccepts returns true by default', () => {
        const sortable = getSortable<TestRow>(fixture);
        expect(sortable.evaluateAccepts({ id: 1, name: 'A' }, { fromListId: 'x', toIndex: 0 })).toBe(true);
    });

    it('evaluateAccepts honors a boolean false input', () => {
        @Component({
            selector: 'app-acc-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [accepts]="false" group="acc1" listId="A">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class AccHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        const f = TestBed.createComponent(AccHost);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        expect(sortable.evaluateAccepts({ id: 99, name: 'X' }, { fromListId: 'x', toIndex: 0 })).toBe(false);
    });

    it('evaluateAccepts calls the predicate function with the right context and returns its result', () => {
        const captured: { item: TestRow; ctx: { fromListId: string; toListId: string; toIndex: number } }[] = [];
        @Component({
            selector: 'app-acc-fn-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [accepts]="acceptFn" listId="bb">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class AccFnHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
            readonly acceptFn = (item: TestRow, ctx: { fromListId: string; toListId: string; toIndex: number }): { ok: boolean; reason?: string } => {
                captured.push({ item, ctx });
                return { ok: false, reason: 'wip-limit' };
            };
        }
        const f = TestBed.createComponent(AccFnHost);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        const res = sortable.evaluateAccepts({ id: 9, name: 'Z' }, { fromListId: 'src', toIndex: 2 });

        expect(res).toEqual({ ok: false, reason: 'wip-limit' });
        expect(captured).toHaveLength(1);
        expect(captured[0].item.name).toBe('Z');
        expect(captured[0].ctx.fromListId).toBe('src');
        expect(captured[0].ctx.toListId).toBe('bb');
        expect(captured[0].ctx.toIndex).toBe(2);
    });

    it('evaluateAccepts returns disabled-rejection when [disabled]=true', () => {
        host.disabled.set(true);
        fixture.detectChanges();
        const sortable = getSortable<TestRow>(fixture);
        const res = sortable.evaluateAccepts({ id: 1, name: 'A' }, { fromListId: 'x', toIndex: 0 });
        expect(res).toEqual({ ok: false, reason: 'disabled' });
    });

    it('cross-list drop: accepted moves the item between lists and emits reorder on the source with cross-list payload', () => {
        clearRegistry();
        const state: { lastReorder: SortableReorderEvent<TestRow> | null } = { lastReorder: null };
        let entered = 0;
        let leftCount = 0;
        @Component({
            selector: 'app-cdrop-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable
                    [(items)]="left"
                    group="drop"
                    listId="L"
                    style="display:block; position:fixed; left:0px; top:0px; width:200px;"
                    (reorder)="capture($event)">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable
                    [(items)]="right"
                    group="drop"
                    listId="R"
                    style="display:block; position:fixed; left:300px; top:0px; width:200px;"
                    (itemEnter)="onEnter()"
                    (itemLeave)="onLeave()">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class CDropHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'L1' }, { id: 2, name: 'L2' }]);
            readonly right = signal<TestRow[]>([{ id: 3, name: 'R1' }]);
            capture(e: SortableReorderEvent<TestRow>): void { state.lastReorder = e; }
            onEnter(): void { entered++; }
            onLeave(): void { leftCount++; }
        }
        const f = TestBed.createComponent(CDropHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const leftItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (leftItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 5 }));
        f.detectChanges();
        expect(entered).toBe(1);
        const rightSortableHost = f.nativeElement.querySelectorAll('ui-sortable')[1].querySelector('[data-slot="sortable"]');
        expect(rightSortableHost?.getAttribute('data-receiving')).toBe('true');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 5 }));
        f.detectChanges();

        expect(f.componentInstance.left().map(r => r.name)).toEqual(['L2']);
        expect(f.componentInstance.right().map(r => r.name)).toContain('L1');
        expect(state.lastReorder).not.toBeNull();
        expect(state.lastReorder?.from.listId).toBe('L');
        expect(state.lastReorder?.to.listId).toBe('R');
        expect(state.lastReorder?.item.name).toBe('L1');
        expect(leftCount).toBe(1);

        document.body.removeChild(f.nativeElement);
    });

    it('cross-list drop: rejected leaves both lists unchanged and emits (dropRejected)', () => {
        clearRegistry();
        const state: { rejected: SortableDropRejectedEvent<TestRow> | null } = { rejected: null };
        @Component({
            selector: 'app-rej-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable
                    [(items)]="left"
                    group="rej"
                    listId="L"
                    style="display:block; position:fixed; left:0px; top:0px; width:200px;"
                    (dropRejected)="capture($event)">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable
                    [(items)]="right"
                    group="rej"
                    listId="R"
                    [accepts]="rejectFn"
                    style="display:block; position:fixed; left:300px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class RejHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'L1' }]);
            readonly right = signal<TestRow[]>([{ id: 3, name: 'R1' }]);
            readonly rejectFn = (): { ok: boolean; reason?: string } => ({ ok: false, reason: 'wip-limit' });
            capture(e: SortableDropRejectedEvent<TestRow>): void { state.rejected = e; }
        }
        const f = TestBed.createComponent(RejHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const leftItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (leftItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 5 }));
        f.detectChanges();
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 5 }));
        f.detectChanges();

        expect(f.componentInstance.left().map(r => r.name)).toEqual(['L1']);
        expect(f.componentInstance.right().map(r => r.name)).toEqual(['R1']);
        expect(state.rejected).not.toBeNull();
        expect(state.rejected?.reason).toBe('wip-limit');
        expect(state.rejected?.fromListId).toBe('L');
        expect(state.rejected?.toListId).toBe('R');

        document.body.removeChild(f.nativeElement);
    });

    it('cancels an in-flight drag and emits dropRejected when items() is mutated externally', () => {
        attachAndSizeFixture();
        const sortable = getSortable<TestRow>(fixture);
        const rejects: SortableDropRejectedEvent<TestRow>[] = [];
        sortable.dropRejected.subscribe((e) => rejects.push(e));

        sortable.startDrag(0, 5, 10);
        expect(sortable.dragSource()).toBe(0);

        host.rows.update((rs) => rs.slice(0, 1));
        fixture.detectChanges();

        expect(sortable.dragSource()).toBeNull();
        expect(rejects).toHaveLength(1);
        expect(rejects[0].reason).toBe('list-changed');
        detachFixture();
    });

    it('cancels an in-flight drag and emits dropRejected when disabled flips true mid-drag', () => {
        attachAndSizeFixture();
        const sortable = getSortable<TestRow>(fixture);
        const rejects: SortableDropRejectedEvent<TestRow>[] = [];
        sortable.dropRejected.subscribe((e) => rejects.push(e));

        sortable.startDrag(0, 5, 10);
        expect(sortable.dragSource()).toBe(0);

        host.disabled.set(true);
        fixture.detectChanges();

        expect(sortable.dragSource()).toBeNull();
        expect(rejects).toHaveLength(1);
        expect(rejects[0].reason).toBe('disabled');
        detachFixture();
    });

    it('announces pickup / move / drop via the aria-live region', async () => {
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        await new Promise<void>(r => setTimeout(r, 80));
        const region: HTMLElement | null = document.querySelector('[data-slot="sortable-aria-live"]');
        expect(region).not.toBeNull();
        expect(region?.textContent).toContain('Position 1 of 3');

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        await new Promise<void>(r => setTimeout(r, 80));
        expect(region?.textContent).toContain('Moved to position 2');

        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: ' ' }));
        await new Promise<void>(r => setTimeout(r, 80));
        expect(region?.textContent).toContain('Dropped at position 2');
    });

    it('uses the resolved locale (he) for announcements when [locale]="he"', async () => {
        @Component({
            selector: 'app-loc-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" locale="he">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class LocHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
        }
        const f = TestBed.createComponent(LocHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        await new Promise<void>(r => setTimeout(r, 80));
        const region: HTMLElement | null = document.querySelector('[data-slot="sortable-aria-live"]');
        expect(region?.textContent).toContain('הורם');

        document.body.removeChild(f.nativeElement);
    });

    it('accepts a fully custom SortableLocale object as input', () => {
        const customLocale: SortableLocale = {
            code: 'xx',
            pickedUp: (label, n, total) => `XX-PICKED ${label} ${n}/${total}`,
            moved: (n, total) => `XX-MOVED ${n}/${total}`,
            movedToList: (l, n, t) => `XX-MTL ${l} ${n}/${t}`,
            dropped: (n) => `XX-DROP ${n}`,
            rejected: (reason) => `XX-REJ ${reason ?? ''}`,
            cancelled: 'XX-CANCELLED',
        };

        @Component({
            selector: 'app-custom-loc-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [locale]="loc">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class CustomLocHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
            readonly loc = customLocale;
        }
        const f = TestBed.createComponent(CustomLocHost);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        expect(sortable.currentLocale().cancelled).toBe('XX-CANCELLED');
        expect(sortable.currentLocale().pickedUp('A', 1, 3)).toBe('XX-PICKED A 1/3');
    });

    it('Home jumps the lifted item to position 0', () => {
        const sortable = getSortable<TestRow>(fixture);
        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: 'Home' }));
        fixture.detectChanges();

        expect(host.rows().map(r => r.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
        expect(host.lastReorder?.to.index).toBe(0);
    });

    it('End jumps the lifted item to the last position', () => {
        const sortable = getSortable<TestRow>(fixture);
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'End' }));
        fixture.detectChanges();

        expect(host.rows().map(r => r.name)).toEqual(['Beta', 'Gamma', 'Alpha']);
        expect(host.lastReorder?.to.index).toBe(2);
    });

    it('Tab while lifted hands the item to the next peer in the group', () => {
        clearRegistry();
        @Component({
            selector: 'app-kbd-cross-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="left" group="kbd" listId="L">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable [(items)]="right" group="kbd" listId="R">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class KbdCrossHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly right = signal<TestRow[]>([]);
        }
        const f = TestBed.createComponent(KbdCrossHost);
        f.detectChanges();
        const sortables = f.debugElement.queryAll(el => el.componentInstance instanceof SortableComponent)
            .map(d => d.componentInstance as SortableComponent<TestRow>);
        const leftS = sortables.find(s => s.listId() === 'L')!;

        leftS.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        leftS.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'Tab' }));
        f.detectChanges();

        expect(f.componentInstance.left().map(r => r.name)).toEqual(['B']);
        expect(f.componentInstance.right().map(r => r.name)).toEqual(['A']);
    });

    it('cross-list drop into an empty list inserts at index 0 and removes the empty slot', () => {
        clearRegistry();
        @Component({
            selector: 'app-empty-drop-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable
                    [(items)]="left"
                    group="emptydrop"
                    listId="L"
                    class="fixed left-0 top-0 w-[200px]">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable
                    [(items)]="right"
                    group="emptydrop"
                    listId="R"
                    class="fixed left-[300px] top-0 w-[200px] h-[200px]">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class EmptyDropHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'Move me' }]);
            readonly right = signal<TestRow[]>([]);
        }
        const f = TestBed.createComponent(EmptyDropHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const leftItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (leftItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 100 }));
        f.detectChanges();
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 100 }));
        f.detectChanges();

        expect(f.componentInstance.left()).toEqual([]);
        expect(f.componentInstance.right().map(r => r.name)).toEqual(['Move me']);

        document.body.removeChild(f.nativeElement);
    });

    it('built-in landEffect plays via element.animate with composite:"add"', async () => {
        @Component({
            selector: 'app-builtin-land',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [landEffect]="pulseFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class BuiltInHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly pulseFn = (): string => SORTABLE_LAND_EFFECTS.pulse;
        }
        const f = TestBed.createComponent(BuiltInHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 30));

        const additive = animateSpy.mock.calls.find(args => {
            const opts = args[1];
            return typeof opts === 'object' && (opts as KeyframeAnimationOptions | null)?.composite === 'add';
        });
        expect(additive).toBeDefined();
        animateSpy.mockRestore();
        document.body.removeChild(f.nativeElement);
    });

    it('a no-op pointer drop (target stays in the source gap) clears drag state and leaves order intact', () => {
        attachAndSizeFixture();
        const sortable = getSortable<TestRow>(fixture);
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        const before = host.rows().map(r => r.name);

        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 5, bubbles: true }));
        expect(sortable.dragSource()).toBe(0);
        // Move a few px — pointer stays inside the source's own no-op gap (target === source + 1).
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 9 }));
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 9 }));
        fixture.detectChanges();

        expect(sortable.dragSource()).toBeNull();
        expect(sortable.dragTarget()).toBeNull();
        expect(host.rows().map(r => r.name)).toEqual(before);
        detachFixture();
    });

    it('drag from index 0 reorders even when the cursor starts in the upper half of the source row', () => {
        attachAndSizeFixture();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        const sourceRect = items[0].getBoundingClientRect();
        const downstreamRect = items[2].getBoundingClientRect();
        const sourceUpperY = sourceRect.top + 4; // upper half — broke the old algorithm
        const targetY = downstreamRect.top + downstreamRect.height / 2 + 4;

        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: sourceUpperY, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: targetY }));
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: targetY }));
        fixture.detectChanges();

        // Old algorithm: cursor stayed in upper half of source's adjusted rect → target=0 forever → no reorder.
        // New algorithm: source is skipped during scan → target computed from neighbours, reorder happens.
        expect(host.rows()[0].name).not.toBe('Alpha');
        detachFixture();
    });

    it('animates after Escape-cancel restores order', async () => {
        attachAndSizeFixture();
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();
        await flushTimers();

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        await flushTimers();

        expect(animateSpy).toHaveBeenCalled();
        animateSpy.mockRestore();
        detachFixture();
    });
});

describe('SortableComponent — i18n integration', () => {
    it('falls back to global UI_LOCALE_ID when no locale input is set', async () => {
        @Component({
            selector: 'app-global-loc-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class GlobalLocHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
        }
        await TestBed.configureTestingModule({
            imports: [GlobalLocHost],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const f = TestBed.createComponent(GlobalLocHost);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        expect(sortable.currentLocale().code).toBe('he');
        expect(sortable.currentLocale().cancelled).toContain('בוטל');
    });

    it('per-instance locale input overrides the global signal', async () => {
        @Component({
            selector: 'app-override-loc-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" locale="fr">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class OverrideLocHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        await TestBed.configureTestingModule({
            imports: [OverrideLocHost],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const f = TestBed.createComponent(OverrideLocHost);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        expect(sortable.currentLocale().code).toBe('fr');
        expect(sortable.currentLocale().cancelled).toContain('annulée');
    });

    it('reacts to a signal-based global locale change', async () => {
        const localeSignal = signal('en');

        @Component({
            selector: 'app-signal-loc-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class SignalLocHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        await TestBed.configureTestingModule({
            imports: [SignalLocHost],
            providers: [provideUiLocale(localeSignal)],
        }).compileComponents();
        const f = TestBed.createComponent(SignalLocHost);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        expect(sortable.currentLocale().code).toBe('en');

        localeSignal.set('ar');
        f.detectChanges();
        expect(sortable.currentLocale().code).toBe('ar');
        expect(sortable.currentLocale().rtl).toBe(true);
    });
});

/** Private surface reached via cast to exercise defensive guards jsdom can't hit naturally. */
interface SortablePrivate {
    cancelDragDueTo(reason: string): void;
    onDragEnd(): void;
    updatePeerRejectVisual(peer: unknown, toIndex: number): void;
    keyboardCrossList(fromIndex: number, direction: number): void;
    readonly _dragTarget: { set(value: number | null): void };
}

function asPrivate<T>(sortable: SortableComponent<T>): SortablePrivate {
    return sortable as unknown as SortablePrivate;
}

function firstSortable<T>(f: ComponentFixture<unknown>, listId?: string): SortableComponent<T> {
    const all = f.debugElement
        .queryAll(el => el.componentInstance instanceof SortableComponent)
        .map(d => d.componentInstance as SortableComponent<T>);
    return (listId ? all.find(s => s.listId() === listId) : all[0]) as SortableComponent<T>;
}

describe('SortableComponent — coverage completion', () => {
    it('SortableItemTemplateDirective exposes a passthrough ngTemplateContextGuard', () => {
        const guard = SortableItemTemplateDirective.ngTemplateContextGuard;
        expect(guard({} as SortableItemTemplateDirective, { $implicit: 1, index: 0 })).toBe(true);
    });

    it('a handle with no sortable ancestor ignores mouse and touch without throwing', () => {
        @Component({
            selector: 'app-orphan-handle-host',
            standalone: true,
            imports: [SortableHandleDirective],
            template: `<span uiSortableHandle class="lonely">grip</span>`,
        })
        class OrphanHandleHost {}
        const f = TestBed.createComponent(OrphanHandleHost);
        f.detectChanges();
        const handle = f.nativeElement.querySelector('.lonely') as HTMLElement;
        expect(() => {
            handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 1, clientY: 1, bubbles: true }));
            handle.dispatchEvent(makeTouchEvent('touchstart', 1, 1));
        }).not.toThrow();
    });

    it('drag by the handle starts a drag on both mouse and touch', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.handleOnly.set(true);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);

        const handle = f.nativeElement.querySelector('.handle') as HTMLElement;
        handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 3, clientY: 3, bubbles: true }));
        expect(sortable.dragSource()).toBe(0);
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 3, clientY: 3 }));
        expect(sortable.dragSource()).toBeNull();

        handle.dispatchEvent(makeTouchEvent('touchstart', 4, 4));
        expect(sortable.dragSource()).toBe(0);
        globalThis.dispatchEvent(makeTouchEvent('touchend', 4, 4));
        expect(sortable.dragSource()).toBeNull();

        document.body.removeChild(f.nativeElement);
    });

    it('handle touchstart with no touch points does not start a drag', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        const handle = f.nativeElement.querySelector('.handle') as HTMLElement;

        const empty = new Event('touchstart', { bubbles: true, cancelable: true });
        Object.assign(empty, { touches: [], changedTouches: [] });
        handle.dispatchEvent(empty);
        expect(sortable.dragSource()).toBeNull();
    });

    it('drag by the item body via touch reorders and cleans up on touchend', () => {
        const f = TestBed.createComponent(TestHostComponent);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        items[0].dispatchEvent(makeTouchEvent('touchstart', 5, 5));
        expect(sortable.dragSource()).toBe(0);
        globalThis.dispatchEvent(makeTouchEvent('touchmove', 5, 115));
        globalThis.dispatchEvent(makeTouchEvent('touchend', 5, 115));
        f.detectChanges();

        expect(sortable.dragSource()).toBeNull();
        expect(f.componentInstance.rows()[2].name).toBe('Alpha');
        document.body.removeChild(f.nativeElement);
    });

    it('item touchstart with no touch points does not start a drag', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        const empty = new Event('touchstart', { bubbles: true, cancelable: true });
        Object.assign(empty, { touches: [], changedTouches: [] });
        items[0].dispatchEvent(empty);
        expect(sortable.dragSource()).toBeNull();
    });

    it('built-in land effect is skipped when prefers-reduced-motion is set', async () => {
        @Component({
            selector: 'app-reduced-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [landEffect]="pulseFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class ReducedHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly pulseFn = (): string => SORTABLE_LAND_EFFECTS.pulse;
        }
        const win = globalThis.window as unknown as { matchMedia: (q: string) => unknown };
        const stubbed = win.matchMedia;
        win.matchMedia = (query: string) => ({
            matches: true, media: query, onchange: null,
            addEventListener(): void {}, removeEventListener(): void {},
            addListener(): void {}, removeListener(): void {},
            dispatchEvent(): boolean { return false; },
        });
        const f = TestBed.createComponent(ReducedHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        const sortable = firstSortable<TestRow>(f);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 20));

        const additive = animateSpy.mock.calls.some(args => {
            const opts = args[1] as KeyframeAnimationOptions | null | undefined;
            return typeof opts === 'object' && opts?.composite === 'add';
        });
        expect(additive).toBe(false);
        animateSpy.mockRestore();
        win.matchMedia = stubbed;
        document.body.removeChild(f.nativeElement);
    });

    it('lifting an out-of-range index announces a generic item label', async () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        sortable.handleItemKeyDown(9, new KeyboardEvent('keydown', { key: ' ' }));
        await new Promise<void>(r => setTimeout(r, 60));
        const region: HTMLElement | null = document.querySelector('[data-slot="sortable-aria-live"]');
        expect(region?.textContent).toContain('item 10');
    });

    it('draggedItem and effectiveDragDelta return neutral values when no drag is active', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        expect(sortable.draggedItem()).toBeNull();
        expect(sortable.effectiveDragDelta()).toEqual({ x: 0, y: 0 });
    });

    it('re-registers when [group] changes to a different non-empty value', () => {
        clearRegistry();
        @Component({
            selector: 'app-grpchg-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [group]="grp()" listId="G">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class GrpChgHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
            readonly grp = signal('g1');
        }
        const f = TestBed.createComponent(GrpChgHost);
        f.detectChanges();
        expect(groupSize('g1')).toBe(1);

        f.componentInstance.grp.set('g2');
        f.detectChanges();
        expect(groupSize('g2')).toBe(1);
        expect(peersInGroup('g2')[0].listId).toBe('G');
    });

    it('registry entry removeItem removes a matching item and no-ops for an absent one', () => {
        clearRegistry();
        @Component({
            selector: 'app-remove-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" group="rem" listId="X">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class RemoveHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
        }
        const f = TestBed.createComponent(RemoveHost);
        f.detectChanges();
        const entry = peersInGroup('rem')[0];

        entry.removeItem({ id: 99, name: 'ghost' });
        expect(f.componentInstance.rows().map(r => r.name)).toEqual(['A', 'B']);

        const existing = f.componentInstance.rows()[0];
        entry.removeItem(existing);
        f.detectChanges();
        expect(f.componentInstance.rows().map(r => r.name)).toEqual(['B']);
    });

    it('cancelDragDueTo is a no-op when no drag is in flight', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        expect(() => asPrivate(sortable).cancelDragDueTo('external')).not.toThrow();
        expect(sortable.dragSource()).toBeNull();
    });

    it('updatePeerRejectVisual is a no-op when there is no dragged item', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        const peer = { setRejectReason: vi.fn(), canAccept: vi.fn() };
        asPrivate(sortable).updatePeerRejectVisual(peer, 0);
        expect(peer.setRejectReason).not.toHaveBeenCalled();
        expect(peer.canAccept).not.toHaveBeenCalled();
    });

    it('onDragEnd clears state when invoked without an active source', () => {
        const f = TestBed.createComponent(TestHostComponent);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        expect(() => asPrivate(sortable).onDragEnd()).not.toThrow();
        expect(sortable.dragSource()).toBeNull();
        document.body.removeChild(f.nativeElement);
    });

    it('onDragEnd with no computed gap snaps back via FLIP and clears drag state', () => {
        const f = TestBed.createComponent(TestHostComponent);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);

        sortable.startDrag(0, 5, 5);
        expect(sortable.dragSource()).toBe(0);
        asPrivate(sortable)._dragTarget.set(null);
        asPrivate(sortable).onDragEnd();

        expect(sortable.dragSource()).toBeNull();
        expect(sortable.dragTarget()).toBeNull();
        document.body.removeChild(f.nativeElement);
    });

    it('a movement key pressed on an un-lifted item is ignored', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        const before = f.componentInstance.rows().map(r => r.name);
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(f.componentInstance.rows().map(r => r.name)).toEqual(before);
    });

    it('ArrowUp on the lifted first item is a no-op move (clamped to same index)', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(f.componentInstance.rows().map(r => r.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('Tab while lifted is a no-op when the list has no group', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(f.componentInstance.rows().map(r => r.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('Tab while lifted is a no-op when the group has a single list', () => {
        clearRegistry();
        @Component({
            selector: 'app-solo-grp-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" group="solo" listId="only">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class SoloGrpHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
        }
        const f = TestBed.createComponent(SoloGrpHost);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(f.componentInstance.rows().map(r => r.name)).toEqual(['A', 'B']);
    });

    it('keyboardCrossList is a no-op when the resolved peer is the list itself (zero direction)', () => {
        clearRegistry();
        @Component({
            selector: 'app-selfpeer-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="left" group="selfp" listId="L">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable [(items)]="right" group="selfp" listId="R">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class SelfPeerHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'A' }]);
            readonly right = signal<TestRow[]>([{ id: 2, name: 'B' }]);
        }
        const f = TestBed.createComponent(SelfPeerHost);
        f.detectChanges();
        const leftS = firstSortable<TestRow>(f, 'L');
        asPrivate(leftS).keyboardCrossList(0, 0);
        expect(f.componentInstance.left().map(r => r.name)).toEqual(['A']);
        expect(f.componentInstance.right().map(r => r.name)).toEqual(['B']);
    });

    it('Tab hand-off to a rejecting peer announces and emits dropRejected without moving', () => {
        clearRegistry();
        const rejects: SortableDropRejectedEvent<TestRow>[] = [];
        @Component({
            selector: 'app-kbd-reject-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="left" group="kr" listId="L" (dropRejected)="capture($event)">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable [(items)]="right" group="kr" listId="R" [accepts]="reject">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class KbdRejectHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly right = signal<TestRow[]>([]);
            readonly reject = (): { ok: boolean; reason?: string } => ({ ok: false, reason: 'full' });
            capture(e: SortableDropRejectedEvent<TestRow>): void { rejects.push(e); }
        }
        const f = TestBed.createComponent(KbdRejectHost);
        f.detectChanges();
        const leftS = firstSortable<TestRow>(f, 'L');
        leftS.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        leftS.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'Tab' }));
        f.detectChanges();

        expect(f.componentInstance.left().map(r => r.name)).toEqual(['A', 'B']);
        expect(f.componentInstance.right()).toEqual([]);
        expect(rejects).toHaveLength(1);
        expect(rejects[0].reason).toBe('full');
        expect(rejects[0].toListId).toBe('R');
    });

    it('cancelling a cross-list drag mid-hover notifies the hovered peer it left', () => {
        clearRegistry();
        const rejects: SortableDropRejectedEvent<TestRow>[] = [];
        let leaves = 0;
        @Component({
            selector: 'app-cancel-peer-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="left" group="cp" listId="L"
                    (dropRejected)="capture($event)"
                    style="display:block; position:fixed; left:0px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable [(items)]="right" group="cp" listId="R"
                    (itemLeave)="onLeave()"
                    style="display:block; position:fixed; left:300px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class CancelPeerHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly right = signal<TestRow[]>([{ id: 3, name: 'X' }]);
            capture(e: SortableDropRejectedEvent<TestRow>): void { rejects.push(e); }
            onLeave(): void { leaves++; }
        }
        const f = TestBed.createComponent(CancelPeerHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const leftS = firstSortable<TestRow>(f, 'L');

        const leftItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (leftItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 10 }));
        f.detectChanges();
        expect(leftS.hoverPeer()?.listId).toBe('R');

        f.componentInstance.left.update(rs => rs.slice(0, 1));
        f.detectChanges();

        expect(leftS.dragSource()).toBeNull();
        expect(rejects).toHaveLength(1);
        expect(rejects[0].reason).toBe('list-changed');
        expect(rejects[0].toListId).toBe('R');
        expect(leaves).toBe(1);

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 10 }));
        document.body.removeChild(f.nativeElement);
    });

    it('switching the hovered peer during a drag notifies the previous peer it left', () => {
        clearRegistry();
        @Component({
            selector: 'app-three-list-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="a" group="tri" listId="A"
                    style="display:block; position:fixed; left:0px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable [(items)]="b" group="tri" listId="B"
                    style="display:block; position:fixed; left:300px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable [(items)]="c" group="tri" listId="C"
                    style="display:block; position:fixed; left:600px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class ThreeListHost {
            readonly a = signal<TestRow[]>([{ id: 1, name: 'A1' }]);
            readonly b = signal<TestRow[]>([{ id: 2, name: 'B1' }]);
            readonly c = signal<TestRow[]>([{ id: 3, name: 'C1' }]);
        }
        const f = TestBed.createComponent(ThreeListHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const aS = firstSortable<TestRow>(f, 'A');

        const aItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (aItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 10 }));
        f.detectChanges();
        expect(aS.hoverPeer()?.listId).toBe('B');

        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 650, clientY: 10 }));
        f.detectChanges();
        expect(aS.hoverPeer()?.listId).toBe('C');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 650, clientY: 10 }));
        f.detectChanges();
        document.body.removeChild(f.nativeElement);
    });

    it('scheduleLandEffect bails out when the landed element no longer exists', async () => {
        @Component({
            selector: 'app-land-gone-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [landEffect]="landFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class LandGoneHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly landFn = (): string => 'land-x';
        }
        const f = TestBed.createComponent(LandGoneHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        f.componentInstance.rows.set([]);
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 20));

        expect(f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')).toHaveLength(0);
        document.body.removeChild(f.nativeElement);
    });

    it('a standalone sortable-item without a parent renders with neutral position class', () => {
        @Component({
            selector: 'app-orphan-host',
            standalone: true,
            imports: [SortableItemComponent],
            template: `<ui-sortable-item [index]="0">orphan</ui-sortable-item>`,
        })
        class OrphanHost {}
        const f = TestBed.createComponent(OrphanHost);
        f.detectChanges();
        const item = f.debugElement.query(el => el.componentInstance instanceof SortableItemComponent)
            .componentInstance as SortableItemComponent;
        expect(item.positionClassValue()).toBe('');
        expect(item.disabled()).toBe(false);
        expect(item.dragStyle()).toEqual({});
    });

    it('positionClass yields empty string for an item index beyond the list length', () => {
        @Component({
            selector: 'app-pos-oob-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [positionClass]="posFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                    <ui-sortable-item [index]="9" uiSortableFooter class="probe">extra</ui-sortable-item>
                </ui-sortable>
            `,
        })
        class PosOobHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
            readonly posFn = (): string => 'has-pos';
        }
        const f = TestBed.createComponent(PosOobHost);
        f.detectChanges();
        const probe = f.debugElement
            .queryAll(el => el.componentInstance instanceof SortableItemComponent)
            .map(d => d.componentInstance as SortableItemComponent)
            .find(c => c.index() === 9)!;
        expect(probe.positionClassValue()).toBe('');
    });
});
