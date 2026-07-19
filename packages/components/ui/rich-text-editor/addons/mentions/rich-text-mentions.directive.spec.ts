import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { RichTextMentionsDirective } from './rich-text-mentions.directive';
import { RichTextMentionPopoverComponent } from './rich-text-mention-popover.component';
import type {
    MentionItem,
    TagItem,
    RichTextEntityRenderOptions,
    RichTextEntitySearchResult,
} from './rich-text-mentions.types';
import { RichTextEditorComponent } from '../..';

type Restore = () => void;

function fixedRect(): DOMRect {
    return {
        x: 10, y: 10, width: 100, height: 18, top: 10, left: 10, right: 110, bottom: 28,
        toJSON: () => ({}),
    } as DOMRect;
}

/** Define a temporary property, returning a closure that restores the original. */
function defineTemp(proto: Record<string, unknown>, key: string, value: unknown): Restore {
    const original = Object.getOwnPropertyDescriptor(proto, key);
    Object.defineProperty(proto, key, { value, configurable: true, writable: true });
    return () => {
        if (original) {
            Object.defineProperty(proto, key, original);
        } else {
            delete proto[key];
        }
    };
}

/**
 * jsdom's Range implements neither getBoundingClientRect nor getClientRects, and
 * throws "Not implemented" for Element.prototype.scrollIntoView (the popover
 * scrolls the active candidate into view on arrow navigation).
 */
function stubRangeRects(): Restore {
    const rangeProto = Range.prototype as unknown as Record<string, unknown>;
    const elementProto = Element.prototype as unknown as Record<string, unknown>;
    const restores = [
        defineTemp(rangeProto, 'getBoundingClientRect', () => fixedRect()),
        defineTemp(rangeProto, 'getClientRects', () => [fixedRect()]),
        defineTemp(elementProto, 'scrollIntoView', () => {}),
        stubResizeObserver(),
    ];
    return () => {
        for (const restore of restores) restore();
    };
}

/** jsdom lacks ResizeObserver, which `ui-scroll-area` (the popover list) constructs. */
function stubResizeObserver(): Restore {
    const globals = globalThis as { ResizeObserver?: unknown };
    const had = 'ResizeObserver' in globals;
    const original = globals.ResizeObserver;
    class StubResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    globals.ResizeObserver = StubResizeObserver;
    return () => {
        if (had) {
            globals.ResizeObserver = original;
        } else {
            delete globals.ResizeObserver;
        }
    };
}

const USERS: MentionItem[] = [
    { id: 'u1', value: 'john-doe', label: 'John Doe', description: 'john.doe@example.com' },
    { id: 'u2', value: 'jane.smith', label: 'Jane Smith' },
];
const TAGS: TagItem[] = [
    { id: 't1', value: 'ux', label: 'UX', color: '#f00' },
    { id: 't2', value: 'angular.ui', label: 'Angular UI' },
];

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextMentionsDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [readonly]="readonly()"
        uiRteMentions
        [uiRteMentionsLocale]="locale()"
        [uiRteMentionsSearch]="mentionSearch"
        [uiRteMentionsRender]="mentionRender()"
        [uiRteTags]="true"
        [uiRteTagsSearch]="tagSearch"
        (mentionInsert)="mentions.push($event)"
        (tagInsert)="tags.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    readonly locale = signal<string | undefined>(undefined);
    readonly mentionRender = signal<RichTextEntityRenderOptions>({ mode: 'chip' });
    readonly mentionSearch = (q: string): MentionItem[] =>
        USERS.filter((u) => u.label.toLowerCase().includes(q.toLowerCase()));
    readonly tagSearch = (q: string): TagItem[] =>
        TAGS.filter((t) => t.label.toLowerCase().includes(q.toLowerCase()));
    mentions: unknown[] = [];
    tags: unknown[] = [];
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextMentionsDirective],
    template: `<ui-rich-text-editor mode="html"
        [uiRteMentions]="mentionsOn()"
        [uiRteMentionsSearch]="search"
        [uiRteTags]="tagsOn()"></ui-rich-text-editor>`,
})
class ToggleHostCmp {
    readonly mentionsOn = signal(true);
    readonly tagsOn = signal(false);
    readonly search = (): MentionItem[] => USERS;
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextMentionsDirective],
    template: `<ui-rich-text-editor mode="html"
        uiRteMentions
        [uiRteMentionsSearch]="search()"></ui-rich-text-editor>`,
})
class SearchHostCmp {
    readonly search = signal<(q: string) => RichTextEntitySearchResult<MentionItem>>(() => USERS);
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextMentionsDirective],
    template: `<ui-rich-text-editor mode="html" uiRteMentions [uiRteTags]="true"></ui-rich-text-editor>`,
})
class DefaultSearchHostCmp {}

describe('RichTextMentionsDirective', () => {
    const fixtures: ComponentFixture<unknown>[] = [];
    let restoreRects: Restore;

    beforeEach(() => {
        restoreRects = stubRangeRects();
    });

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        return fixture;
    }

    function editorOf(fixture: ComponentFixture<HostCmp>): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const cmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const el = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        return { el, cmp };
    }

    function popoverOf(fixture: ComponentFixture<HostCmp>): RichTextMentionPopoverComponent | null {
        const de = fixture.debugElement.query(By.directive(RichTextMentionPopoverComponent));
        return de ? (de.componentInstance as RichTextMentionPopoverComponent) : null;
    }

    function setCaret(node: Node, offset: number): void {
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function type(fixture: ComponentFixture<HostCmp>, text: string): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const ctx = editorOf(fixture);
        ctx.el.textContent = text;
        setCaret(ctx.el.firstChild as Text, text.length);
        ctx.el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        return ctx;
    }

    const wait = (ms = 260): Promise<void> => new Promise((r) => setTimeout(r, ms));

    afterEach(() => {
        for (const f of fixtures) {
            f.nativeElement.remove();
            f.destroy();
        }
        fixtures.length = 0;
        restoreRects();
    });

    it('closes the popover live when both mention and tag triggers are disabled', () => {
        const fixture = TestBed.createComponent(ToggleHostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const el = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        el.textContent = 'Hi @jo';
        setCaret(el.firstChild as Text, 6);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(RichTextMentionPopoverComponent))).toBeTruthy();

        fixture.componentInstance.mentionsOn.set(false);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(RichTextMentionPopoverComponent))).toBeNull();
    });

    it('opens the mention popover for a handle with dots, underscores, and hyphens', () => {
        const fixture = createFixture();
        type(fixture, 'Assign to @john.doe_2-team');
        expect(popoverOf(fixture)).toBeTruthy();
        expect(popoverOf(fixture)!.type()).toBe('mention');
        expect(popoverOf(fixture)!.query()).toBe('john.doe_2-team');
    });

    it('opens the tag popover for a unicode, symbol-friendly tag', () => {
        const fixture = createFixture();
        type(fixture, 'Discuss #привет.мир-2');
        expect(popoverOf(fixture)).toBeTruthy();
        expect(popoverOf(fixture)!.type()).toBe('tag');
        expect(popoverOf(fixture)!.query()).toBe('привет.мир-2');
    });

    it('does not treat an email address as a mention trigger', () => {
        const fixture = createFixture();
        type(fixture, 'Reach me at test@example.com');
        expect(popoverOf(fixture)).toBeNull();
    });

    it('loads search results into the popover after debounce', async () => {
        const fixture = createFixture();
        type(fixture, '@jane');
        await wait();
        fixture.detectChanges();
        const items = popoverOf(fixture)!.items();
        expect(items).toHaveLength(1);
        expect(items[0].label).toBe('Jane Smith');
    });

    it('inserts a mention chip and places the caret outside it, emitting mentionInsert', () => {
        const fixture = createFixture();
        const { el } = type(fixture, '@jo');
        popoverOf(fixture)!.onItemClick({ id: 'u1', value: 'john-doe', label: 'John Doe' });
        fixture.detectChanges();

        const chip = el.querySelector<HTMLElement>('[data-mention="john-doe"]');
        expect(chip).toBeTruthy();
        expect(chip!.getAttribute('contenteditable')).toBe('false');
        expect(chip!.textContent).toBe('@John Doe');
        const anchorParent = document.getSelection()?.anchorNode?.parentElement;
        expect(anchorParent?.hasAttribute('data-mention')).toBe(false);
        expect(fixture.componentInstance.mentions).toHaveLength(1);
    });

    it('renders a mention as a link when the render mode is link', () => {
        const fixture = createFixture();
        fixture.componentInstance.mentionRender.set({
            mode: 'link',
            urlTemplate: 'https://users.example.com/:userId?label=@@label@@',
        });
        fixture.detectChanges();
        const { el } = type(fixture, '@jo');
        popoverOf(fixture)!.onItemClick({ id: 'u1', value: 'john-doe', label: 'John Doe' });
        fixture.detectChanges();

        const link = el.querySelector<HTMLAnchorElement>('a[data-mention="john-doe"]');
        expect(link).toBeTruthy();
        expect(link!.href).toContain('https://users.example.com/u1?label=');
        expect(link!.textContent).toBe('@John Doe');
    });

    it('inserts a tag chip and emits tagInsert', () => {
        const fixture = createFixture();
        const { el } = type(fixture, '#ux');
        popoverOf(fixture)!.onItemClick({ id: 't-9', value: 'ux', label: 'UX' });
        fixture.detectChanges();

        expect(el.querySelector('[data-tag="ux"]')).toBeTruthy();
        expect(fixture.componentInstance.tags).toHaveLength(1);
    });

    it('navigates and selects with the keyboard through the base interceptor', async () => {
        const fixture = createFixture();
        const { el } = type(fixture, '@j');
        await wait();
        fixture.detectChanges();
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        fixture.detectChanges();
        expect(el.querySelector('[data-mention]')).toBeTruthy();
    });

    it('does not open when the editor is readonly', () => {
        const fixture = createFixture();
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        type(fixture, '@jo');
        expect(popoverOf(fixture)).toBeNull();
    });

    it('resolves Hebrew popover strings and the RTL flag', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        type(fixture, '@zzz');
        const popover = popoverOf(fixture)!;
        expect(popover.locale().selectUser).toBe('בחירת משתמש');
        expect(popover.locale().rtl).toBe(true);
    });

    it('closes the popover when the trigger is no longer present', () => {
        const fixture = createFixture();
        type(fixture, '@jo');
        expect(popoverOf(fixture)).toBeTruthy();
        type(fixture, 'plain text');
        expect(popoverOf(fixture)).toBeNull();
    });

    function typeInto(fixture: ComponentFixture<unknown>, text: string): HTMLElement {
        const el = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        el.textContent = text;
        setCaret(el.firstChild as Text, text.length);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        return el;
    }

    function popoverIn(fixture: ComponentFixture<unknown>): RichTextMentionPopoverComponent | null {
        const de = fixture.debugElement.query(By.directive(RichTextMentionPopoverComponent));
        return de ? (de.componentInstance as RichTextMentionPopoverComponent) : null;
    }

    function mountSearchHost(): ComponentFixture<SearchHostCmp> {
        const fixture = TestBed.createComponent(SearchHostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        return fixture;
    }

    it('falls back to the empty default search for mentions and tags', async () => {
        const fixture = TestBed.createComponent(DefaultSearchHostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        typeInto(fixture, '@jo');
        await wait();
        fixture.detectChanges();
        expect(popoverIn(fixture)!.items()).toHaveLength(0);

        typeInto(fixture, '#ux');
        await wait();
        fixture.detectChanges();
        expect(popoverIn(fixture)!.items()).toHaveLength(0);
    });

    it('loads observable search results into the popover', async () => {
        const fixture = mountSearchHost();
        fixture.componentInstance.search.set(() => of(USERS));
        fixture.detectChanges();

        typeInto(fixture, '@j');
        await wait();
        fixture.detectChanges();
        expect(popoverIn(fixture)!.items()).toHaveLength(USERS.length);
    });

    it('loads promise search results into the popover', async () => {
        const fixture = mountSearchHost();
        fixture.componentInstance.search.set(() => Promise.resolve(USERS));
        fixture.detectChanges();

        typeInto(fixture, '@j');
        await wait();
        await Promise.resolve();
        fixture.detectChanges();
        expect(popoverIn(fixture)!.items()).toHaveLength(USERS.length);
    });

    it('recovers from a failing search by showing no candidates', async () => {
        const fixture = mountSearchHost();
        fixture.componentInstance.search.set(() => throwError(() => new Error('boom')) as Observable<MentionItem[]>);
        fixture.detectChanges();

        typeInto(fixture, '@j');
        await wait();
        fixture.detectChanges();
        expect(popoverIn(fixture)!.items()).toHaveLength(0);
    });

    it('ignores non-navigation keys while the popover is open', () => {
        const fixture = createFixture();
        const { el } = type(fixture, '@jo');
        expect(popoverOf(fixture)).toBeTruthy();

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
        expect(popoverOf(fixture)).toBeTruthy();
    });

    it('closes the popover when it signals closed via an outside click', () => {
        const fixture = createFixture();
        type(fixture, '@jo');
        expect(popoverOf(fixture)).toBeTruthy();

        const outside = document.createElement('button');
        document.body.appendChild(outside);
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        expect(popoverOf(fixture)).toBeNull();
        outside.remove();
    });

    it('restores the saved caret when the live selection was cleared before insert', () => {
        const fixture = createFixture();
        const { el } = type(fixture, '@jo');
        document.getSelection()?.removeAllRanges();

        popoverOf(fixture)!.onItemClick({ id: 'u1', value: 'john-doe', label: 'John Doe' });
        fixture.detectChanges();

        expect(el.querySelector('[data-mention="john-doe"]')).toBeTruthy();
    });

    it('appends the entity at the content root when no selection survives to insert time', () => {
        const fixture = createFixture();
        const { el } = type(fixture, '@jo');
        const spy = vi.spyOn(Document.prototype, 'getSelection').mockReturnValue(null);
        try {
            popoverOf(fixture)!.onItemClick({ id: 'u1', value: 'john-doe', label: 'John Doe' });
            fixture.detectChanges();
        } finally {
            spy.mockRestore();
        }
        expect(el.querySelector('[data-mention="john-doe"]')).toBeTruthy();
    });

    it('skips caret positioning when the selection has no range', () => {
        const fixture = createFixture();
        const directive = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .injector.get(RichTextMentionsDirective) as unknown as { updatePosition(): void };
        const spy = vi.spyOn(Document.prototype, 'getSelection')
            .mockReturnValue({ rangeCount: 0 } as unknown as Selection);
        try {
            expect(() => directive.updatePosition()).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('opens without a caret rect when the range rect is degenerate', () => {
        const fixture = createFixture();
        const rangeProto = Range.prototype as unknown as Record<string, unknown>;
        const saved = Object.getOwnPropertyDescriptor(rangeProto, 'getBoundingClientRect');
        const zeroRect = (): DOMRect => ({
            x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}),
        } as DOMRect);
        Object.defineProperty(rangeProto, 'getBoundingClientRect', { value: zeroRect, configurable: true, writable: true });

        try {
            type(fixture, '@jo');
            expect(popoverOf(fixture)).toBeTruthy();
        } finally {
            if (saved) Object.defineProperty(rangeProto, 'getBoundingClientRect', saved);
        }
    });
});
