// The world-space underlay — the base gap the groups addon needed
// (`specs/node-editor-addons-spec.md` §6).
//
// This spec exists because the underlay showed up empty in a browser and the
// obvious suspect was double projection — the editor's slot is itself
// projected into `ui-infinite-canvas`. That theory was wrong: a probe proved
// re-projection works, and the browser had simply been serving a stale bundle.
// The test is here anyway, because "the underlay renders" was exactly the
// assertion missing when a browser was the only thing that could tell.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import type { EditorNode } from './node-editor.types';

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `
    <ui-node-editor class="h-[400px] w-[400px]" [nodes]="nodes()">
      <div uiNodeEditorUnderlay class="contents">
        <div data-testid="frame" class="absolute" [style.left.px]="120" [style.top.px]="80">
          behind
        </div>
      </div>
    </ui-node-editor>
  `,
})
class HostComponent {
    readonly nodes = signal<readonly EditorNode[]>([
        { id: 'a', x: 0, y: 0, width: 170, height: 60, title: 'A' },
    ]);
}

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `<ui-node-editor class="h-[400px] w-[400px]" [nodes]="nodes()" />`,
})
class BareHostComponent {
    readonly nodes = signal<readonly EditorNode[]>([
        { id: 'a', x: 0, y: 0, width: 170, height: 60, title: 'A' },
    ]);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('the world-space underlay', () => {
    let fixture: ComponentFixture<HostComponent>;

    function frame(): HTMLElement | null {
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

    it('actually renders the projected content', () => {
        expect(frame()).not.toBeNull();
    });

    it('renders it inside the canvas transform, so it pans with the plane', () => {
        const wrapper = fixture.nativeElement.querySelector('[data-slot="canvas-viewport"]');
        expect(wrapper.contains(frame())).toBe(true);
    });

    /**
     * DOM order is paint order: an underlay must not cover the nodes it sits
     * behind.
     */
    it('renders it before the node cards, so nodes paint on top', () => {
        const card = fixture.nativeElement.querySelector('[data-slot="node-editor-node"]');
        expect(card).not.toBeNull();
        expect(
            (frame() as HTMLElement).compareDocumentPosition(card) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('is optional — an editor with no underlay renders as before', async () => {
        const bare = TestBed.createComponent(BareHostComponent);
        bare.detectChanges();
        await bare.whenStable();
        await nextFrame();
        bare.detectChanges();

        expect(bare.nativeElement.querySelector('[data-slot="node-editor-node"]')).not.toBeNull();
        expect(bare.nativeElement.querySelector('[data-testid="frame"]')).toBeNull();
        bare.destroy();
    });
});
