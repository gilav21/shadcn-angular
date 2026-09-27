import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { CodeBlockComponent } from '../code-block';

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

async function renderBlock(inputs: Record<string, unknown>): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(CodeBlockComponent);
    for (const [name, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
}

/** The control a tap at (x, y) lands on, or `null` when it lands outside every element matching `selector`. */
function tapTarget(x: number, y: number, selector: string): Element | null {
    return document.elementFromPoint(x, y)?.closest(selector) ?? null;
}

const TWO_FUNCTIONS = [
    'function first() {',
    '  return 1;',
    '}',
    '',
    'function second() {',
    '  return 2;',
    '}',
].join('\n');

const SOURCE = [
    'export function totalFor(orders: Order[]): number {',
    '  let sum = 0;',
    '  for (const order of orders) {',
    `    sum += order.lines.reduce((acc, line) => acc + line.quantity * line.unitPrice * (1 - line.discount) + line.shipping + line.handlingFee, 0); // ${'x'.repeat(120)}`,
    '  }',
    '  return sum;',
    '}',
    '',
    'export const empty = totalFor([]);',
    'export const one = totalFor([sample]);',
    'export const many = totalFor(all);',
    'export default totalFor;',
].join('\n');

/** Real-browser layout checks: hit-area size and line geometry are layout, which jsdom cannot compute. */
describe('CodeBlockComponent layout (browser)', () => {
    afterEach(() => emulateTouch(false));

    /** WCAG 2.5.8: the copy button is a 44x44 target on a touch screen, and stays the compact 24x24 for a mouse. */
    it('sizes the copy button 44x44 on a coarse pointer and 24x24 on a fine one', async () => {
        const measure = async () =>
            (await renderBlock({ code: SOURCE })).querySelector('ui-button button')!.getBoundingClientRect();

        await emulateTouch(false);
        const fine = await measure();
        await emulateTouch(true);
        const coarse = await measure();

        expect([fine.width, fine.height]).toEqual([24, 24]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });

    /**
     * A line wider than the block overflows its flex row; the gutter decorations
     * must not shrink to make room, or that line's code starts left of its
     * neighbours.
     */
    it('starts every line\'s code at the same x, however long the line', async () => {
        const host = await renderBlock({ code: SOURCE, collapseScope: true });
        const lines = Array.from(host.querySelectorAll<HTMLElement>('code > div'));
        const codeStarts = lines.map(line => line.lastElementChild!.getBoundingClientRect().left);
        const gutterWidths = lines.map(line =>
            line.querySelector('[data-slot="code-block-line-number"]')!.getBoundingClientRect().width,
        );

        expect(lines).toHaveLength(12);
        expect(lines[3].scrollWidth).toBeGreaterThan(lines[3].clientWidth);
        expect(new Set(codeStarts).size).toBe(1);
        expect(new Set(gutterWidths).size).toBe(1);
    });

    /**
     * WCAG 2.5.8: a fold chevron sits in a 16px column on a 20px line. On a
     * touch screen a tap anywhere in the 44x44 box around it must reach it;
     * a mouse user keeps the narrow gutter.
     */
    it('gives each fold chevron a 44x44 hit area on a coarse pointer and keeps the 16px column on a fine one', async () => {
        const selector = '[data-slot="code-block-chevron"][role="button"]';
        await emulateTouch(false);
        const fine = await renderBlock({ code: TWO_FUNCTIONS, collapseScope: true });
        const fineWidth = fine.querySelector(selector)!.getBoundingClientRect().width;
        fine.remove();
        await emulateTouch(true);
        const host = await renderBlock({ code: TWO_FUNCTIONS, collapseScope: true });
        const chevrons = Array.from(host.querySelectorAll<HTMLElement>(selector));

        expect(fineWidth).toBe(16);
        expect(chevrons).toHaveLength(2);
        for (const chevron of chevrons) {
            const r = chevron.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            expect([
                tapTarget(x - 21, y, selector),
                tapTarget(x + 21, y, selector),
                tapTarget(x, y - 21, selector),
                tapTarget(x, y + 21, selector),
            ]).toEqual([chevron, chevron, chevron, chevron]);
        }
        // ...and only that box: the code beside it, and the empty slot of a plain line, stay untouched.
        const lines = Array.from(host.querySelectorAll<HTMLElement>('code > div'));
        const code = lines[1].lastElementChild!.getBoundingClientRect();
        const plainSlot = lines[3].querySelector('[data-slot="code-block-chevron"]')!.getBoundingClientRect();
        expect(tapTarget(code.left + 8, code.top + code.height / 2, selector)).toBeNull();
        expect(tapTarget(plainSlot.left + plainSlot.width / 2, plainSlot.top + plainSlot.height / 2, selector)).toBeNull();
    });
});
