// The world-space underlay slot — the base gap the groups addon needed
// (`specs/node-editor-addons-spec.md` §6).
//
// Without it, a group frame that pans and zooms with the plane is impossible
// without forking the canvas template — which is exactly the signal the
// boundary rule predicts.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { InfiniteCanvasComponent, InfiniteCanvasItemDirective } from './index';
import type { CanvasItem } from './infinite-canvas.types';

@Component({
    standalone: true,
    imports: [InfiniteCanvasComponent, InfiniteCanvasItemDirective],
    template: `
    <ui-infinite-canvas class="block h-[400px] w-[400px]" [items]="items()">
      <div uiCanvasUnderlay data-testid="frame" class="absolute" style="left: 20px; top: 30px">
        behind
      </div>
      <ng-template uiInfiniteCanvasItem [ofType]="items()" let-item>
        <div data-testid="item">{{ item.id }}</div>
      </ng-template>
    </ui-infinite-canvas>
  `,
})
class HostComponent {
    readonly items = signal<readonly CanvasItem[]>([
        { id: 'a', x: 0, y: 0, width: 100, height: 60 },
    ]);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('the world-space underlay slot', () => {
    let fixture: ComponentFixture<HostComponent>;

    function wrapper(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="canvas-viewport"]');
    }

    function frame(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-testid="frame"]');
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        await settle();
    });

    afterEach(() => fixture.destroy());

    it('projects the content', () => {
        expect(frame()).not.toBeNull();
    });

    /**
     * Inside the transform wrapper, not beside it. Anything else would need a
     * second wrapper carrying the same transform — a third style write on the
     * hot path, a second composited layer, and two elements that can disagree
     * for a frame during a fling.
     */
    it('puts it inside the ONE transform wrapper, so it cannot desync', () => {
        expect(wrapper().contains(frame())).toBe(true);
    });

    /**
     * DOM order is paint order here: an underlay must not cover the nodes it
     * sits behind.
     */
    it('renders it before the items, so items paint on top', async () => {
        const item = fixture.nativeElement.querySelector('[data-testid="item"]');
        expect(item).not.toBeNull();
        expect(
            frame().compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('pans and zooms with the plane, because it shares the wrapper', async () => {
        const canvas = fixture.debugElement.children[0].componentInstance as InfiniteCanvasComponent;
        const before = frame().getBoundingClientRect().left;

        canvas.panTo({ x: 500, y: 0 });
        await settle();

        expect(frame().getBoundingClientRect().left).not.toBe(before);
    });

    it('is optional — a canvas with no underlay renders exactly as before', async () => {
        const solo = TestBed.createComponent(InfiniteCanvasComponent);
        solo.detectChanges();
        await solo.whenStable();

        expect(
            solo.nativeElement.querySelector('[data-slot="canvas-viewport"]'),
        ).not.toBeNull();
        solo.destroy();
    });
});
