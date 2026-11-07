import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SelectComponent, SelectTriggerComponent } from '../select';

@Component({
    template: `<ui-select><ui-select-trigger [skeleton]="true" /></ui-select>`,
    imports: [SelectComponent, SelectTriggerComponent],
})
class SkeletonHost {}

describe('Select trigger skeleton (browser)', () => {
    it('paints a placeholder with real height and width', () => {
        const fixture = TestBed.createComponent(SkeletonHost);
        fixture.detectChanges();
        fixture.detectChanges();
        document.body.append(fixture.nativeElement);
        const rect = fixture.nativeElement.querySelector('[data-slot="skeleton"]').getBoundingClientRect();
        expect(rect.height).toBe(36);
        expect(rect.width).toBeGreaterThan(100);
    });
});
