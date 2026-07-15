import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextMentionsDirective } from './rich-text-mentions.directive';
import { RichTextMentionPopoverComponent } from './rich-text-mention-popover.component';
import type { MentionItem, TagItem, RichTextEntityRenderOptions } from './rich-text-mentions.types';

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

describe('RichTextMentionsDirective', () => {
    const fixtures: ComponentFixture<unknown>[] = [];

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
});
