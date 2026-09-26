import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    StepperComponent,
    StepperItemComponent,
    StepperTriggerComponent,
    StepperTitleComponent,
    StepperDescriptionComponent,
    StepperContentComponent,
} from './index';

// Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-stepper [(activeStep)]="activeStep" [linear]="linear()" [orientation]="orientation()">
                <ui-stepper-item value="step-1">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Account</ui-stepper-title>
                        <ui-stepper-description>Create account</ui-stepper-description>
                    </ui-stepper-trigger>
                    <ui-stepper-content>Step 1 content</ui-stepper-content>
                </ui-stepper-item>
                <ui-stepper-item value="step-2">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Profile</ui-stepper-title>
                        <ui-stepper-description>Set up profile</ui-stepper-description>
                    </ui-stepper-trigger>
                    <ui-stepper-content>Step 2 content</ui-stepper-content>
                </ui-stepper-item>
                <ui-stepper-item value="step-3">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Complete</ui-stepper-title>
                    </ui-stepper-trigger>
                    <ui-stepper-content>Step 3 content</ui-stepper-content>
                </ui-stepper-item>
            </ui-stepper>
        </div>
    `,
    imports: [
        StepperComponent,
        StepperItemComponent,
        StepperTriggerComponent,
        StepperTitleComponent,
        StepperDescriptionComponent,
        StepperContentComponent,
    ]
})
class StepperTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    activeStep = signal(0);
    linear = signal(false);
    orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

describe('StepperComponent', () => {
    let fixture: ComponentFixture<StepperTestHostComponent>;
    let component: StepperTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [StepperTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(StepperTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    describe('Basic Rendering', () => {
        it('should render stepper titles', () => {
            const titles = fixture.debugElement.queryAll(By.css('[data-slot="stepper-title"]'));
            expect(titles).toHaveLength(3);
        });
    });

    describe('Step Status', () => {
        it('should update status when activeStep changes', async () => {
            component.activeStep.set(1);
            fixture.detectChanges();
            await fixture.whenStable();

            const items = fixture.debugElement.queryAll(By.css('[data-slot="stepper-item"]'));
            expect(items[0].nativeElement.dataset.status).toBe('complete');
            expect(items[1].nativeElement.dataset.status).toBe('current');
            expect(items[2].nativeElement.dataset.status).toBe('pending');
        });
    });

    describe('Step Content', () => {
        it('should change content when step changes', async () => {
            component.activeStep.set(1);
            fixture.detectChanges();
            await fixture.whenStable();

            const contents = fixture.debugElement.queryAll(By.css('[data-slot="stepper-content"]'));
            expect(contents).toHaveLength(1);
            expect(contents[0].nativeElement.textContent).toContain('Step 2 content');
        });
    });

    describe('Navigation', () => {
        it('should navigate to step on trigger click', async () => {
            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            triggers[1].nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.activeStep()).toBe(1);
        });

        it('should prevent navigation in linear mode', async () => {
            component.linear.set(true);
            fixture.detectChanges();

            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            triggers[2].nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.activeStep()).toBe(0); // Should not change
        });

        it('should allow navigation to previous steps in linear mode', async () => {
            component.linear.set(true);
            component.activeStep.set(2);
            fixture.detectChanges();

            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            triggers[0].nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.activeStep()).toBe(0);
        });
    });

    describe('Orientation', () => {
        it('should switch to vertical orientation', async () => {
            const stepper = fixture.debugElement.query(By.css('[data-slot="stepper"]'));
            expect(stepper.nativeElement.dataset.orientation).toBe('horizontal');

            component.orientation.set('vertical');
            fixture.detectChanges();
            await fixture.whenStable();

            expect(stepper.nativeElement.dataset.orientation).toBe('vertical');
        });
    });

    describe('Accessibility', () => {
        it('renders the stepper as a native ordered list (implicit role="list")', () => {
            const stepper = fixture.debugElement.query(By.css('[data-slot="stepper"]'));
            expect(stepper.nativeElement.tagName).toBe('OL');
        });

        it('marks each projected step as a list item (role="listitem")', () => {
            const items = fixture.debugElement.queryAll(By.css('[role="listitem"]'));
            expect(items).toHaveLength(3);
        });

        it('should have focusable trigger buttons', () => {
            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            triggers.forEach(trigger => {
                expect(trigger.nativeElement.tagName.toLowerCase()).toBe('button');
            });
        });

        it('should have disabled buttons for inaccessible steps in linear mode', async () => {
            component.linear.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
            expect(triggers[2].nativeElement.disabled).toBe(true);
        });
    });
});

// Test host for simple mode (data-driven)
@Component({
    template: `
        <ui-stepper 
            [steps]="steps()" 
            [(activeStep)]="activeStep"
            [orientation]="orientation()"
            (stepChange)="onStepChange($event)"
        />
    `,
    imports: [StepperComponent]
})
class SimpleModeTestHostComponent {
    steps = signal([
        { value: 'step-1', title: 'Account', description: 'Create account' },
        { value: 'step-2', title: 'Profile', description: 'Set up profile' },
        { value: 'step-3', title: 'Complete' },
    ]);
    activeStep = signal(0);
    orientation = signal<'horizontal' | 'vertical'>('horizontal');
    lastStepChange = signal(-1);

    onStepChange(step: number) {
        this.lastStepChange.set(step);
    }
}

describe('Stepper Simple Mode (Data-Driven)', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;
    let component: SimpleModeTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render step titles from config', () => {
        const titles = fixture.debugElement.queryAll(By.css('[data-slot="stepper-title"]'));
        expect(titles).toHaveLength(3);
        expect(titles[0].nativeElement.textContent).toContain('Account');
        expect(titles[1].nativeElement.textContent).toContain('Profile');
        expect(titles[2].nativeElement.textContent).toContain('Complete');
    });

    it('should render descriptions when provided', () => {
        const items: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-slot="stepper-item"]'));
        const descriptionOf = (item: HTMLElement) =>
            item.querySelector('[data-slot="stepper-description"]')?.textContent?.trim() ?? null;
        expect(items.map(descriptionOf)).toEqual(['Create account', 'Set up profile', null]);
    });

    it('should update status when activeStep changes', async () => {
        component.activeStep.set(1);
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="stepper-item"]'));
        expect(items[0].nativeElement.dataset.status).toBe('complete');
        expect(items[1].nativeElement.dataset.status).toBe('current');
    });

    it('should emit stepChange on click', async () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
        triggers[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.lastStepChange()).toBe(1);
    });

    it('should render a connector after every step but the last, coloured once the step is complete', async () => {
        // The connector is the item wrapper's trailing sibling inside each <li>.
        const connectors = (): HTMLElement[] =>
            Array.from(fixture.nativeElement.querySelectorAll('li > [data-slot="stepper-item"] + div'));
        expect(connectors()).toHaveLength(2);
        expect(connectors().map(c => c.classList.contains('bg-primary'))).toEqual([false, false]);

        component.activeStep.set(1);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(connectors().map(c => c.classList.contains('bg-primary'))).toEqual([true, false]);

        component.orientation.set('vertical');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(connectors()).toHaveLength(0);
    });
});
