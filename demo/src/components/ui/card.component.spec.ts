import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent } from './card.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host component for integration tests
@Component({
    template: `
        <ui-card>
            <ui-card-header>
                <ui-card-title>Card Title</ui-card-title>
                <ui-card-description>Card Description</ui-card-description>
            </ui-card-header>
            <ui-card-content>Card Content</ui-card-content>
            <ui-card-footer>Card Footer</ui-card-footer>
        </ui-card>
    `,
    imports: [CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent]
})
class TestHostComponent { }

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-card>
                <ui-card-header>
                    <ui-card-title>عنوان البطاقة</ui-card-title>
                </ui-card-header>
                <ui-card-content>محتوى البطاقة</ui-card-content>
            </ui-card>
        </div>
    `,
    imports: [CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('CardComponent', () => {
    let component: CardComponent;
    let fixture: ComponentFixture<CardComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CardComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="card"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('card');
    });

    it('should apply default classes', () => {
        expect(fixture.nativeElement.className).toContain('bg-card');
        expect(fixture.nativeElement.className).toContain('rounded-xl');
        expect(fixture.nativeElement.className).toContain('border');
        expect(fixture.nativeElement.className).toContain('shadow-sm');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-card');
        fixture.detectChanges();
        expect(fixture.nativeElement.className).toContain('my-card');
    });
});

describe('CardHeaderComponent', () => {
    let fixture: ComponentFixture<CardHeaderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CardHeaderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CardHeaderComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="card-header"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('card-header');
    });

    it('should apply grid layout classes', () => {
        expect(fixture.nativeElement.className).toContain('grid');
        expect(fixture.nativeElement.className).toContain('px-6');
    });
});

describe('CardTitleComponent', () => {
    let fixture: ComponentFixture<CardTitleComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CardTitleComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CardTitleComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="card-title"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('card-title');
    });

    it('should apply font classes', () => {
        expect(fixture.nativeElement.className).toContain('font-semibold');
    });
});

describe('CardDescriptionComponent', () => {
    let fixture: ComponentFixture<CardDescriptionComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CardDescriptionComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CardDescriptionComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="card-description"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('card-description');
    });

    it('should apply muted text classes', () => {
        expect(fixture.nativeElement.className).toContain('text-muted-foreground');
        expect(fixture.nativeElement.className).toContain('text-sm');
    });
});

describe('CardContentComponent', () => {
    let fixture: ComponentFixture<CardContentComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CardContentComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CardContentComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="card-content"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('card-content');
    });

    it('should apply padding classes', () => {
        expect(fixture.nativeElement.className).toContain('px-6');
    });
});

describe('CardFooterComponent', () => {
    let fixture: ComponentFixture<CardFooterComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CardFooterComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CardFooterComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="card-footer"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('card-footer');
    });

    it('should apply flex layout', () => {
        expect(fixture.nativeElement.className).toContain('flex');
        expect(fixture.nativeElement.className).toContain('items-center');
    });
});

describe('Card Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render complete card structure', () => {
        expect(fixture.debugElement.query(By.directive(CardComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(CardHeaderComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(CardTitleComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(CardDescriptionComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(CardContentComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(CardFooterComponent))).toBeTruthy();
    });
});

describe('Card RTL Support', () => {
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
        document.documentElement.removeAttribute('dir');
    });

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

    it('should use flex layout for RTL text alignment', () => {
        const card = fixture.debugElement.query(By.directive(CardComponent));
        expect(card.nativeElement.className).toContain('flex');
        expect(card.nativeElement.className).toContain('flex-col');
    });
});
