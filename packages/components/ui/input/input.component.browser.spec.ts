import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { InputComponent, InputVariant } from './input.component';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';

/** Browser-only input styling: variants and the prefix row are utility classes, so only computed style and layout show them. */
@Component({
    template: `
        <div style="width: 300px">
            <ui-input [variant]="variant()" [prefix]="prefix()" />
        </div>
    `,
    imports: [InputComponent],
})
class WidthHost {
    readonly variant = input<InputVariant>('outline');
    readonly prefix = input('');
}

@Component({ template: '', imports: [InputComponent] })
class PaddingHost {}

function mount(inputs: { variant?: NonNullable<InputVariant>; prefix?: string } = {}): HTMLElement {
    const fixture = TestBed.createComponent(WidthHost);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

describe('Input rendering', () => {
    it('draws the default outline variant as a rounded, bordered field filling its container', () => {
        const root = mount();
        const field = root.querySelector('input')!;
        const style = getComputedStyle(field);
        expect(style.borderTopWidth).toBe('1px');
        expect(Number.parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
        expect(field.getBoundingClientRect().width).toBeCloseTo(300, 0);
    });

    it.each(['suffix="kg"', '[clearable]="true" value="x"', '[loading]="true"'])('pads the start of a container input exactly like a plain input: %s', (attrs) => {
        TestBed.overrideComponent(PaddingHost, { set: { template: `<ui-input /><ui-input ${attrs} />` } });
        const fixture = TestBed.createComponent(PaddingHost);
        fixture.detectChanges();

        const [regular, container] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'));
        expect(getComputedStyle(container).paddingLeft).toBe(getComputedStyle(regular).paddingLeft);
        expect(getComputedStyle(regular).paddingLeft).not.toBe('0px');
    });

    it('lays the prefix before the input, which fills the rest of the container', () => {
        const root = mount({ prefix: '$' });
        const container = root.querySelector('[data-slot="input-container"]')!.getBoundingClientRect();
        const prefix = root.querySelector('[data-slot="input-container"] span')!.getBoundingClientRect();
        const field = root.querySelector('input')!.getBoundingClientRect();
        expect(field.left).toBeGreaterThanOrEqual(prefix.right);
        expect(field.top).toBeLessThan(prefix.bottom);
        // Only the container's 1px border separates the two right edges.
        expect(container.right - field.right).toBeLessThanOrEqual(1);
    });
});

describe('Input inside an input group', () => {
    function mountInGroup(variant?: InputVariant): HTMLInputElement {
        TestBed.configureTestingModule({
            providers: [{ provide: UI_INPUT_GROUP, useValue: { disabled: () => false } }],
        });
        return mount(variant ? { variant } : {}).querySelector('input')!;
    }

    it('drops the outline border so the group draws the frame', () => {
        expect(getComputedStyle(mountInGroup()).borderTopWidth).toBe('0px');
    });

    it('keeps an explicit underline variant', () => {
        const style = getComputedStyle(mountInGroup('underline'));
        expect(style.borderBottomWidth).toBe('1px');
        expect(style.borderTopWidth).toBe('0px');
    });
});

/**
 * Anything that forces the bordered container layout (clearable, loading, prefix,
 * suffix) must draw its frame from the same effective variant as a plain input:
 * the group owns the border inside a group, and `ghost`/`underline` are honoured.
 */
describe('Input container chrome follows the effective variant', () => {
    const GROUP = { provide: UI_INPUT_GROUP, useValue: { disabled: () => false } };

    function containerStyle(attrs: string, inGroup: boolean): CSSStyleDeclaration {
        if (inGroup) TestBed.configureTestingModule({ providers: [GROUP] });
        TestBed.overrideComponent(PaddingHost, { set: { template: `<ui-input ${attrs} />` } });
        const fixture = TestBed.createComponent(PaddingHost);
        fixture.detectChanges();
        return getComputedStyle((fixture.nativeElement as HTMLElement).querySelector('[data-slot="input-container"]')!);
    }

    it.each(['[clearable]="true" value="x"', '[loading]="true"', 'prefix="$"', 'suffix="kg"'])(
        'draws no frame of its own inside a group, so the group draws the only border: %s',
        (attrs) => {
            const style = containerStyle(attrs, true);
            expect(style.borderTopWidth).toBe('0px');
            expect(style.borderBottomWidth).toBe('0px');
            expect(style.boxShadow).toBe('none');
        },
    );

    it('draws no frame for an explicit ghost variant outside a group', () => {
        const style = containerStyle('variant="ghost" [clearable]="true" value="x"', false);
        expect(style.borderTopWidth).toBe('0px');
        expect(style.boxShadow).toBe('none');
    });

    it('draws only the bottom rule for the underline variant', () => {
        const style = containerStyle('variant="underline" [clearable]="true" value="x"', false);
        expect(style.borderBottomWidth).toBe('1px');
        expect(style.borderTopWidth).toBe('0px');
        expect(style.borderLeftWidth).toBe('0px');
    });

    it('keeps the full border for the default outline variant outside a group', () => {
        const style = containerStyle('[clearable]="true" value="x"', false);
        expect(style.borderTopWidth).toBe('1px');
        expect(style.borderLeftWidth).toBe('1px');
    });
});

describe('Input container frame details', () => {
    const GROUP = { provide: UI_INPUT_GROUP, useValue: { disabled: () => false } };

    function mountContainers(attrs: string[], inGroup = false): HTMLElement {
        if (inGroup) TestBed.configureTestingModule({ providers: [GROUP] });
        TestBed.overrideComponent(PaddingHost, { set: { template: attrs.map(a => `<ui-input ${a} />`).join('') } });
        const fixture = TestBed.createComponent(PaddingHost);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    it('rings and rounds the outline container on focus, and rules the underline one', async () => {
        const root = mountContainers(['[clearable]="true" value="x"', 'variant="underline" [clearable]="true" value="x"']);
        const [outline, underline] = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="input-container"]'));
        const underlineRule = getComputedStyle(underline).borderBottomColor;
        const outlineShadow = getComputedStyle(outline).boxShadow;
        expect(Number.parseFloat(getComputedStyle(outline).borderTopLeftRadius)).toBeGreaterThan(0);
        expect(getComputedStyle(underline).borderTopLeftRadius).toBe('0px');

        outline.querySelector('input')!.focus();
        underline.querySelector('input')!.focus();
        // box-shadow and the rule colour transition, so read them once settled.
        await vi.waitFor(() => {
            expect(getComputedStyle(underline).borderBottomColor).not.toBe(underlineRule);
        });
        underline.querySelector('input')!.blur();
        outline.querySelector('input')!.focus();
        await vi.waitFor(() => {
            // The 3px focus ring, on top of the resting shadow.
            const focused = getComputedStyle(outline).boxShadow;
            expect(focused).not.toBe(outlineShadow);
            expect(focused).toContain('3px');
        });
    });

    it('keeps an explicit underline container as a bottom rule inside a group', () => {
        const root = mountContainers(['variant="underline" [clearable]="true" value="x"'], true);
        const style = getComputedStyle(root.querySelector('[data-slot="input-container"]')!);
        expect(style.borderBottomWidth).toBe('1px');
        expect(style.borderTopWidth).toBe('0px');
    });

    it.each(['ghost', 'underline'])('starts a standalone %s container flush, like a plain input of that variant', (variant) => {
        const root = mountContainers([`variant="${variant}"`, `variant="${variant}" [clearable]="true" value="x"`]);
        const [plain, container] = Array.from(root.querySelectorAll('input'));
        expect(getComputedStyle(plain).paddingLeft).toBe('0px');
        expect(getComputedStyle(container).paddingLeft).toBe('0px');
    });

    it.each([
        { attrs: 'variant="underline" prefix="$" suffix="kg"', inGroup: false, flush: true },
        { attrs: 'variant="ghost" prefix="$" suffix="kg"', inGroup: false, flush: true },
        { attrs: 'prefix="$" suffix="kg"', inGroup: false, flush: false },
        { attrs: 'prefix="$" suffix="kg"', inGroup: true, flush: false },
    ])('places the prefix and suffix against the frame only where one exists: $attrs (group: $inGroup)', ({ attrs, inGroup, flush }) => {
        const root = mountContainers([attrs], inGroup);
        const container = root.querySelector('[data-slot="input-container"]')!.getBoundingClientRect();
        // The text's own box: a span's border box also holds its padding, which is what is under test.
        const [prefix, suffix] = Array.from(root.querySelectorAll('[data-slot="input-container"] span')).map((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getBoundingClientRect();
        });
        const startGap = prefix.left - container.left;
        const endGap = container.right - suffix.right;
        if (flush) {
            expect(startGap).toBeCloseTo(0, 0);
            expect(endGap).toBeCloseTo(0, 0);
        } else {
            expect(startGap).toBeGreaterThan(4);
            expect(endGap).toBeGreaterThan(4);
        }
    });

    it('insets a container input from the group frame, as the group input does', () => {
        const root = mountContainers(['[clearable]="true" value="x"'], true);
        expect(getComputedStyle(root.querySelector('input')!).paddingLeft).not.toBe('0px');
    });
});
