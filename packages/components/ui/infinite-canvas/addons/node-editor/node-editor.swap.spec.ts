// Swapping the graph while typed views are mounted.
import { describe, it, expect, afterEach } from 'vitest';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NodeEditorComponent } from './node-editor.component';
import { NODE_CONTEXT, type NodeContext, type NodeTypeDefinition } from './node-editor.runtime.types';
import type { EditorNode } from './node-editor.types';

interface TextState {
    value: string;
}

@Component({
    selector: 'sb-swap-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<span data-testid="text">{{ ctx.state().value }}</span>`,
})
class TextViewComponent {
    readonly ctx = inject(NODE_CONTEXT) as NodeContext<TextState>;
}

const TEXT: NodeTypeDefinition = {
    id: 'text',
    label: 'Text',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => ({ value: 'seed' }),
    compute: (...[, ctx]) => ({ out: (ctx.state as TextState).value }),
    view: TextViewComponent,
};

function textNode(id: string): EditorNode {
    return { id, type: 'text', x: 20, y: 20, width: 180, height: 0, title: id };
}

@Component({
    standalone: true,
    imports: [NodeEditorComponent],
    template: `<ui-node-editor class="h-[400px] w-[400px]" [nodes]="nodes()" [definitions]="defs" />`,
})
class HostComponent {
    readonly defs = [TEXT];
    readonly nodes = signal<readonly EditorNode[]>([textNode('a'), textNode('b')]);
}

describe('swapping the graph under mounted typed views', () => {
    afterEach(() => TestBed.resetTestingModule());

    it.each([
        ['disjoint ids', ['c', 'd']],
        ['reused ids', ['a', 'b']],
        ['partly reused ids', ['b', 'c']],
    ])('never renders a view without its state (%s)', async (...[, ids]: [string, string[]]) => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        fixture.componentInstance.nodes.set(ids.map(textNode));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const texts = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="text"]')];
        expect(texts.map(t => t.textContent)).toEqual(ids.map(() => 'seed'));
    });
});
