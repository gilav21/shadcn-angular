import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input } from '@angular/core';
import { UiComponentOutletDirective } from './component-outlet.directive';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    selector: 'mock-dynamic',
    template: `<span>{{ label() }}</span>`,
    standalone: true
})
class MockDynamicComponent {
    label = input('default');
}

@Component({
    template: `<ng-container [uiComponentOutlet]="component" [inputs]="inputs" />`,
    imports: [UiComponentOutletDirective]
})
class TestHostComponent {
    component = MockDynamicComponent;
    inputs: Record<string, unknown> = {};
}

describe('UiComponentOutletDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, MockDynamicComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render the dynamic component', () => {
        const rendered = fixture.nativeElement.querySelector('mock-dynamic');
        expect(rendered).toBeTruthy();
    });

    it('should render default content when no inputs provided', () => {
        const span = fixture.nativeElement.querySelector('mock-dynamic span');
        expect(span.textContent).toBe('default');
    });

    it('should pass inputs to the dynamic component', () => {
        fixture.componentInstance.inputs = { label: 'Hello World' };
        fixture.detectChanges();

        const span = fixture.nativeElement.querySelector('mock-dynamic span');
        expect(span.textContent).toBe('Hello World');
    });
});
