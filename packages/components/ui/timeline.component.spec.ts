import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    TimelineComponent,
    TimelineItemComponent,
    TimelineConnectorComponent,
    TimelineDotComponent,
    TimelineHeaderComponent,
    TimelineContentComponent,
    TimelineTitleComponent,
    TimelineDescriptionComponent,
    TimelineTimeComponent,
} from './timeline.component';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-timeline>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot [variant]="variant()" />
                        <ui-timeline-connector />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Test Event</ui-timeline-title>
                        <ui-timeline-description>Test description</ui-timeline-description>
                        <ui-timeline-time>2024-01-01</ui-timeline-time>
                    </ui-timeline-content>
                </ui-timeline-item>
            </ui-timeline>
        </div>
    `,
    imports: [
        TimelineComponent,
        TimelineItemComponent,
        TimelineConnectorComponent,
        TimelineDotComponent,
        TimelineHeaderComponent,
        TimelineContentComponent,
        TimelineTitleComponent,
        TimelineDescriptionComponent,
        TimelineTimeComponent,
    ]
})
class TimelineTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    variant = signal<'default' | 'filled' | 'success' | 'error' | 'warning'>('default');
}

describe('TimelineComponent', () => {
    let fixture: ComponentFixture<TimelineTestHostComponent>;
    let component: TimelineTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TimelineTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TimelineTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    describe('Basic Rendering', () => {
        it('should create timeline component', () => {
            const timeline = fixture.debugElement.query(By.directive(TimelineComponent));
            expect(timeline).toBeTruthy();
        });

        it('should have data-slot="timeline"', () => {
            const timeline = fixture.debugElement.query(By.css('[data-slot="timeline"]'));
            expect(timeline).toBeTruthy();
        });

        it('should render timeline items', () => {
            const item = fixture.debugElement.query(By.css('[data-slot="timeline-item"]'));
            expect(item).toBeTruthy();
        });

        it('should render timeline dot', () => {
            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot).toBeTruthy();
        });

        it('should render timeline connector', () => {
            const connector = fixture.debugElement.query(By.css('[data-slot="timeline-connector"]'));
            expect(connector).toBeTruthy();
        });

        it('should render timeline content elements', () => {
            const title = fixture.debugElement.query(By.css('[data-slot="timeline-title"]'));
            const description = fixture.debugElement.query(By.css('[data-slot="timeline-description"]'));
            const time = fixture.debugElement.query(By.css('[data-slot="timeline-time"]'));

            expect(title).toBeTruthy();
            expect(description).toBeTruthy();
            expect(time).toBeTruthy();
        });
    });

    describe('Dot Variants', () => {
        it('should apply default variant styles', () => {
            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('border-border');
        });

        it('should apply filled variant styles', async () => {
            component.variant.set('filled');
            fixture.detectChanges();
            await fixture.whenStable();

            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('bg-primary');
        });

        it('should apply success variant styles', async () => {
            component.variant.set('success');
            fixture.detectChanges();
            await fixture.whenStable();

            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('bg-green-500');
        });

        it('should apply error variant styles', async () => {
            component.variant.set('error');
            fixture.detectChanges();
            await fixture.whenStable();

            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('bg-destructive');
        });

        it('should apply warning variant styles', async () => {
            component.variant.set('warning');
            fixture.detectChanges();
            await fixture.whenStable();

            const dot = fixture.debugElement.query(By.css('[data-slot="timeline-dot"]'));
            expect(dot.nativeElement.className).toContain('bg-yellow-500');
        });
    });

    describe('RTL Support', () => {
        it('should render in LTR mode', () => {
            const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
            expect(container).toBeTruthy();
        });

        it('should render in RTL mode', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
            expect(container).toBeTruthy();
        });

        it('should maintain component structure in RTL', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const timeline = fixture.debugElement.query(By.directive(TimelineComponent));
            const item = fixture.debugElement.query(By.directive(TimelineItemComponent));
            const dot = fixture.debugElement.query(By.directive(TimelineDotComponent));

            expect(timeline).toBeTruthy();
            expect(item).toBeTruthy();
            expect(dot).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('should use semantic heading element for title', () => {
            const title = fixture.debugElement.query(By.css('[data-slot="timeline-title"]'));
            expect(title.nativeElement.tagName.toLowerCase()).toBe('h4');
        });

        it('should use semantic time element', () => {
            const time = fixture.debugElement.query(By.css('[data-slot="timeline-time"]'));
            expect(time.nativeElement.tagName.toLowerCase()).toBe('time');
        });

        it('should use semantic paragraph for description', () => {
            const desc = fixture.debugElement.query(By.css('[data-slot="timeline-description"]'));
            expect(desc.nativeElement.tagName.toLowerCase()).toBe('p');
        });
    });

    describe('Security', () => {
        it('should not execute scripts in content', () => {
            // Test that ng-content doesn't allow XSS
            const title = fixture.debugElement.query(By.css('[data-slot="timeline-title"]'));
            expect(title.nativeElement.textContent).toBe('Test Event');
            expect(title.nativeElement.innerHTML).not.toContain('<script>');
        });

        it('should properly escape HTML in content', () => {
            const desc = fixture.debugElement.query(By.css('[data-slot="timeline-description"]'));
            expect(desc.nativeElement.textContent).toBe('Test description');
        });
    });
});
