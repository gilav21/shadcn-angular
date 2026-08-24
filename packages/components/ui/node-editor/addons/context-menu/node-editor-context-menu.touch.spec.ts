// Reaching the menu with a finger.
//
// A right-click is the only way a mouse asks for a context menu, and a finger
// does not have one. Without a long-press, everything these menus offer —
// adding a node, adding a zone, renaming, duplicating, deleting, disconnecting
// — was unreachable on a phone.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
} from '../../../context-menu';
import { NodeEditorComponent } from '../..';
import { NodeEditorContextMenuDirective } from './node-editor-context-menu.directive';
import type { NodeEditorContextTarget } from './node-editor-context-menu.types';
import type { EditorNode } from '../../node-editor.types';

@Component({
    standalone: true,
    imports: [
        NodeEditorComponent,
        NodeEditorContextMenuDirective,
        ContextMenuComponent,
        ContextMenuContentComponent,
        ContextMenuItemComponent,
    ],
    template: `
    <ui-node-editor
      class="h-[400px] w-[400px]"
      [(nodes)]="nodes"
      [uiNodeEditorContextMenu]="menu"
      (contextTarget)="opened.set($event)"
    />
    <ui-context-menu #menu>
      <ui-context-menu-content>
        <ui-context-menu-item>Something</ui-context-menu-item>
      </ui-context-menu-content>
    </ui-context-menu>
  `,
})
class HostComponent {
    readonly nodes = signal<readonly EditorNode[]>([
        { id: 'a', x: 20, y: 20, width: 170, height: 0, title: 'A', ports: [] },
    ]);
    readonly opened = signal<NodeEditorContextTarget | null>(null);
}

function nextFrame(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

describe('long-press opens the context menu', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
        fixture.detectChanges();
    }

    function editorEl(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="node-editor"]');
    }

    function nodeEl(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="node-editor-node"]');
    }

    /**
     * A finger held down on `target`, then the 500ms wait.
     *
     * Real `Touch` objects: Chromium refuses a plain literal in
     * `TouchEventInit`, which is worth knowing before writing any touch test.
     */
    function pressAndHold(target: HTMLElement, x = 60, y = 60): void {
        const touch = new Touch({ identifier: 1, target, clientX: x, clientY: y });
        target.dispatchEvent(
            new TouchEvent('touchstart', {
                bubbles: true,
                cancelable: true,
                touches: [touch],
                changedTouches: [touch],
            }),
        );
        vi.advanceTimersByTime(600);
    }

    beforeEach(async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => {
        vi.useRealTimers();
        fixture.destroy();
    });

    it('resolves empty plane from a held finger', async () => {
        pressAndHold(editorEl(), 300, 300);
        await settle();

        expect(host.opened()?.kind).toBe('canvas');
    });

    it('resolves the node a finger was held on', async () => {
        pressAndHold(nodeEl(), 40, 40);
        await settle();

        expect(host.opened()).toMatchObject({ kind: 'node', nodeId: 'a' });
    });

    it('reports the world point, so a node lands where the finger was', async () => {
        pressAndHold(editorEl(), 250, 150);
        await settle();

        expect(host.opened()?.at).toBeDefined();
        expect(host.opened()?.screen).toEqual({ x: 250, y: 150 });
    });

    /**
     * Android raises `contextmenu` for a long-press as well; iOS does not.
     * Handling both without a guard opened the menu twice on one platform.
     */
    it('ignores the contextmenu echo that follows on some platforms', async () => {
        pressAndHold(editorEl(), 300, 300);
        await settle();
        host.opened.set(null);

        editorEl().dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 300, clientY: 300,
        }));
        await settle();

        expect(host.opened()).toBeNull();
    });

    it('still opens on a right-click well after any long-press', async () => {
        editorEl().dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 120, clientY: 120,
        }));
        await settle();

        expect(host.opened()?.kind).toBe('canvas');
    });

    /**
     * The finger is already holding the node by the time the press becomes
     * long. Leaving that drag live means the graph moves behind the menu you
     * opened in order to act on it.
     */
    it('gives up the drag the finger had started', async () => {
        const node = nodeEl();
        const at = () => host.nodes()[0];

        // A finger goes down on the node: pointerdown starts the drag,
        // touchstart starts the long-press clock.
        node.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, button: 0, pointerId: 1,
            pointerType: 'touch', isPrimary: true, clientX: 40, clientY: 40,
        }));
        pressAndHold(node, 40, 40);
        await settle();
        expect(host.opened()?.kind).toBe('node');

        const before = { x: at().x, y: at().y };

        // The finger drifts after the menu opened. The node must not follow.
        node.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, cancelable: true, pointerId: 1,
            pointerType: 'touch', isPrimary: true, clientX: 220, clientY: 200,
        }));
        await settle();

        expect({ x: at().x, y: at().y }).toEqual(before);
    });
});
