import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    EmptyComponent,
    EmptyHeaderComponent,
    EmptyMediaComponent,
    EmptyTitleComponent,
    EmptyDescriptionComponent,
    EmptyContentComponent
} from './empty.component';

@Component({
    template: `
    <div [dir]="dir()">
      <ui-empty [class]="customClass">
        <ui-empty-header>
          <ui-empty-media [variant]="mediaVariant">
            <svg data-testid="icon"></svg>
          </ui-empty-media>
          <ui-empty-title>No data</ui-empty-title>
          <ui-empty-description>Please add some items.</ui-empty-description>
        </ui-empty-header>
        <ui-empty-content>
          <button>Add Item</button>
        </ui-empty-content>
      </ui-empty>
    </div>
  `,
    imports: [
        EmptyComponent,
        EmptyHeaderComponent,
        EmptyMediaComponent,
        EmptyTitleComponent,
        EmptyDescriptionComponent,
        EmptyContentComponent
    ]
})
class TestHostComponent {
    customClass = '';
    mediaVariant: 'default' | 'icon' = 'default';
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('EmptyComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                TestHostComponent,
                EmptyComponent,
                EmptyHeaderComponent,
                EmptyMediaComponent,
                EmptyTitleComponent,
                EmptyDescriptionComponent,
                EmptyContentComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
    });

    it('should create all parts', () => {
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(EmptyComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(EmptyHeaderComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(EmptyMediaComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(EmptyTitleComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(EmptyDescriptionComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(EmptyContentComponent))).toBeTruthy();
    });

    it('should render correct structure and classes', () => {
        fixture.detectChanges();
        const empty = fixture.debugElement.query(By.css('[data-slot="empty"]'));
        expect(empty).toBeTruthy();
        expect(empty.nativeElement.classList.contains('flex')).toBe(true);
        expect(empty.nativeElement.classList.contains('border-dashed')).toBe(true);

        const title = fixture.debugElement.query(By.css('[data-slot="empty-title"]'));
        expect(title.nativeElement.textContent).toContain('No data');
        expect(title.nativeElement.classList.contains('font-medium')).toBe(true);
    });

    it('should apply custom classes', () => {
        host.customClass = 'my-empty-state';
        fixture.detectChanges();
        const empty = fixture.debugElement.query(By.css('[data-slot="empty"]'));
        expect(empty.nativeElement.classList.contains('my-empty-state')).toBe(true);
    });

    it('should handle media variants', () => {
        host.mediaVariant = 'icon';
        fixture.detectChanges();

        const media = fixture.debugElement.query(By.css('[data-slot="empty-media"]'));
        expect(media.nativeElement.classList.contains('bg-muted')).toBe(true);
        expect(media.nativeElement.classList.contains('rounded-lg')).toBe(true);
    });

    it('should render description with correct styling', () => {
        fixture.detectChanges();
        const desc = fixture.debugElement.query(By.css('[data-slot="empty-description"]'));
        expect(desc.nativeElement.classList.contains('text-muted-foreground')).toBe(true);
        expect(desc.nativeElement.textContent).toContain('Please add some items');
    });

    it('should render content (actions)', () => {
        fixture.detectChanges();
        const content = fixture.debugElement.query(By.css('[data-slot="empty-content"]'));
        expect(content.nativeElement.querySelector('button')).toBeTruthy();
        expect(content.nativeElement.classList.contains('flex-col')).toBe(true);
    });
});
