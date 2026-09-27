import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';

/** An addon button with an open panel, shaped like ui-popover renders one. */
@Component({
    standalone: true,
    template: `
        <button type="button" data-testid="panel-trigger">Link</button>
        <div data-slot="popover-content">
            <input data-testid="panel-input" />
            <button type="button" data-testid="panel-ok">Update</button>
        </div>
    `,
})
class PanelProbeComponent {}

/**
 * Browser-only toolbar cases. The roving tab stop only manages controls that
 * are laid out (`offsetParent`), which jsdom reports as null for everything,
 * and the compact frame and the coarse-pointer touch rule are read from the
 * Tailwind stylesheet, which jsdom does not load. They run in the real-browser leg
 * only; the portable (jsdom) leg and the shipped `testFiles` exclude this file.
 */
describe('RichTextToolbarComponent', () => {
    let fixture: ComponentFixture<RichTextToolbarComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextToolbarComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextToolbarComponent);
        fixture.detectChanges();
    });

    describe('keyboard navigation (WAI-ARIA toolbar pattern)', () => {
        const buttonsOf = () =>
            Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

        // A real arrow press comes FROM the focused control, so the handler can
        // read `event.target`. Dispatching on the container instead would test a
        // path the user never takes.
        const pressOnToolbar = (key: string) => {
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const focused = Array.from(
                toolbar.querySelectorAll<HTMLElement>('button, select'),
            ).find(el => el.tabIndex === 0) ?? toolbar;
            focused.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            fixture.detectChanges();
        };

        beforeEach(() => {
            fixture.componentRef.setInput('items', ['bold', 'italic', 'separator', 'underline']);
            fixture.detectChanges();
        });

        it('leaves the arrows to a field inside an addon panel instead of moving the tab stop', async () => {
            // The link panel's URL field lives in the toolbar's DOM, so its
            // arrow presses bubbled to the roving handler, which read them as
            // the first stop's and pulled the focus back onto the toolbar.
            fixture.componentRef.setInput('addonSlots', [
                { id: 'links.insert', component: PanelProbeComponent },
            ]);
            fixture.detectChanges();
            await Promise.resolve();
            const input = fixture.nativeElement.querySelector('[data-testid="panel-input"]') as HTMLInputElement;
            input.focus();
            const press = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
            input.dispatchEvent(press);
            fixture.detectChanges();

            expect(press.defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(input);
            expect(buttonsOf()[0].tabIndex).toBe(0);
        });

        it('leaves the emoji picker\'s panel out of the roving order too', async () => {
            // Its panel is not a ui-popover, so its buttons were roving stops:
            // every emoji became a tab stop and the arrows fought the grid.
            @Component({
                standalone: true,
                template: `
                    <button type="button" data-testid="emoji-trigger">Emoji</button>
                    <div data-slot="emoji-picker-content">
                        <button type="button" data-testid="emoji-a">A</button>
                    </div>
                `,
            })
            class EmojiPanelProbeComponent {}

            fixture.componentRef.setInput('addonSlots', [
                { id: 'emoji.insert', component: EmojiPanelProbeComponent },
            ]);
            fixture.detectChanges();
            await Promise.resolve();
            const emoji = fixture.nativeElement.querySelector('[data-testid="emoji-a"]') as HTMLButtonElement;
            const trigger = fixture.nativeElement.querySelector('[data-testid="emoji-trigger"]') as HTMLButtonElement;

            expect(emoji.tabIndex).toBe(0);
            expect(trigger.tabIndex).toBe(-1);

            const press = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
            emoji.dispatchEvent(press);
            expect(press.defaultPrevented).toBe(false);
        });

        it('keeps an addon panel\'s own buttons out of the roving order and in the Tab order', async () => {
            fixture.componentRef.setInput('addonSlots', [
                { id: 'links.insert', component: PanelProbeComponent },
            ]);
            fixture.detectChanges();
            await Promise.resolve();
            const ok = fixture.nativeElement.querySelector('[data-testid="panel-ok"]') as HTMLButtonElement;
            const trigger = fixture.nativeElement.querySelector('[data-testid="panel-trigger"]') as HTMLButtonElement;
            expect(ok.tabIndex).toBe(0);
            expect(trigger.tabIndex).toBe(-1);

            pressOnToolbar('End');
            expect(trigger.tabIndex).toBe(0);
            expect(ok.tabIndex).toBe(0);
        });

        it('does not trap the tab stop on the text-style select', () => {
            // Skipping the select in the key handler let the arrows move INTO it
            // and never out — a keyboard trap, which is worse than the extra
            // tab stops it was meant to avoid.
            fixture.componentRef.setInput('items', ['bold', 'textStyle', 'italic']);
            fixture.detectChanges();
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const stopsOf = () => Array.from(
                toolbar.querySelectorAll<HTMLElement>('button, select'),
            );
            const activeIndex = () => stopsOf().findIndex(el => el.tabIndex === 0);

            pressOnToolbar('ArrowRight');
            expect(stopsOf()[activeIndex()].tagName.toLowerCase()).toBe('select');

            pressOnToolbar('ArrowRight');
            expect(stopsOf()[activeIndex()].tagName.toLowerCase()).toBe('button');
        });

        it('exposes exactly one tab stop, not one per button', () => {
            const tabbable = buttonsOf().filter(b => b.tabIndex === 0);
            expect(buttonsOf()).toHaveLength(3);
            expect(tabbable).toHaveLength(1);
            expect(tabbable[0]).toBe(buttonsOf()[0]);
        });

        it('moves the tab stop with ArrowRight and wraps at the end', () => {
            pressOnToolbar('ArrowRight');
            expect(buttonsOf()[1].tabIndex).toBe(0);
            expect(buttonsOf()[0].tabIndex).toBe(-1);

            pressOnToolbar('ArrowRight');
            pressOnToolbar('ArrowRight');
            expect(buttonsOf()[0].tabIndex).toBe(0);
        });

        it('moves the tab stop with ArrowLeft and wraps at the start', () => {
            pressOnToolbar('ArrowLeft');
            expect(buttonsOf()[2].tabIndex).toBe(0);
        });

        it('jumps to the first and last button with Home and End', () => {
            pressOnToolbar('End');
            expect(buttonsOf()[2].tabIndex).toBe(0);
            pressOnToolbar('Home');
            expect(buttonsOf()[0].tabIndex).toBe(0);
        });

        it('keeps a single tab stop when a re-render adds the text-style select', async () => {
            // A roving toolbar has ONE tab stop. Managing only the built-in
            // buttons left the select, every addon button and the file input as
            // extra tab stops, so Tab jumped into the middle of the toolbar and
            // the arrows — which index over every button — moved somewhere else
            // again.
            fixture.componentRef.setInput('items', ['bold', 'textStyle', 'italic']);
            fixture.detectChanges();
            // Stops added by a re-render are managed from a MutationObserver,
            // which the browser delivers one microtask later.
            await Promise.resolve();
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const focusables = Array.from(
                toolbar.querySelectorAll<HTMLElement>('button, select, input, [tabindex]'),
            );
            const stops = focusables.filter(el => el.tabIndex === 0);
            expect(focusables.length).toBeGreaterThan(1);
            expect(stops).toHaveLength(1);
        });
    });

    describe('text style select', () => {
        const showSelect = (): HTMLSelectElement => {
            fixture.componentRef.setInput('items', ['textStyle']);
            fixture.detectChanges();
            return fixture.nativeElement.querySelector('[data-slot="rich-text-toolbar-text-style"]');
        };

        // T-36 — a native control still has to meet the 44px touch target the
        // library guarantees; the coarse-pointer rule covers `select` as well
        // as `button`.
        it('meets the 44px touch minimum under a coarse pointer', () => {
            expect(showSelect()).not.toBeNull();

            const rule = Array.from(document.styleSheets)
                .flatMap((sheet) => {
                    try {
                        return Array.from(sheet.cssRules);
                    } catch {
                        return [];
                    }
                })
                .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
                .filter((r) => r.conditionText.includes('pointer: coarse'))
                .flatMap((r) => Array.from(r.cssRules))
                .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
                .find((r) => r.selectorText.includes('select'));

            // 44, not 40: WCAG 2.5.8 and the library's own touch rule.
            expect(rule?.style.minHeight).toBe('44px');
        });
    });

    describe('computed config', () => {
        it('drops the toolbar border and background and tightens its padding when compact', () => {
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const framed = getComputedStyle(toolbar);
            expect(framed.borderBottomWidth).toBe('1px');
            expect(framed.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(framed.paddingTop).toBe('4px');

            fixture.componentRef.setInput('compact', true);
            fixture.detectChanges();

            const compact = getComputedStyle(toolbar);
            expect(compact.borderBottomWidth).toBe('0px');
            expect(compact.backgroundColor).toBe('rgba(0, 0, 0, 0)');
            expect(compact.paddingTop).toBe('2px');
        });
    });
});
