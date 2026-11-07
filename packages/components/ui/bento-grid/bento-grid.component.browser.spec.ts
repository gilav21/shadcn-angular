import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { BentoGridComponent, DashboardItem } from './bento-grid.component';

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)` —
 * `Emulation.setEmulatedMedia` silently ignores the `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

@Component({
    template: `<ui-bento-grid [items]="items()" [cols]="4" rowHeight="120px" gap="0px" [editable]="true"
        (itemsChange)="emitted.set($event)" />`,
    imports: [BentoGridComponent],
})
class TouchHost {
    readonly items = signal<DashboardItem[]>([
        { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'Revenue' },
    ]);
    readonly emitted = signal<DashboardItem[] | null>(null);
}

function touch(type: string, target: Element, x: number, y: number): void {
    const point = new Touch({ identifier: 1, target, clientX: x, clientY: y });
    const live = type === 'touchend' ? [] : [point];
    target.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true, touches: live, targetTouches: live, changedTouches: [point],
    }));
}

describe('BentoGridComponent touch drag (browser)', () => {
    afterEach(() => emulateTouch(false));

    async function render() {
        const fixture = TestBed.createComponent(TouchHost);
        fixture.detectChanges();
        await fixture.whenStable();
        const root = fixture.nativeElement as HTMLElement;
        return {
            fixture,
            body: root.querySelector('.bento-item p')!,
            handle: root.querySelector<HTMLElement>('[data-slot="bento-drag-handle"]')!,
        };
    }

    /** Touch screens get a 44x44 grip; a mouse gets none. */
    it('shows the drag handle as a 44x44 target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await render();
        const fineDisplay = getComputedStyle(fine.handle).display;
        fine.fixture.destroy();

        await emulateTouch(true);
        const coarse = await render();
        const rect = coarse.handle.getBoundingClientRect();
        coarse.fixture.destroy();

        expect(fineDisplay).toBe('none');
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
    });

    /** A swipe that starts on the widget body is a page scroll; only the grip moves a widget. */
    it('moves the widget when a touch starts on the handle, not when it starts on the body', async () => {
        await emulateTouch(true);
        const { fixture, body, handle } = await render();
        const grid = fixture.nativeElement.querySelector('.grid') as HTMLElement;
        const far = grid.getBoundingClientRect().left + grid.getBoundingClientRect().width * 0.8;
        const y = grid.getBoundingClientRect().top + 10;

        touch('touchstart', body, 20, 20);
        touch('touchmove', body, far, y);
        touch('touchend', body, far, y);
        expect(fixture.componentInstance.emitted()).toBeNull();

        const grip = handle.getBoundingClientRect();
        touch('touchstart', handle, grip.left + 5, grip.top + 5);
        touch('touchmove', handle, far, y);
        touch('touchend', handle, far, y);
        expect(fixture.componentInstance.emitted()?.[0]).toMatchObject({ id: '1', x: 4 });
        fixture.destroy();
    });
});
