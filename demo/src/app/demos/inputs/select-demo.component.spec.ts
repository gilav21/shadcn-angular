import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SelectDemoComponent } from './select-demo.component';
import { SELECT_DEMO_LOCALES } from './select-demo.locales';

describe('SelectDemoComponent', () => {
    it('renders the disabled-item example and marks the disabled option when opened', () => {
        TestBed.configureTestingModule({ imports: [SelectDemoComponent] });
        const fixture = TestBed.createComponent(SelectDemoComponent);
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement;

        const triggers = el.querySelectorAll<HTMLElement>('ui-select-trigger button[role="combobox"]');
        triggers[triggers.length - 1].click();
        fixture.detectChanges();

        const disabled = el.querySelectorAll('ui-select-content [data-disabled]');
        expect(disabled).toHaveLength(1);
        expect(disabled[0].textContent?.trim()).toBe(SELECT_DEMO_LOCALES['en'].banana);
    });
});
