import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Directive, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { InputGroupComponent } from './input-group.component';
import { InputGroupInputComponent } from './sub/input-group-input.component';
import { InputGroupAddonComponent } from './sub/input-group-addon.component';
import { InputGroupTextComponent } from './sub/input-group-text.component';
import { UI_INPUT_GROUP, type UiInputGroupContext } from '../../lib/input-group.token';

@Directive({ selector: '[testInjectGroup]' })
class InjectGroupDirective {
    readonly group: UiInputGroupContext = inject(UI_INPUT_GROUP);
}

@Component({
    template: `
    <ui-input-group>
      <ui-input-group-addon>$</ui-input-group-addon>
      <ui-input-group-input [formControl]="control" placeholder="Amount" />
      <ui-input-group-addon>USD</ui-input-group-addon>
    </ui-input-group>
  `,
    imports: [
        InputGroupComponent,
        InputGroupInputComponent,
        InputGroupAddonComponent,
        ReactiveFormsModule
    ]
})
class TestHostComponent {
    control = new FormControl('');
}

describe('InputGroupComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                TestHostComponent,
                InputGroupComponent,
                InputGroupInputComponent,
                InputGroupAddonComponent,
                InputGroupTextComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
    });

    it('should create all parts', () => {
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(InputGroupComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(InputGroupInputComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(InputGroupAddonComponent))).toBeTruthy();
    });

    it('should structure content correctly', () => {
        fixture.detectChanges();
        const group = fixture.debugElement.query(By.css('[data-slot="input-group"]'));
        expect(group.nativeElement.tagName).toBe('FIELDSET');
        expect(group.nativeElement.classList.contains('flex')).toBe(true);
        expect(group.nativeElement.classList.contains('items-center')).toBe(true);

        const addons = fixture.debugElement.queryAll(By.css('[data-slot="input-group-addon"]'));
        expect(addons).toHaveLength(2);
    });

    it('should bind to FormControl (InputGroupInput)', async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        const input = fixture.debugElement.query(By.css('input'));
        input.nativeElement.value = '100';
        input.nativeElement.dispatchEvent(new Event('input'));

        fixture.detectChanges();
        expect(fixture.componentInstance.control.value).toBe('100');
    });
});

@Component({
    template: `
      <ui-input-group [disabled]="disabled" [variant]="variant" class="custom-group">
        <span testInjectGroup>child</span>
      </ui-input-group>
    `,
    imports: [InputGroupComponent, InjectGroupDirective]
})
class VariantHostComponent {
    disabled = false;
    variant: 'outline' | 'underline' | 'ghost' = 'outline';
}

describe('InputGroupComponent variants and DI', () => {
    let fixture: ComponentFixture<VariantHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [VariantHostComponent, InputGroupComponent, InjectGroupDirective]
        }).compileComponents();
        fixture = TestBed.createComponent(VariantHostComponent);
    });

    it('exposes the group context via UI_INPUT_GROUP (resolves forwardRef)', () => {
        fixture.detectChanges();
        const dir = fixture.debugElement.query(By.directive(InjectGroupDirective))
            .injector.get(InjectGroupDirective);
        expect(dir.group).toBeInstanceOf(InputGroupComponent);
        expect(dir.group.disabled()).toBe(false);
    });

    it('applies disabled classes when disabled', () => {
        fixture.componentInstance.disabled = true;
        fixture.detectChanges();
        const group = fixture.debugElement.query(By.css('[data-slot="input-group"]'));
        expect(group.nativeElement.classList.contains('opacity-50')).toBe(true);
        expect(group.nativeElement.classList.contains('cursor-not-allowed')).toBe(true);
    });

    it('does not apply disabled classes when enabled and merges custom class', () => {
        fixture.detectChanges();
        const group = fixture.debugElement.query(By.css('[data-slot="input-group"]'));
        expect(group.nativeElement.classList.contains('opacity-50')).toBe(false);
        expect(group.nativeElement.classList.contains('custom-group')).toBe(true);
    });

    it('reflects the underline variant class', () => {
        fixture.componentInstance.variant = 'underline';
        fixture.detectChanges();
        const group = fixture.debugElement.query(By.css('[data-slot="input-group"]'));
        expect(group.nativeElement.classList.contains('border-b')).toBe(true);
    });
});

@Component({
    template: `<ui-input-group-text class="custom-text">Static</ui-input-group-text>`,
    imports: [InputGroupTextComponent]
})
class TextHostComponent {}

describe('InputGroupTextComponent', () => {
    let fixture: ComponentFixture<TextHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TextHostComponent, InputGroupTextComponent]
        }).compileComponents();
        fixture = TestBed.createComponent(TextHostComponent);
    });

    it('renders projected text with muted styling and custom class', () => {
        fixture.detectChanges();
        const text = fixture.debugElement.query(By.css('[data-slot="input-group-text"]'));
        expect(text.nativeElement.textContent.trim()).toBe('Static');
        expect(text.nativeElement.classList.contains('text-muted-foreground')).toBe(true);
        expect(text.nativeElement.classList.contains('text-sm')).toBe(true);
        expect(text.nativeElement.classList.contains('custom-text')).toBe(true);
    });
});
