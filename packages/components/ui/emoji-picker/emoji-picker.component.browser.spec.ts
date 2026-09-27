import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { EmojiPickerComponent } from './emoji-picker.component';
import { EmojiPickerTriggerComponent } from './sub/emoji-picker-trigger.component';
import { EmojiPickerContentComponent } from './sub/emoji-picker-content.component';

/** Browser-only: the fixed strategy is asserted as rendered geometry and computed style. */
@Component({
    template: `
        <div style="padding: 40px">
            <ui-emoji-picker>
                <ui-emoji-picker-trigger>Open</ui-emoji-picker-trigger>
                <ui-emoji-picker-content strategy="fixed" />
            </ui-emoji-picker>
        </div>
    `,
    imports: [EmojiPickerComponent, EmojiPickerTriggerComponent, EmojiPickerContentComponent],
})
class FixedHost {}

const frame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));

describe('EmojiPickerContentComponent — fixed strategy (real layout)', () => {
    it('stays hidden until measured, then pins the panel 4px below the trigger', async () => {
        await TestBed.configureTestingModule({ imports: [FixedHost] }).compileComponents();
        const fixture = TestBed.createComponent(FixedHost);
        fixture.detectChanges();
        const picker: EmojiPickerComponent = fixture.debugElement
            .query(By.directive(EmojiPickerComponent)).componentInstance;

        picker.open.set(true);
        fixture.detectChanges();
        const panel: HTMLElement = fixture.nativeElement.querySelector('[data-slot="emoji-picker-content"]');
        expect(getComputedStyle(panel).visibility).toBe('hidden');

        await frame();
        fixture.detectChanges();
        await fixture.whenStable();
        panel.getAnimations().forEach(a => a.finish());

        const trigger = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="emoji-picker-trigger"]')!.getBoundingClientRect();
        const rect = panel.getBoundingClientRect();
        expect(getComputedStyle(panel).visibility).toBe('visible');
        expect(getComputedStyle(panel).position).toBe('fixed');
        expect(Math.abs(rect.top - (trigger.bottom + 4))).toBeLessThan(1);
        expect(Math.abs(rect.left - trigger.left)).toBeLessThan(1);
    });
});

class ResizeObserverStub {
    observe(): void {
        /* no-op */
    }
    unobserve(): void {
        /* no-op */
    }
    disconnect(): void {
        /* no-op */
    }
}

@Component({
    template: `
        <div data-testid="clipper" style="overflow: hidden; width: 200px; height: 60px;">
            <ui-emoji-picker>
                <ui-emoji-picker-trigger>Open</ui-emoji-picker-trigger>
                <ui-emoji-picker-content />
            </ui-emoji-picker>
        </div>
    `,
    imports: [EmojiPickerComponent, EmojiPickerTriggerComponent, EmojiPickerContentComponent],
})
class ClippedHostComponent {}

describe('EmojiPickerContentComponent — top layer', () => {
    let fixture: ComponentFixture<ClippedHostComponent>;
    let picker: EmojiPickerComponent;

    const globalWithRO = globalThis as unknown as { ResizeObserver: unknown };
    const protoWithScroll = Element.prototype as unknown as { scrollTo: (arg?: unknown) => void };
    const originalResizeObserver = globalWithRO.ResizeObserver;
    const originalScrollTo = protoWithScroll.scrollTo;

    const twoFrames = (): Promise<void> =>
        new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    beforeEach(async () => {
        globalWithRO.ResizeObserver = ResizeObserverStub;
        protoWithScroll.scrollTo = (): void => {
            /* the test browser's smooth scroll is irrelevant here */
        };

        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({ imports: [ClippedHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(ClippedHostComponent);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        picker = fixture.debugElement.query(By.directive(EmojiPickerComponent)).componentInstance;
    });

    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
        globalWithRO.ResizeObserver = originalResizeObserver;
        protoWithScroll.scrollTo = originalScrollTo;
    });

    it('escapes an overflow:hidden ancestor and leaves nothing behind on close', async () => {
        picker.show();
        fixture.detectChanges();
        await twoFrames();
        fixture.detectChanges();

        const panel = fixture.nativeElement.querySelector(
            '[data-slot="emoji-picker-content"]'
        ) as HTMLElement;
        expect(panel).toBeTruthy();
        expect(panel.matches(':popover-open')).toBe(true);
        expect(panel.style.position).toBe('fixed');

        picker.hide();
        fixture.detectChanges();

        expect(panel.hasAttribute('popover')).toBe(false);
        expect(panel.matches(':popover-open')).toBe(false);
    });

    it('still picks an emoji from the promoted panel', async () => {
        const picked: string[] = [];
        picker.emojiSelect.subscribe(value => picked.push(value));

        picker.show();
        fixture.detectChanges();
        await twoFrames();
        fixture.detectChanges();

        const panel = fixture.nativeElement.querySelector(
            '[data-slot="emoji-picker-content"]'
        ) as HTMLElement;
        expect(panel.matches(':popover-open')).toBe(true);

        const firstEmoji = panel.querySelector('.grid button') as HTMLButtonElement;
        firstEmoji.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        expect(picked).toEqual([firstEmoji.textContent?.trim()]);
        expect(picker.open()).toBe(false);
    });
});
