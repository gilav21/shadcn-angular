import { Component, signal, type Provider, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { AspectRatioComponent } from './aspect-ratio';
import { AutocompleteComponent } from './autocomplete';
import { BreadcrumbComponent } from './breadcrumb';
import { CommandSeparatorComponent, CommandShortcutComponent } from './command';
import { DataTableComponent } from './data-table';
import { DialogTitleComponent } from './dialog';
import { EmojiPickerComponent, EmojiPickerContentComponent, EmojiPickerTriggerComponent } from './emoji-picker';
import { KanbanColumnDialogComponent } from './kanban';
import { MarqueeComponent } from './marquee';
import { PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from './popover';
import {
    RICH_TEXT_OUTLINE_CONTEXT,
    RichTextOutlinePanelComponent,
    type OutlineHeading,
    type RichTextOutlineContext,
} from './rich-text-editor/addons/outline';
import { RICH_TEXT_OUTLINE_LOCALES } from './rich-text-editor/addons/outline/rich-text-outline.locales';
import { RichTextActionsFormComponent } from './rich-text-editor/addons/actions/rich-text-actions-form.component';
import { StaggerChildrenComponent } from './stagger-children';
import { ToastComponent } from './toast';
import { TooltipComponent, TooltipContentComponent, TooltipDirective } from './tooltip';
import { VirtualScrollComponent } from './virtual-scroll';

/**
 * Library-wide conventions asserted on the rendered result: the consumer's
 * `class` reaches the box and wins conflicts, teardown leaves nothing behind,
 * long tooltips stay on screen. Cross-component by design — each row is the
 * representative of one code path, and the conventions are the same everywhere.
 */

const PAINT = 'bg-[rgb(1,2,3)]';
const PAINTED = 'rgb(1, 2, 3)';

const frame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));
const frames = async (n: number): Promise<void> => {
    for (let i = 0; i < n; i++) await frame();
};

/** A throwaway standalone host for `template`; `props` become fields the template can bind to. */
function mount(
    template: string,
    imports: Type<unknown>[],
    providers: Provider[] = [],
    props: Record<string, unknown> = {},
): ComponentFixture<unknown> {
    class Host {}
    Component({ template, imports })(Host);
    TestBed.configureTestingModule({ providers });
    const fixture = TestBed.createComponent(Host);
    Object.assign(fixture.componentInstance as object, props);
    fixture.detectChanges();
    return fixture;
}

/**
 * Destroys the fixture and removes its root element: TestBed leaves a destroyed
 * component's DOM in `document.body` until the test ends, which would read as a leak.
 */
function discard(fixture: ComponentFixture<unknown>): void {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
}

const style = (el: Element, property: 'backgroundColor' | 'fontSize' | 'height'): string =>
    getComputedStyle(el)[property];

const outlineContext: RichTextOutlineContext = {
    locale: signal(RICH_TEXT_OUTLINE_LOCALES['en']),
    headings: signal<readonly OutlineHeading[]>([{ level: 1, text: 'Intro', index: 0 }]),
    isOpen: signal(true),
    close: () => undefined,
    scrollTo: () => undefined,
    onEntryKeydown: () => undefined,
};

interface PaintRow {
    readonly name: string;
    readonly template: string;
    readonly imports: Type<unknown>[];
    readonly selector: string;
    readonly providers?: Provider[];
}

describe('a consumer class reaches the rendered box', () => {
    const rows: PaintRow[] = [
        {
            name: 'ui-toast (contents host, cva classes)',
            template: `<ui-toast title="Saved" class="${PAINT}" />`,
            imports: [ToastComponent],
            selector: '[data-slot="toast"]',
        },
        {
            name: 'ui-breadcrumb (inline template, no binding)',
            template: `<ui-breadcrumb class="${PAINT}">x</ui-breadcrumb>`,
            imports: [BreadcrumbComponent],
            selector: '[data-slot="breadcrumb"]',
        },
        {
            name: 'ui-breadcrumb under dir=rtl',
            template: `<div dir="rtl"><ui-breadcrumb class="${PAINT}">x</ui-breadcrumb></div>`,
            imports: [BreadcrumbComponent],
            selector: '[data-slot="breadcrumb"]',
        },
        {
            name: 'ui-aspect-ratio (element with only a [style] binding)',
            template: `<ui-aspect-ratio [ratio]="2" class="${PAINT}">x</ui-aspect-ratio>`,
            imports: [AspectRatioComponent],
            selector: '[data-slot="aspect-ratio"]',
        },
        {
            name: 'ui-virtual-scroll (existing containerClasses computed)',
            template: `<ui-virtual-scroll [items]="[]" class="${PAINT}" />`,
            imports: [VirtualScrollComponent],
            selector: '[data-slot="virtual-scroll"]',
        },
        {
            name: 'ui-command-separator (static inner element)',
            template: `<ui-command-separator class="${PAINT}" />`,
            imports: [CommandSeparatorComponent],
            selector: '[data-slot="command-separator"]',
        },
        {
            name: 'ui-rich-text-outline-panel (addon, contents host)',
            template: `<ui-rte-outline-panel class="${PAINT}" />`,
            imports: [RichTextOutlinePanelComponent],
            selector: '[data-slot="rich-text-outline-panel"]',
            providers: [{ provide: RICH_TEXT_OUTLINE_CONTEXT, useValue: outlineContext }],
        },
    ];

    it.each(rows)('$name', ({ template, imports, selector, providers }) => {
        const fixture = mount(template, imports, providers);
        const box = (fixture.nativeElement as HTMLElement).querySelector(selector);
        expect(box).not.toBeNull();
        expect(style(box as Element, 'backgroundColor')).toBe(PAINTED);
    });

    it('ui-tooltip-content (overlay family, already class-aware)', () => {
        const fixture = mount(
            `<ui-tooltip><ui-tooltip-content class="${PAINT}">tip</ui-tooltip-content></ui-tooltip>`,
            [TooltipComponent, TooltipContentComponent],
        );
        fixture.debugElement.children[0].componentInstance.show();
        fixture.detectChanges();
        const box = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="tooltip-content"]');
        expect(style(box as Element, 'backgroundColor')).toBe(PAINTED);
    });
});

describe('a consumer class wins over a conflicting default', () => {
    it('ui-command-shortcut: text-base beats the inner default text-xs', () => {
        const fixture = mount(`<ui-command-shortcut class="text-base">⌘K</ui-command-shortcut>`, [CommandShortcutComponent]);
        const inner = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="command-shortcut"]');
        expect(style(inner as Element, 'fontSize')).toBe('16px');
    });

    it('ui-data-table: h-[123px] beats the host default h-full', () => {
        const fixture = mount(
            `<ui-data-table class="h-[123px]" [data]="rows" [columns]="columns" />`,
            [DataTableComponent],
            [],
            {
                rows: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }],
                columns: [{ accessorKey: 'id', header: 'ID' }, { accessorKey: 'name', header: 'Name' }],
            },
        );
        const table = (fixture.nativeElement as HTMLElement).querySelector('ui-data-table');
        expect(style(table as Element, 'height')).toBe('123px');
    });

    it('ui-dialog-title: text-base beats the host-static text-lg', () => {
        const fixture = mount(`<ui-dialog-title class="text-base">Title</ui-dialog-title>`, [DialogTitleComponent]);
        const title = (fixture.nativeElement as HTMLElement).querySelector('ui-dialog-title');
        expect(style(title as Element, 'fontSize')).toBe('16px');
    });
});

describe('components that declared a class and ignored it now apply it', () => {
    it('ui-kanban-column-dialog paints its dialog panel', async () => {
        const fixture = mount(`<ui-kanban-column-dialog class="${PAINT}" />`, [KanbanColumnDialogComponent]);
        const dialog = fixture.debugElement.children[0].componentInstance as KanbanColumnDialogComponent;
        dialog.openAddColumn();
        fixture.detectChanges();
        await fixture.whenStable();
        const panel = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="dialog-content"]');
        expect(style(panel as Element, 'backgroundColor')).toBe(PAINTED);
    });

    it('ui-rich-text-actions-form paints its host', () => {
        // Bound, not static: a static class attribute lands on the host as plain HTML whether or
        // not the component reads its input, which would let a dead input pass.
        const fixture = mount(`<ui-rich-text-actions-form [class]="paint" />`, [RichTextActionsFormComponent], [], { paint: PAINT });
        const host = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-actions-form"]');
        expect(style(host as Element, 'backgroundColor')).toBe(PAINTED);
    });
});

describe('teardown before the first frame', () => {
    let originalObserver: typeof IntersectionObserver;

    beforeEach(() => {
        originalObserver = globalThis.IntersectionObserver;
    });

    afterEach(() => {
        globalThis.IntersectionObserver = originalObserver;
    });

    it('ui-stagger-children leaves no live IntersectionObserver', async () => {
        let live = 0;
        globalThis.IntersectionObserver = class {
            observe(): void { live++; }
            disconnect(): void { live--; }
            unobserve(): void { /* unused */ }
            takeRecords(): IntersectionObserverEntry[] { return []; }
        } as unknown as typeof IntersectionObserver;

        const fixture = mount(`<ui-stagger-children><p>one</p><p>two</p></ui-stagger-children>`, [StaggerChildrenComponent]);
        fixture.destroy();
        await frames(2);

        expect(live).toBe(0);
    });

    it('ui-marquee leaves no running Web Animation', async () => {
        const before = document.getAnimations().length;
        const fixture = mount(`<ui-marquee><span>news</span></ui-marquee>`, [MarqueeComponent]);
        fixture.destroy();
        await frames(2);

        expect(document.getAnimations()).toHaveLength(before);
    });
});

describe('an overlay destroyed in its opening frame', () => {
    // A row that does leak must not poison the next one.
    afterEach(() => {
        document.body.querySelectorAll('[data-popover-portal]').forEach(el => el.remove());
    });

    const leftovers = (selector: string): string[] =>
        [...document.body.querySelectorAll(selector)].map(el => el.outerHTML.slice(0, 120));

    it('ui-popover (fixed) leaves nothing in document.body', async () => {
        const fixture = mount(
            `<ui-popover [open]="true">
                <ui-popover-trigger>Open</ui-popover-trigger>
                <ui-popover-content strategy="fixed">body</ui-popover-content>
            </ui-popover>`,
            [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
        );
        discard(fixture);
        // portalAndPosition retries up to 10 frames before it falls back to the body portal.
        await frames(14);

        expect(leftovers('[data-popover-portal]')).toEqual([]);
    });

    it('ui-emoji-picker leaves nothing in document.body', async () => {
        const fixture = mount(
            `<ui-emoji-picker [open]="true">
                <ui-emoji-picker-trigger>Open</ui-emoji-picker-trigger>
                <ui-emoji-picker-content />
            </ui-emoji-picker>`,
            [EmojiPickerComponent, EmojiPickerTriggerComponent, EmojiPickerContentComponent],
        );
        discard(fixture);
        await frames(3);

        expect(leftovers('[data-slot="emoji-picker-content"]')).toEqual([]);
    });

    it('ui-autocomplete leaves nothing in document.body', async () => {
        const fixture = mount(`<ui-autocomplete [options]="['Apple', 'Banana']" />`, [AutocompleteComponent]);
        fixture.debugElement.children[0].componentInstance.open.set(true);
        fixture.detectChanges();
        discard(fixture);
        await frames(3);

        expect(leftovers('[data-slot^="autocomplete"], [data-slot="command-list"]')).toEqual([]);
    });
});

describe('a long tooltip at 320px', () => {
    const LONG = 'A tooltip written like a paragraph that nobody should have to scroll sideways to read. '.repeat(4);
    let initialSize: readonly [number, number];

    beforeEach(() => {
        initialSize = [globalThis.innerWidth, globalThis.innerHeight];
    });

    afterEach(async () => {
        document.documentElement.dir = 'ltr';
        await page.viewport(initialSize[0], initialSize[1]);
    });

    const CENTERED = `<div style="display:flex;justify-content:center;padding-top:200px">`;

    /** Hovers a `[uiTooltip]` button and returns the bubble the directive appends to the body. */
    async function openDirectiveTooltip(text: string): Promise<HTMLElement> {
        const fixture = mount(
            `${CENTERED}<button [uiTooltip]="text">Trigger</button></div>`,
            [TooltipDirective],
            [],
            { text },
        );
        (fixture.nativeElement as HTMLElement).querySelector('button')!.dispatchEvent(new MouseEvent('mouseenter'));
        await new Promise(resolve => setTimeout(resolve, 260));
        const bubble = [...document.body.children].find(el => el.textContent === text);
        expect(bubble).toBeDefined();
        return bubble as HTMLElement;
    }

    it.each(['ltr', 'rtl'] as const)('keeps a [uiTooltip] bubble inside the viewport (%s)', async dir => {
        document.documentElement.dir = dir;
        await page.viewport(320, 640);
        const bubble = await openDirectiveTooltip(LONG);

        const rect = bubble.getBoundingClientRect();
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(globalThis.innerWidth);
    });

    /** Shows a `<ui-tooltip>` over a button and returns its bubble. */
    function openSimpleTooltip(text: string): HTMLElement {
        const fixture = mount(
            `${CENTERED}<ui-tooltip><button>Trigger</button><ui-tooltip-content>{{ text }}</ui-tooltip-content></ui-tooltip></div>`,
            [TooltipComponent, TooltipContentComponent],
            [],
            { text },
        );
        fixture.debugElement.query(node => node.name === 'ui-tooltip').componentInstance.show();
        fixture.detectChanges();
        return (fixture.nativeElement as HTMLElement).querySelector('[data-slot="tooltip-content"]') as HTMLElement;
    }

    /** True when the text occupies exactly one line box (padding excluded). */
    function isOneLine(bubble: HTMLElement): boolean {
        const s = getComputedStyle(bubble);
        const textHeight = bubble.getBoundingClientRect().height
            - Number.parseFloat(s.paddingTop) - Number.parseFloat(s.paddingBottom);
        return Math.abs(textHeight - Number.parseFloat(s.lineHeight)) < 1;
    }

    it('keeps a <ui-tooltip> bubble inside the viewport', async () => {
        await page.viewport(320, 640);
        const rect = openSimpleTooltip(LONG).getBoundingClientRect();

        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(globalThis.innerWidth);
    });

    it('still renders a short [uiTooltip] label on one line', async () => {
        await page.viewport(320, 640);
        expect(isOneLine(await openDirectiveTooltip('Save changes'))).toBe(true);
    });

    it('still renders a short <ui-tooltip> label on one line, whatever the trigger width', async () => {
        await page.viewport(320, 640);
        expect(isOneLine(openSimpleTooltip('Save changes'))).toBe(true);
    });
});
