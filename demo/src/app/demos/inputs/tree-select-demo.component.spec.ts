import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TreeSelectDemoComponent } from './tree-select-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TREE_SELECT_DEMO_LOCALES } from './tree-select-demo.locales';

describe('TreeSelectDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [TreeSelectDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(TreeSelectDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(TREE_SELECT_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [TreeSelectDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(TreeSelectDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(TREE_SELECT_DEMO_LOCALES['he'].heading);
        });
    });
});
