import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
    SortableHandleDirective,
    SORTABLE_LAND_EFFECTS,
    type SortableReorderEvent,
    type SortableDropRejectedEvent,
} from './sortable.component';
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
    const slot = (el as HTMLElement).dataset?.['slot'];
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

afterEach(() => {
    vi.useRealTimers();
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

    it('renders the projected item template and applies the class input to the container', () => {
        host.extraClass.set('my-custom');
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement.querySelector('[data-slot="sortable"]');
        expect(el.className).toContain('my-custom');

        const names: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.name');
        expect(Array.from(names).map(n => n.textContent?.trim())).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('ignores keyboard and mouse drags when disabled', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);
        const before = host.rows().map(r => r.name);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();

        expect(host.rows().map(r => r.name)).toEqual(before);
        expect(host.lastReorder).toBeNull();

        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 5, bubbles: true }));
        expect(sortable.dragSource()).toBeNull();
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

    it('moves the lifted item with the arrows of its orientation: ArrowUp in a vertical list, ArrowRight then ArrowLeft in a horizontal one', () => {
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();
        expect(host.rows()[0].name).toBe('Alpha');
        expect(host.lastReorder).toBeNull();

        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        fixture.detectChanges();
        expect(host.rows()[1].name).toBe('Gamma');
        expect(host.rows()[2].name).toBe('Beta');
        expect(host.lastReorder?.from.index).toBe(2);
        expect(host.lastReorder?.to.index).toBe(1);
        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: ' ' }));

        host.orientation.set('horizontal');
        fixture.detectChanges();
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();
        expect(host.rows().map(r => r.name)).toEqual(['Gamma', 'Alpha', 'Beta']);

        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();
        expect(host.rows().map(r => r.name)).toEqual(['Alpha', 'Gamma', 'Beta']);
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

    it('projects uiSortableHeader above and uiSortableFooter below the items, and uiSortableEmpty only while items is empty', () => {
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
                    <div uiSortableEmpty data-testid="empty">No items</div>
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">
                            <span class="name">{{ $any(row).name }}</span>
                        </ui-sortable-item>
                    </ng-template>
                    <div uiSortableFooter data-testid="footer">FOOTER</div>
                </ui-sortable>
            `,
        })
        class SlotHost {
            readonly rows = signal<TestRow[]>([]);
        }
        const f = TestBed.createComponent(SlotHost);
        f.detectChanges();
        expect(f.nativeElement.querySelector('[data-testid="empty"]')).not.toBeNull();

        f.componentInstance.rows.set([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
        f.detectChanges();
        expect(f.nativeElement.querySelector('[data-testid="empty"]')).toBeNull();

        const header: HTMLElement = f.nativeElement.querySelector('[data-testid="header"]');
        const footer: HTMLElement = f.nativeElement.querySelector('[data-testid="footer"]');
        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(header.textContent).toBe('HEADER');
        expect(footer.textContent).toBe('FOOTER');
        expect(header.compareDocumentPosition(items[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(footer.compareDocumentPosition(items[items.length - 1]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });

    it('while dragging renders a translucent ghost at the drop position, a dashed placeholder at the origin and a lifted source, all gone after the drop', () => {
        attachAndSizeFixture();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        items[2].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 95, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 10 }));
        fixture.detectChanges();

        const ghost: HTMLElement | null = fixture.nativeElement.querySelector('[data-slot="sortable-ghost"]');
        expect(ghost).not.toBeNull();
        expect(ghost?.className).toContain('opacity-60');
        expect(ghost?.className).toContain('ui-sortable-ghost-fade');

        const placeholder: HTMLElement | null = document.querySelector('[data-slot="sortable-placeholder"]');
        expect(placeholder).not.toBeNull();
        expect(placeholder?.className).toContain('border-dashed');

        expect(items[2].className).toContain('z-50');
        expect(items[2].className).toContain('shadow-2xl');
        const transform = items[2].style.transform;
        expect(transform).toContain('translate');
        expect(transform).toContain('scale(1.02)');
        expect(transform).toContain('rotate(1.5deg)');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 10 }));
        fixture.detectChanges();
        expect(document.querySelector('[data-slot="sortable-placeholder"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('[data-slot="sortable-ghost"]')).toBeNull();
        detachFixture();
    });

    it('uses custom uiSortableGhost and uiSortablePlaceholder templates when provided, instead of the defaults', () => {
        @Component({
            selector: 'app-ghost-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                SortableGhostTemplateDirective,
                SortablePlaceholderTemplateDirective,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                    <ng-template uiSortableGhost let-row>
                        <div data-testid="custom-ghost">Drop: {{ $any(row).name }}</div>
                    </ng-template>
                    <ng-template uiSortablePlaceholder let-row>
                        <div data-testid="custom-placeholder">Was here: {{ $any(row).name }}</div>
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

        expect(f.nativeElement.querySelector('[data-testid="custom-ghost"]')?.textContent).toContain('C');
        expect(f.nativeElement.querySelector('[data-testid="custom-placeholder"]')?.textContent).toContain('C');
        expect(f.nativeElement.querySelector('[data-slot="sortable-ghost"]')).toBeNull();
        expect(document.querySelector('[data-slot="sortable-placeholder"]')).toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 10 }));
        document.body.removeChild(f.nativeElement);
    });

    it('shows cursor-grab on body-draggable items, and with handleOnly hides it and stops the item body from starting a drag', () => {
        const sortable = getSortable<TestRow>(fixture);
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(items[0].className).toContain('cursor-grab');

        host.handleOnly.set(true);
        fixture.detectChanges();
        const itemsAfter: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(itemsAfter[0].className).not.toContain('cursor-grab');

        const firstItem = fixture.debugElement
            .queryAll(el => el.componentInstance instanceof SortableItemComponent)[0]
            .componentInstance as SortableItemComponent;
        firstItem.onMouseDown(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
        expect(sortable.dragSource()).toBeNull();
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

    it('adds the landEffect class transiently to the landed item after a keyboard reorder', () => {
        vi.useFakeTimers();
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
        vi.advanceTimersByTime(10);
        f.detectChanges();

        const landed: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(landed?.className).toContain('land-test-class');

        vi.advanceTimersByTime(800);
        f.detectChanges();
        const after: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(after?.className).not.toContain('land-test-class');

        document.body.removeChild(f.nativeElement);
    });

    it('landEffect returning null does not add any class', () => {
        vi.useFakeTimers();
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
        vi.advanceTimersByTime(20);
        f.detectChanges();

        const item: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(item?.className ?? '').not.toMatch(/land-/);
        expect(calls).toBeGreaterThan(0);
        document.body.removeChild(f.nativeElement);
    });

    it('registers with the group registry when [group] is non-empty and unregisters on destroy', () => {
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

        f.destroy();
        expect(groupSize('my-grp')).toBe(0);
    });

    it('by default items are tracked by identity and every drop is accepted, but a disabled list rejects with reason "disabled"', () => {
        const sortable = getSortable<TestRow>(fixture);
        const item: TestRow = { id: 99, name: 'X' };
        expect(sortable.trackBy()(item, 0)).toBe(item);
        expect(sortable.evaluateAccepts({ id: 1, name: 'A' }, { fromListId: 'x', toIndex: 0 })).toBe(true);

        host.disabled.set(true);
        fixture.detectChanges();
        expect(sortable.evaluateAccepts({ id: 1, name: 'A' }, { fromListId: 'x', toIndex: 0 }))
            .toEqual({ ok: false, reason: 'disabled' });
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

    it('announces pickup / move / drop via the aria-live region, with a generic label for an out-of-range index', () => {
        vi.useFakeTimers();
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        vi.advanceTimersByTime(80);
        const region: HTMLElement | null = document.querySelector('[data-slot="sortable-aria-live"]');
        expect(region).not.toBeNull();
        expect(region?.textContent).toContain('Position 1 of 3');

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        vi.advanceTimersByTime(80);
        expect(region?.textContent).toContain('Moved to position 2');

        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: ' ' }));
        vi.advanceTimersByTime(80);
        expect(region?.textContent).toContain('Dropped at position 2');

        sortable.handleItemKeyDown(9, new KeyboardEvent('keydown', { key: ' ' }));
        vi.advanceTimersByTime(80);
        expect(region?.textContent).toContain('item 10');
    });

    it('uses the resolved locale (he) for announcements when [locale]="he"', () => {
        vi.useFakeTimers();
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
        vi.advanceTimersByTime(80);
        const region: HTMLElement | null = document.querySelector('[data-slot="sortable-aria-live"]');
        expect(region?.textContent).toContain('הורם');

        document.body.removeChild(f.nativeElement);
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

    it('every built-in landEffect plays via element.animate with composite:"add"', () => {
        vi.useFakeTimers();
        let effect: string = SORTABLE_LAND_EFFECTS.pulse;
        @Component({
            selector: 'app-builtin-land',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
            template: `
                <ui-sortable [(items)]="rows" [landEffect]="landFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class BuiltInHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly landFn = (): string => effect;
        }
        const f = TestBed.createComponent(BuiltInHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;

        for (const built of Object.values(SORTABLE_LAND_EFFECTS)) {
            effect = built;
            animateSpy.mockClear();
            sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
            sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            f.detectChanges();
            vi.advanceTimersByTime(30);

            const additive = animateSpy.mock.calls.find(args => {
                const opts = args[1];
                return typeof opts === 'object' && (opts as KeyframeAnimationOptions | null)?.composite === 'add';
            });
            expect(additive, built).toBeDefined();
            sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: ' ' }));
        }
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

        // The old algorithm pinned target=0 while the cursor sat in the source's upper half.
        expect(host.rows().map(r => r.name)).toEqual(['Beta', 'Gamma', 'Alpha']);
        expect(host.lastReorder?.from.index).toBe(0);
        expect(host.lastReorder?.to.index).toBe(2);
        detachFixture();
    });
});

function firstSortable<T>(f: ComponentFixture<unknown>, listId?: string): SortableComponent<T> {
    const all = f.debugElement
        .queryAll(el => el.componentInstance instanceof SortableComponent)
        .map(d => d.componentInstance as SortableComponent<T>);
    return (listId ? all.find(s => s.listId() === listId) : all[0]) as SortableComponent<T>;
}

/** Private surface reached via cast to exercise defensive guards no public path reaches. */
interface SortablePrivate {
    onDragEnd(): void;
    readonly _dragTarget: { set(value: number | null): void };
}

function asPrivate<T>(sortable: SortableComponent<T>): SortablePrivate {
    return sortable as unknown as SortablePrivate;
}

describe('SortableComponent — coverage completion', () => {
    it('template-marker directives expose passthrough ngTemplateContextGuards (white-box: compile-time type guards with no runtime caller)', () => {
        expect(SortableItemTemplateDirective.ngTemplateContextGuard({} as SortableItemTemplateDirective, { $implicit: 1, index: 0 })).toBe(true);
        expect(SortableGhostTemplateDirective.ngTemplateContextGuard({} as SortableGhostTemplateDirective, { $implicit: { id: 1 }, index: 0 })).toBe(true);
        expect(SortablePlaceholderTemplateDirective.ngTemplateContextGuard({} as SortablePlaceholderTemplateDirective, { $implicit: 'x', index: 2 })).toBe(true);
    });

    it('onDragEnd clears state when invoked without an active source (white-box: unreachable through the public API)', () => {
        const f = TestBed.createComponent(TestHostComponent);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        expect(() => asPrivate(sortable).onDragEnd()).not.toThrow();
        expect(sortable.dragSource()).toBeNull();
        expect(sortable.draggedItem()).toBeNull();
        expect(sortable.effectiveDragDelta()).toEqual({ x: 0, y: 0 });
        document.body.removeChild(f.nativeElement);
    });

    it('onDragEnd with no computed gap snaps back without reordering and clears drag state (white-box: startDrag always seeds a gap)', () => {
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
        expect(f.componentInstance.lastReorder).toBeNull();
        expect(f.componentInstance.rows().map(r => r.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
        document.body.removeChild(f.nativeElement);
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

    it('a touchstart with no touch points starts no drag, on the handle or the item body', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        const empty = (): Event => {
            const ev = new Event('touchstart', { bubbles: true, cancelable: true });
            Object.assign(ev, { touches: [], changedTouches: [] });
            return ev;
        };

        (f.nativeElement.querySelector('.handle') as HTMLElement).dispatchEvent(empty());
        expect(sortable.dragSource()).toBeNull();
        (f.nativeElement.querySelector('[data-slot="sortable-item"]') as HTMLElement).dispatchEvent(empty());
        expect(sortable.dragSource()).toBeNull();
    });

    it('built-in land effect is skipped when prefers-reduced-motion is set', () => {
        vi.useFakeTimers();
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
        vi.advanceTimersByTime(20);

        const additive = animateSpy.mock.calls.some(args => {
            const opts = args[1] as KeyframeAnimationOptions | null | undefined;
            return typeof opts === 'object' && opts?.composite === 'add';
        });
        expect(additive).toBe(false);
        animateSpy.mockRestore();
        win.matchMedia = stubbed;
        document.body.removeChild(f.nativeElement);
    });

    it('moves its registration to the new group when [group] changes, and drops it on an empty group', () => {
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
        expect(groupSize('g1')).toBe(0);
        expect(groupSize('g2')).toBe(1);
        expect(peersInGroup('g2')[0].listId).toBe('G');

        f.componentInstance.grp.set('');
        f.detectChanges();
        expect(groupSize('g2')).toBe(0);
        expect(groupSize('')).toBe(0);
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

    it('movement keys do nothing on an un-lifted item, ArrowUp at the first slot, or Tab in an ungrouped list', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();
        const sortable = firstSortable<TestRow>(f);
        const order = (): string[] => f.componentInstance.rows().map(r => r.name);
        const key = (index: number, k: string): void => sortable.handleItemKeyDown(index, new KeyboardEvent('keydown', { key: k }));

        key(0, 'ArrowDown');
        expect(order()).toEqual(['Alpha', 'Beta', 'Gamma']);

        key(0, ' ');
        key(0, 'ArrowUp');
        expect(order()).toEqual(['Alpha', 'Beta', 'Gamma']);
        key(0, 'Tab');
        expect(order()).toEqual(['Alpha', 'Beta', 'Gamma']);
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
                <ui-sortable [(items)]="b" group="tri" listId="B" (itemLeave)="bLeaves = bLeaves + 1"
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
            bLeaves = 0;
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
        expect(aS.hoverPeerTarget()).not.toBeNull();
        const bContainer: HTMLElement = f.nativeElement.querySelectorAll('[data-slot="sortable"]')[1];
        expect(bContainer.dataset['receiving']).toBe('true');
        expect(f.componentInstance.bLeaves).toBe(0);

        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 650, clientY: 10 }));
        f.detectChanges();
        expect(aS.hoverPeer()?.listId).toBe('C');
        expect(f.componentInstance.bLeaves).toBe(1);
        expect(bContainer.dataset['receiving']).toBeUndefined();

        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
        f.detectChanges();
        expect(aS.hoverPeer()).toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50 }));
        f.detectChanges();
        document.body.removeChild(f.nativeElement);
    });

    it('scheduleLandEffect bails out when the landed element no longer exists', () => {
        vi.useFakeTimers();
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
        vi.advanceTimersByTime(20);

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
