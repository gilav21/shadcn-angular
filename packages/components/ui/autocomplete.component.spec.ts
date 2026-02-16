import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AutocompleteComponent } from './autocomplete.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';

interface Fruit {
    name: string;
    value: string;
}

const fruits: Fruit[] = [
    { name: 'Apple', value: 'apple' },
    { name: 'Banana', value: 'banana' },
    { name: 'Cherry', value: 'cherry' },
    { name: 'Date', value: 'date' },
    { name: 'Elderberry', value: 'elderberry' },
];

@Component({
    template: `
        <ui-autocomplete
            [options]="options"
            [displayWith]="displayWith"
            [placeholder]="placeholder()"
            [multiple]="multiple()"
            [disabled]="disabled()"
        />
    `,
    imports: [AutocompleteComponent]
})
class TestHostComponent {
    options: Fruit[] = fruits;
    displayWith = (opt: Fruit) => opt?.name ?? '';
    placeholder = signal('Select a fruit...');
    multiple = signal(false);
    disabled = signal(false);
}

describe('AutocompleteComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [provideNoopAnimations()]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render the autocomplete container', () => {
        const container = fixture.debugElement.query(By.css('[data-state]'));
        expect(container).toBeTruthy();
    });

    it('should display the placeholder text', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.placeholder).toBe('Select a fruit...');
    });

    it('should apply disabled state', async () => {
        host.disabled.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[data-disabled]'));
        expect(container).toBeTruthy();
    });

    it('should not show disabled attribute when not disabled', () => {
        host.disabled.set(false);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[data-state]'));
        expect(container.nativeElement.getAttribute('data-disabled')).toBeNull();
    });

    it('should render in single mode by default', () => {
        const input = fixture.debugElement.query(By.css('input[role="combobox"]'));
        expect(input).toBeTruthy();
    });
});
