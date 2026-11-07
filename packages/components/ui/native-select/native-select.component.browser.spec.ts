import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { NativeSelectComponent } from './index';

@Component({
    template: `
        <div [style.--density]="density" style="width: 300px">
            <ui-native-select><option value="a">Alpha</option></ui-native-select>
        </div>
    `,
    imports: [NativeSelectComponent],
})
class DensityHost {
    density = '1';
}

function selectStyle(density: string): CSSStyleDeclaration {
    const fixture = TestBed.createComponent(DensityHost);
    fixture.componentInstance.density = density;
    fixture.detectChanges();
    document.body.append(fixture.nativeElement);
    return getComputedStyle(fixture.nativeElement.querySelector('select'));
}

describe('NativeSelect density (browser)', () => {
    it('scales the horizontal padding and chevron gutter with --density', () => {
        const base = selectStyle('1');
        expect(base.paddingLeft).toBe('12px');
        expect(base.paddingRight).toBe('36px');

        const roomy = selectStyle('1.25');
        expect(roomy.paddingLeft).toBe('15px');
        expect(roomy.paddingRight).toBe('45px');
    });
});
