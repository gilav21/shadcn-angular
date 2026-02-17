import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal, output, ComponentRef } from '@angular/core';
import { UiComponentOutletDirective } from './component-outlet.directive';
import { describe, it, expect, beforeEach, vi } from 'vitest';

@Component({
    selector: 'mock-dynamic',
    template: `<span>{{ label() }}</span>`,
    standalone: true
})
class MockDynamicComponent {
    label = input('default');
}

@Component({
    selector: 'mock-alternate',
    template: `<div class="alternate">{{ text() }}</div>`,
    standalone: true
})
class MockAlternateComponent {
    text = input('alternate default');
}

@Component({
    selector: 'mock-with-output',
    template: `<button (click)="clicked.emit('payload')">Click</button>`,
    standalone: true
})
class MockWithOutputComponent {
    clicked = output<string>();
}

@Component({
    template: `<ng-container
        [uiComponentOutlet]="component()"
        [inputs]="inputs()"
        [outputs]="outputs()"
        (initialized)="onInitialized($event)"
    />`,
    imports: [UiComponentOutletDirective]
})
class TestHostComponent {
    component = signal<any>(MockDynamicComponent);
    inputs = signal<Record<string, unknown>>({});
    outputs = signal<Record<string, (event: any) => void>>({});
    onInitialized = vi.fn();
}

describe('UiComponentOutletDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, MockDynamicComponent, MockAlternateComponent, MockWithOutputComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
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

    it('should pass inputs to the dynamic component', async () => {
        host.inputs.set({ label: 'Hello World' });
        fixture.detectChanges();
        await fixture.whenStable();

        const span = fixture.nativeElement.querySelector('mock-dynamic span');
        expect(span.textContent).toBe('Hello World');
    });

    describe('component switching', () => {
        it('should render a different component when component input changes', async () => {
            expect(fixture.nativeElement.querySelector('mock-dynamic')).toBeTruthy();
            expect(fixture.nativeElement.querySelector('mock-alternate')).toBeFalsy();

            host.component.set(MockAlternateComponent);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelector('mock-dynamic')).toBeFalsy();
            expect(fixture.nativeElement.querySelector('mock-alternate')).toBeTruthy();
        });

        it('should apply inputs to the new component after switching', async () => {
            host.component.set(MockAlternateComponent);
            host.inputs.set({ text: 'switched content' });
            fixture.detectChanges();
            await fixture.whenStable();

            const div = fixture.nativeElement.querySelector('.alternate');
            expect(div.textContent).toBe('switched content');
        });

        it('should destroy previous component when switching', async () => {
            const firstRendered = fixture.nativeElement.querySelector('mock-dynamic');
            expect(firstRendered).toBeTruthy();

            host.component.set(MockAlternateComponent);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelector('mock-dynamic')).toBeFalsy();
        });
    });

    describe('output handling', () => {
        it('should subscribe to outputs and invoke the handler when emitted', async () => {
            const clickHandler = vi.fn();

            host.component.set(MockWithOutputComponent);
            host.outputs.set({ clicked: clickHandler });
            fixture.detectChanges();
            await fixture.whenStable();

            const button = fixture.nativeElement.querySelector('button');
            expect(button).toBeTruthy();

            button.click();
            fixture.detectChanges();

            expect(clickHandler).toHaveBeenCalledWith('payload');
        });

        it('should update output subscriptions when outputs input changes', async () => {
            const firstHandler = vi.fn();
            const secondHandler = vi.fn();

            host.component.set(MockWithOutputComponent);
            host.outputs.set({ clicked: firstHandler });
            fixture.detectChanges();
            await fixture.whenStable();

            const button = fixture.nativeElement.querySelector('button');
            button.click();
            fixture.detectChanges();
            expect(firstHandler).toHaveBeenCalledTimes(1);

            host.outputs.set({ clicked: secondHandler });
            fixture.detectChanges();
            await fixture.whenStable();

            button.click();
            fixture.detectChanges();
            expect(secondHandler).toHaveBeenCalledTimes(1);
        });
    });

    describe('initialized output', () => {
        it('should emit initialized with a ComponentRef on first render', () => {
            expect(host.onInitialized).toHaveBeenCalledTimes(1);
            const emittedRef = host.onInitialized.mock.calls[0][0] as ComponentRef<any>;
            expect(emittedRef).toBeTruthy();
            expect(emittedRef.instance).toBeInstanceOf(MockDynamicComponent);
        });

        it('should emit initialized again when component is switched', async () => {
            host.onInitialized.mockClear();

            host.component.set(MockAlternateComponent);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(host.onInitialized).toHaveBeenCalledTimes(1);
            const emittedRef = host.onInitialized.mock.calls[0][0] as ComponentRef<any>;
            expect(emittedRef.instance).toBeInstanceOf(MockAlternateComponent);
        });
    });
});
