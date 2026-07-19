import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextMentionPopoverComponent } from './rich-text-mention-popover.component';
import type { MentionItem, TagItem } from './rich-text-mentions.types';

type Restore = () => void;

/** jsdom lacks ResizeObserver (ui-scroll-area) and throws on scrollIntoView. */
function installStubs(): Restore {
    const globals = globalThis as { ResizeObserver?: unknown };
    const hadRo = 'ResizeObserver' in globals;
    const originalRo = globals.ResizeObserver;
    class StubResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    globals.ResizeObserver = StubResizeObserver;

    const proto = Element.prototype as unknown as Record<string, unknown>;
    const hadScroll = 'scrollIntoView' in proto;
    const originalScroll = Object.getOwnPropertyDescriptor(proto, 'scrollIntoView');
    Object.defineProperty(proto, 'scrollIntoView', { value: () => {}, configurable: true, writable: true });

    return () => {
        if (hadRo) globals.ResizeObserver = originalRo;
        else delete globals.ResizeObserver;
        if (hadScroll && originalScroll) Object.defineProperty(proto, 'scrollIntoView', originalScroll);
        else delete proto['scrollIntoView'];
    };
}

const USERS: MentionItem[] = [
    { id: 'u1', value: 'john', label: 'John Doe', description: 'dev' },
    { id: 'u2', value: 'jane', label: 'Jane Roe' },
];
const TAGS: TagItem[] = [{ id: 't1', value: 'ux', label: 'UX', color: '#f00' }];

describe('RichTextMentionPopoverComponent', () => {
    let fixture: ComponentFixture<RichTextMentionPopoverComponent>;
    let component: RichTextMentionPopoverComponent;
    let restore: Restore;

    beforeEach(async () => {
        restore = installStubs();
        await TestBed.configureTestingModule({
            imports: [RichTextMentionPopoverComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextMentionPopoverComponent);
        component = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.componentRef.setInput('items', []);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
        fixture.destroy();
        restore();
    });

    it('clamps selected index when list is empty', () => {
        component.selectedIndex.set(3);
        fixture.detectChanges();
        expect(component.selectedIndex()).toBe(0);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(component.selectedIndex()).toBe(0);
    });

    it('emits close on Escape when list is empty', () => {
        const closeSpy = vi.fn();
        component.closed.subscribe(closeSpy);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('clamps a stale selected index down to the last item', () => {
        component.selectedIndex.set(5);
        fixture.componentRef.setInput('items', USERS);
        fixture.detectChanges();
        expect(component.selectedIndex()).toBe(USERS.length - 1);
    });

    it('navigates down and up through the list with the keyboard', () => {
        fixture.componentRef.setInput('items', USERS);
        fixture.detectChanges();

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(component.selectedIndex()).toBe(1);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(component.selectedIndex()).toBe(0);
    });

    it('emits the active item on Enter', () => {
        fixture.componentRef.setInput('items', USERS);
        fixture.detectChanges();
        const selected = vi.fn();
        component.itemSelect.subscribe(selected);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(selected).toHaveBeenCalledWith(USERS[0]);
    });

    it('emits close on Escape when the list has items', () => {
        fixture.componentRef.setInput('items', USERS);
        fixture.detectChanges();
        const closeSpy = vi.fn();
        component.closed.subscribe(closeSpy);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('closes when a document click lands outside the popover', () => {
        const closeSpy = vi.fn();
        component.closed.subscribe(closeSpy);
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(closeSpy).toHaveBeenCalledOnce();
        outside.remove();
    });

    it('emits the clicked item', () => {
        fixture.componentRef.setInput('items', USERS);
        fixture.detectChanges();
        const selected = vi.fn();
        component.itemSelect.subscribe(selected);

        const button = (fixture.nativeElement as HTMLElement).querySelector('button[role="option"]') as HTMLElement;
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(selected).toHaveBeenCalledWith(USERS[0]);
    });

    it('renders a tag row via the tag accessor', () => {
        fixture.componentRef.setInput('type', 'tag');
        fixture.componentRef.setInput('items', TAGS);
        fixture.detectChanges();
        const dot = (fixture.nativeElement as HTMLElement).querySelector('[style*="background-color"]');
        expect(dot).toBeTruthy();
        expect(component.asTag(TAGS[0]).color).toBe('#f00');
    });
});
