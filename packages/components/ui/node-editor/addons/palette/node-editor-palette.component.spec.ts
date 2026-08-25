// The palette picker — `specs/node-editor-addons-spec.md` §2.
//
// It takes the type list and emits a choice; it never touches the editor,
// which is why every test here constructs a palette and nothing else.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NodeEditorPaletteComponent, type NodeTypePicked } from './node-editor-palette.component';
import type { NodeTypeDefinition } from '../..';

const TYPES: NodeTypeDefinition[] = [
    {
        id: 'read-csv',
        label: 'Read CSV',
        category: 'Source',
        accent: '#22c55e',
        ports: [{ id: 'rows', direction: 'out', label: 'Rows', type: 'table' }],
    },
    {
        id: 'filter',
        label: 'Filter',
        category: 'Transform',
        ports: [
            { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
            { id: 'out', direction: 'out', label: 'Kept', type: 'table' },
        ],
    },
    {
        id: 'uppercase',
        label: 'Uppercase',
        category: 'Transform',
        ports: [
            { id: 'in', direction: 'in', label: 'Text', type: 'text' },
            { id: 'out', direction: 'out', label: 'Text', type: 'text' },
        ],
    },
];

@Component({
    standalone: true,
    imports: [NodeEditorPaletteComponent],
    template: `
    <ui-node-editor-palette
      #palette
      [definitions]="definitions"
      [(open)]="open"
      [acceptsType]="acceptsType()"
      shortcut=""
      (picked)="picked.set($event)"
    />
  `,
})
class HostComponent {
    readonly definitions = TYPES;
    readonly open = signal(false);
    readonly acceptsType = signal<string | undefined>(undefined);
    readonly picked = signal<NodeTypePicked | null>(null);
}

describe('NodeEditorPaletteComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function palette(): NodeEditorPaletteComponent {
        return fixture.debugElement.children[0].componentInstance as NodeEditorPaletteComponent;
    }

    /** The dialog renders into an overlay, so query the document. */
    function items(): HTMLElement[] {
        return [...document.querySelectorAll<HTMLElement>('[data-slot="node-editor-palette-item"]')];
    }

    /*
     * The test hooks sit on the host <ui-command-item>, but ui-command-item
     * listens on the role="option" row it renders inside that host. A real
     * click lands on the row and bubbles up; dispatching one on the host
     * instead exercises a path no user can take — which is how the palette
     * shipped keyboard-dead while these tests stayed green.
     */
    function row(item: HTMLElement): HTMLElement {
        return item.querySelector<HTMLElement>('[role="option"]')!;
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('opening', () => {
        it('starts closed and renders nothing', () => {
            expect(items()).toHaveLength(0);
        });

        it('opens and lists every registered type', async () => {
            host.open.set(true);
            await settle();
            expect(items()).toHaveLength(3);
        });

        it('openAt remembers the world point the node was asked for', async () => {
            palette().openAt({ x: 240, y: 90 });
            await settle();

            row(items().find(i => i.dataset['type'] === 'filter')!).click();
            await settle();

            // The point travels with the choice, so the node lands where the
            // user double-clicked rather than at some default.
            expect(host.picked()).toEqual({ typeId: 'filter', at: { x: 240, y: 90 } });
        });

        /*
         * The palette is opened from a keyboard shortcut, so arriving at it
         * without a mouse is the normal case, not the edge case. ui-command-item
         * answers Enter by emitting `selectItem` — it never dispatches a DOM
         * click — so a consumer bound to (click) gets a list that highlights
         * under the arrow keys and then refuses to pick anything.
         */
        it('picks with the keyboard, not just the mouse', async () => {
            palette().openAt({ x: 12, y: 34 });
            await settle();

            row(items().find(i => i.dataset['type'] === 'filter')!).dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
            await settle();

            expect(host.picked()).toEqual({ typeId: 'filter', at: { x: 12, y: 34 } });
        });

        it('openAnywhere reports no point, leaving placement to the consumer', async () => {
            palette().openAnywhere();
            await settle();

            row(items()[0]).click();
            await settle();
            expect(host.picked()?.at).toBeNull();
        });
    });

    describe('choosing', () => {
        beforeEach(async () => {
            host.open.set(true);
            await settle();
        });

        it('emits the type that was chosen', async () => {
            row(items().find(i => i.dataset['type'] === 'uppercase')!).click();
            await settle();
            expect(host.picked()?.typeId).toBe('uppercase');
        });

        it('closes afterwards', async () => {
            row(items()[0]).click();
            await settle();
            expect(host.open()).toBe(false);
        });

        it('does not insert anything itself — it only reports', async () => {
            // The addon has no reference to an editor at all, which is the
            // boundary rule made structural rather than promised.
            row(items()[0]).click();
            await settle();
            expect(host.picked()).not.toBeNull();
        });
    });

    describe('showing what a type is', () => {
        beforeEach(async () => {
            host.open.set(true);
            await settle();
        });

        it('shows each type’s port shape, so it is readable without opening it', () => {
            const filter = items().find(i => i.dataset['type'] === 'filter');
            expect(filter?.querySelector('[data-slot="node-editor-palette-ports"]')?.textContent)
                .toContain('table → table');
        });

        it('groups by category', () => {
            const text = document.body.textContent ?? '';
            expect(text).toContain('Source');
            expect(text).toContain('Transform');
        });
    });

    describe('filtering by what a type can accept', () => {
        it('offers only types that could take the value', async () => {
            host.acceptsType.set('table');
            host.open.set(true);
            await settle();

            expect(items().map(i => i.dataset['type'])).toEqual(['filter']);
        });

        it('offers nothing when no type can take it, rather than everything', async () => {
            host.acceptsType.set('geometry');
            host.open.set(true);
            await settle();

            expect(items()).toHaveLength(0);
        });
    });
});
