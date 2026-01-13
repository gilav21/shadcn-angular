import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonGroupComponent, ButtonGroupTextComponent, ButtonGroupSeparatorComponent } from './button-group.component';
import { ButtonComponent } from './button.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host component for integration tests
@Component({
    template: `
        <ui-button-group [orientation]="orientation()" [class]="groupClass">
            <ui-button variant="outline">Left</ui-button>
            <ui-button variant="outline">Center</ui-button>
            <ui-button variant="outline">Right</ui-button>
        </ui-button-group>
    `,
    imports: [ButtonGroupComponent, ButtonComponent]
})
class TestHostComponent {
    orientation = signal<'horizontal' | 'vertical'>('horizontal');
    groupClass = '';
}

// RTL Test host component
@Component({
    template: `
        <div [dir]="dir()">
            <ui-button-group>
                <ui-button variant="outline">First</ui-button>
                <ui-button variant="outline">Second</ui-button>
                <ui-button variant="outline">Third</ui-button>
            </ui-button-group>
        </div>
    `,
    imports: [ButtonGroupComponent, ButtonComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('ButtonGroupComponent', () => {
    let component: ButtonGroupComponent;
    let fixture: ComponentFixture<ButtonGroupComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonGroupComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ButtonGroupComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="button-group"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="button-group"]'));
        expect(div).toBeTruthy();
    });

    it('should have role="group"', () => {
        const div = fixture.debugElement.query(By.css('[role="group"]'));
        expect(div).toBeTruthy();
    });

    it('should apply horizontal orientation by default', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.attributes['data-orientation']).toBe('horizontal');
        expect(div.nativeElement.className).not.toContain('flex-col');
    });

    it('should apply vertical orientation classes', () => {
        fixture.componentRef.setInput('orientation', 'vertical');
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.attributes['data-orientation']).toBe('vertical');
        expect(div.nativeElement.className).toContain('flex-col');
    });

    it('should apply base flex classes', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('flex');
        expect(div.nativeElement.className).toContain('w-fit');
        expect(div.nativeElement.className).toContain('items-stretch');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-custom-group');
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('my-custom-group');
    });
});

describe('ButtonGroupTextComponent', () => {
    let component: ButtonGroupTextComponent;
    let fixture: ComponentFixture<ButtonGroupTextComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonGroupTextComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ButtonGroupTextComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="button-group-text"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="button-group-text"]'));
        expect(div).toBeTruthy();
    });

    it('should apply default classes', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('bg-muted');
        expect(div.nativeElement.className).toContain('rounded-md');
        expect(div.nativeElement.className).toContain('border');
    });
});

describe('ButtonGroupSeparatorComponent', () => {
    let component: ButtonGroupSeparatorComponent;
    let fixture: ComponentFixture<ButtonGroupSeparatorComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonGroupSeparatorComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ButtonGroupSeparatorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="button-group-separator"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="button-group-separator"]'));
        expect(div).toBeTruthy();
    });

    it('should have role="separator"', () => {
        const div = fixture.debugElement.query(By.css('[role="separator"]'));
        expect(div).toBeTruthy();
    });

    it('should apply vertical orientation by default', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.attributes['data-orientation']).toBe('vertical');
        expect(div.nativeElement.className).toContain('w-px');
    });

    it('should apply horizontal orientation classes', () => {
        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.attributes['data-orientation']).toBe('horizontal');
        expect(div.nativeElement.className).toContain('h-px');
    });
});

describe('ButtonGroup Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render button group with buttons', () => {
        const group = fixture.debugElement.query(By.directive(ButtonGroupComponent));
        const buttons = fixture.debugElement.queryAll(By.directive(ButtonComponent));

        expect(group).toBeTruthy();
        expect(buttons.length).toBe(3);
    });

    it('should switch orientation correctly', async () => {
        component.orientation.set('vertical');
        fixture.detectChanges();
        await fixture.whenStable();

        const groupDiv = fixture.debugElement.query(By.css('[data-slot="button-group"]'));
        expect(groupDiv.nativeElement.className).toContain('flex-col');
    });
});

describe('ButtonGroup RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        // Reset document direction
        document.documentElement.removeAttribute('dir');
    });

    it('should render correctly in LTR mode', () => {
        const buttons = fixture.debugElement.queryAll(By.directive(ButtonComponent));
        expect(buttons.length).toBe(3);

        // Verify DOM order is maintained (First, Second, Third)
        expect(buttons[0].nativeElement.textContent.trim()).toBe('First');
        expect(buttons[1].nativeElement.textContent.trim()).toBe('Second');
        expect(buttons[2].nativeElement.textContent.trim()).toBe('Third');

        // Verify container is LTR
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render correctly in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
        expect(container.nativeElement.getAttribute('dir')).toBe('rtl');
    });

    it('should maintain proper button order in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const buttons = fixture.debugElement.queryAll(By.directive(ButtonComponent));

        // First DOM button should still be "First" in RTL
        expect(buttons[0].nativeElement.textContent.trim()).toBe('First');
        expect(buttons[2].nativeElement.textContent.trim()).toBe('Third');
    });

    it('should apply horizontal flex layout in RTL (flex-row-reverse not needed)', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const groupDiv = fixture.debugElement.query(By.css('[data-slot="button-group"]'));

        // ButtonGroup uses flex, CSS handles RTL automatically
        expect(groupDiv.nativeElement.className).toContain('flex');
        expect(groupDiv.nativeElement.className).not.toContain('flex-col');
    });
});
