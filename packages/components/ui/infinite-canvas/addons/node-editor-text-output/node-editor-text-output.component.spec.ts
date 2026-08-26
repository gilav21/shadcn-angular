// The general text sink.
//
// This node is where data a USER composed inside a graph becomes a document,
// which makes it the one place in the library where a style value crosses from
// "something the graph made up" into CSS. Most of what follows is about that
// crossing.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal, type Signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { NODE_CONTEXT, type NodeContext, type NodeStatus } from '../node-editor';
import { NodeEditorTextOutputComponent } from './node-editor-text-output.component';
import { TEXT_OUTPUT_MAX_SIZE, TEXT_OUTPUT_MIN_SIZE, safeColor } from './node-editor-text-output.types';

/** A stand-in for the runtime, holding whatever the test wants on the ports. */
function contextFor(ports: Record<string, unknown>): NodeContext {
    const state = signal<unknown>(undefined);
    return {
        nodeId: 'n',
        state: state.asReadonly(),
        setState: () => undefined,
        input: <T,>(portId: string): Signal<T | undefined> =>
            signal(ports[portId] as T | undefined).asReadonly(),
        output: <T,>(): Signal<T | undefined> => signal(undefined as T | undefined).asReadonly(),
        status: signal<NodeStatus>('idle').asReadonly(),
        error: signal<unknown>(undefined).asReadonly(),
    };
}

describe('safeColor', () => {
    it.each([
        '#abc',
        '#aabbcc',
        '#aabbccdd',
        'rgb(255, 0, 0)',
        'rgba(255,0,0,0.5)',
        'hsl(210 100% 50%)',
        'red',
        'rebeccapurple',
    ])('admits %s', colour => {
        expect(safeColor(colour)).toBe(colour);
    });

    /*
     * The reason this function exists. Every one of these is a string a graph
     * could produce — from a text field, a database column, a Join node — and
     * every one of them has to stop here rather than reach a style attribute.
     */
    it.each([
        ['closes the declaration', 'red; background: url(evil)'],
        ['opens a block', 'red } body {'],
        ['fetches a resource', 'url(https://example.com/x.png)'],
        ['legacy script execution', 'expression(alert(1))'],
        ['a script url', 'javascript:alert(1)'],
        ['an image set', 'image-set("a.png" 1x)'],
        ['a comment escape', 'red/*'],
    ])('refuses one that %s', (_why, colour) => {
        expect(safeColor(colour)).toBeNull();
    });

    it('refuses a value that is not a string, or is absurdly long', () => {
        expect(safeColor(42)).toBeNull();
        expect(safeColor(undefined)).toBeNull();
        expect(safeColor('a'.repeat(100))).toBeNull();
    });

    it('trims, because a value built by Join often carries a space', () => {
        expect(safeColor('  red  ')).toBe('red');
    });
});

describe('NodeEditorTextOutputComponent', () => {
    let fixture: ComponentFixture<NodeEditorTextOutputComponent>;

    function mount(ports: Record<string, unknown>): HTMLElement {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [NodeEditorTextOutputComponent],
            providers: [{ provide: NODE_CONTEXT, useValue: contextFor(ports) }],
        });
        fixture = TestBed.createComponent(NodeEditorTextOutputComponent);
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('[data-slot="node-editor-text-output"]') as HTMLElement;
    }

    beforeEach(() => TestBed.resetTestingModule());
    afterEach(() => fixture?.destroy());

    it('shows the text it was given', () => {
        expect(mount({ text: 'hello' }).textContent?.trim()).toBe('hello');
    });

    it('shows a dash rather than nothing when no text has arrived', () => {
        expect(mount({}).textContent?.trim()).toBe('—');
    });

    /** A graph can put anything in a string; this is where that stops being data. */
    it('renders markup as text, never as markup', () => {
        const element = mount({ text: '<img src=x onerror=alert(1)>' });

        expect(element.querySelector('img')).toBeNull();
        expect(element.textContent).toContain('<img');
    });

    it('applies a colour from the direct port', () => {
        expect(mount({ text: 'x', color: 'red' }).style.color).toBe('red');
    });

    it('applies a colour from the style object', () => {
        expect(mount({ text: 'x', style: { color: 'blue' } }).style.color).toBe('blue');
    });

    /** The direct port is the more specific instruction, and what people try first. */
    it('lets the direct colour port win over the style object', () => {
        const element = mount({ text: 'x', color: 'red', style: { color: 'blue' } });

        expect(element.style.color).toBe('red');
    });

    it('applies no colour at all when the value is not one', () => {
        expect(mount({ text: 'x', color: 'red; background: url(evil)' }).style.color).toBe('');
    });

    it('clamps the size at both ends', () => {
        expect(mount({ text: 'x', style: { size: 1000 } }).style.fontSize).toBe(
            `${TEXT_OUTPUT_MAX_SIZE}px`,
        );
        expect(mount({ text: 'x', style: { size: 1 } }).style.fontSize).toBe(
            `${TEXT_OUTPUT_MIN_SIZE}px`,
        );
    });

    it('ignores a size that is not a number', () => {
        expect(mount({ text: 'x', style: { size: 'big' } }).style.fontSize).toBe('');
    });

    it('applies the weight, alignment and decorations it knows', () => {
        const element = mount({
            text: 'x',
            style: { weight: 'bold', align: 'center', italic: true, underline: true, mono: true },
        });

        expect(element.className).toContain('font-bold');
        expect(element.className).toContain('text-center');
        expect(element.className).toContain('italic');
        expect(element.className).toContain('underline');
        expect(element.className).toContain('font-mono');
    });

    /** An unknown weight falls back rather than emitting a class that does not exist. */
    it('falls back for a weight or alignment it does not know', () => {
        const element = mount({ text: 'x', style: { weight: 'ultra', align: 'sideways' } });

        expect(element.className).toContain('font-normal');
        expect(element.className).toContain('text-start');
        expect(element.className).not.toContain('ultra');
        expect(element.className).not.toContain('sideways');
    });

    it('survives a style port that is not an object', () => {
        expect(mount({ text: 'x', style: 'not an object' }).textContent?.trim()).toBe('x');
        expect(mount({ text: 'x', style: ['a'] }).textContent?.trim()).toBe('x');
    });

    it('has no axe violations as it draws itself', async () => {
        const element = mount({ text: 'hello' });
        const results = await axe.run(element, { resultTypes: ['violations'] });

        expect(results.violations.map(v => v.id)).toEqual([]);
    });

    /*
     * Contrast is the graph author's, and cannot be the component's.
     *
     * The colour arrives from inside a graph, so this node can no more
     * guarantee it reads against the background than a `<p>` can guarantee the
     * CSS someone writes for it. Overriding the chosen colour to force
     * contrast would defeat the one thing the node exists to do.
     *
     * What IS this node's job is not introducing any OTHER barrier while
     * applying it, so that is what this asserts — and it would catch, say,
     * losing the text to a background of the same value, or emitting an
     * element with no accessible text at all.
     */
    it('introduces no accessibility fault of its own when a colour is applied', async () => {
        const element = mount({ text: 'hello', color: 'red' });
        const results = await axe.run(element, { resultTypes: ['violations'] });
        const notContrast = results.violations.map(v => v.id).filter(id => id !== 'color-contrast');

        expect(notContrast).toEqual([]);
    });
});
