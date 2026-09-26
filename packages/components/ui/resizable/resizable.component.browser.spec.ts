import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
