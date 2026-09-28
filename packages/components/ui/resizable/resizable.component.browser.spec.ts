import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { ResizablePanelGroupComponent, ResizablePanelComponent, ResizableHandleComponent } from './index';

/** Browser-only resizable layout: rendered rects and resolved rotation, which jsdom cannot produce. */
@Component({
    template: `
    <div style="width:400px; height:200px">
      <ui-resizable-panel-group direction="horizontal">
        <ui-resizable-panel [defaultSize]="50">A</ui-resizable-panel>
        <ui-resizable-handle [withHandle]="true"></ui-resizable-handle>
        <ui-resizable-panel [defaultSize]="50">B</ui-resizable-panel>
      </ui-resizable-panel-group>
    </div>
    <div style="width:400px; height:200px">
      <ui-resizable-panel-group direction="vertical">
        <ui-resizable-panel [defaultSize]="50">C</ui-resizable-panel>
        <ui-resizable-handle [withHandle]="true"></ui-resizable-handle>
        <ui-resizable-panel [defaultSize]="50">D</ui-resizable-panel>
      </ui-resizable-panel-group>
    </div>
  `,
    imports: [ResizablePanelGroupComponent, ResizablePanelComponent, ResizableHandleComponent]
})
class WithHandleHostComponent { }

/** A group inside a local `dir="rtl"` container, on a page that stays LTR. */
@Component({
    template: `
    <div dir="rtl" style="width:400px; height:200px">
      <ui-resizable-panel-group direction="horizontal">
        <ui-resizable-panel [defaultSize]="50">Start</ui-resizable-panel>
        <ui-resizable-handle></ui-resizable-handle>
        <ui-resizable-panel [defaultSize]="50">End</ui-resizable-panel>
      </ui-resizable-panel-group>
    </div>
  `,
    imports: [ResizablePanelGroupComponent, ResizablePanelComponent, ResizableHandleComponent]
})
class LocalRtlHostComponent { }

/** The element's resolved rotation in degrees, whether it comes from `rotate` or `transform`. */
function rotationOf(el: Element): number {
    const style = getComputedStyle(el);
    if (style.rotate && style.rotate !== 'none') return Number.parseFloat(style.rotate);
    if (style.transform === 'none') return 0;
    const m = new DOMMatrix(style.transform);
    return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
}

describe('Resizable grip/handle rendering (browser)', () => {
    it('sizes the divider by handleSize across the group axis and turns the vertical grip', async () => {
        const fixture = TestBed.createComponent(WithHandleHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const [horizontal, vertical] = Array.from(
            fixture.nativeElement.querySelectorAll('[data-slot="resizable-handle"]'),
        ) as HTMLElement[];
        expect(horizontal.getBoundingClientRect().width).toBe(4);
        expect(vertical.getBoundingClientRect().height).toBe(4);

        expect(rotationOf(horizontal.querySelector('svg')!)).toBe(0);
        expect(rotationOf(vertical.querySelector('svg')!)).toBe(90);
    });
});

describe('Resizable RTL (browser)', () => {
    it("mirrors arrow keys and drags by the handle's own direction, not the page's", async () => {
        expect(getComputedStyle(document.documentElement).direction).toBe('ltr');
        const fixture = TestBed.createComponent(LocalRtlHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const handle = root.querySelector('[data-slot="resizable-handle"]') as HTMLElement;
        const group = root.querySelector('[data-slot="resizable-panel-group"]') as HTMLElement;
        const startEl = root.querySelector('[data-slot="resizable-panel"]') as HTMLElement;
        const start = fixture.debugElement.query(By.directive(ResizablePanelComponent))
            .componentInstance as ResizablePanelComponent;

        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
        fixture.detectChanges();
        expect(start.size()).toBe(55);

        // Dragging 40px to the left grows the start panel (on the right in RTL) by 40px.
        const expected = ((startEl.offsetWidth + 40) / group.offsetWidth) * 100;
        handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, clientY: 0, bubbles: true, cancelable: true }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 0 }));
        document.dispatchEvent(new MouseEvent('mouseup'));
        fixture.detectChanges();
        expect(start.size()).toBeCloseTo(expected, 5);
    });
});
