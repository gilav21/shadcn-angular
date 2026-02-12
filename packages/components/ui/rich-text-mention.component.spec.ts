import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextMentionPopoverComponent } from './rich-text-mention.component';

describe('RichTextMentionPopoverComponent', () => {
    let fixture: ComponentFixture<RichTextMentionPopoverComponent>;
    let component: RichTextMentionPopoverComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextMentionPopoverComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextMentionPopoverComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('items', []);
        fixture.detectChanges();
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
        component.close.subscribe(closeSpy);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(closeSpy).toHaveBeenCalledOnce();
    });
});
