import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ToggleGroupComponent } from './toggle-group.component';
import { ToggleGroupItemComponent } from './sub/toggle-group-item.component';

/** Browser-only toggle-group cases: the joined-group geometry, asserted as computed style. */
@Component({
    template: `
        <div [dir]="dir()">
            <ui-toggle-group type="multiple" variant="outline">
                <ui-toggle-group-item value="bold" ariaLabel="Bold">B</ui-toggle-group-item>
                <ui-toggle-group-item value="italic" ariaLabel="Italic">I</ui-toggle-group-item>
                <ui-toggle-group-item value="underline" ariaLabel="Underline">U</ui-toggle-group-item>
            </ui-toggle-group>
        </div>
    `,
    imports: [ToggleGroupComponent, ToggleGroupItemComponent],
})
class OutlineGroupHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

type Ends = 'round' | 'square' | 'mixed';

function ends(style: CSSStyleDeclaration, corners: readonly string[]): Ends {
    const radii = corners.map(corner => Number.parseFloat(style.getPropertyValue(`border-${corner}-radius`)));
    if (radii.every(r => r > 0)) return 'round';
    return radii.every(r => r === 0) ? 'square' : 'mixed';
}

/**
 * The items read left to right on screen: each one's left/right corner state,
 * and the total border width drawn at every join.
 */
function joinProfile(fixture: ComponentFixture<unknown>) {
    const items = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .map(el => getComputedStyle(el));
    const width = (style: CSSStyleDeclaration, edge: string) => Number.parseFloat(style.getPropertyValue(`border-${edge}-width`));
    return {
        corners: items.map(style => [ends(style, ['top-left', 'bottom-left']), ends(style, ['top-right', 'bottom-right'])]),
        joins: items.slice(1).map((style, i) => width(items[i], 'right') + width(style, 'left')),
    };
}

describe('ToggleGroupComponent layout (browser)', () => {
    it.each(['ltr', 'rtl'] as const)('rounds only the outer corners and draws one border per join (%s)', dir => {
        const fixture = TestBed.createComponent(OutlineGroupHost);
        fixture.componentInstance.dir.set(dir);
        fixture.detectChanges();

        expect(joinProfile(fixture)).toEqual({
            corners: [['round', 'square'], ['square', 'square'], ['square', 'round']],
            joins: [1, 1],
        });
    });
});
