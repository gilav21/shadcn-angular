import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { TextRevealComponent } from './text-reveal.component';

describe('TextRevealComponent', () => {
    let component: TextRevealComponent;
    let fixture: ComponentFixture<TextRevealComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TextRevealComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TextRevealComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render text content as individual word spans', () => {
        fixture.componentRef.setInput('text', 'Hello World');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans.length).toBe(2);
    });

    it('should render each word in a separate span', () => {
        fixture.componentRef.setInput('text', 'The quick brown fox');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans.length).toBe(4);
        expect(spans[0].nativeElement.textContent).toContain('The');
        expect(spans[1].nativeElement.textContent).toContain('quick');
        expect(spans[2].nativeElement.textContent).toContain('brown');
        expect(spans[3].nativeElement.textContent).toContain('fox');
    });

    it('should default delay to 50ms', () => {
        expect(component.delay()).toBe(50);
    });

    it('should accept custom delay input', () => {
        fixture.componentRef.setInput('delay', 100);
        fixture.detectChanges();

        expect(component.delay()).toBe(100);
    });

    it('should apply animation-delay style to word spans', () => {
        fixture.componentRef.setInput('text', 'Hello World');
        fixture.componentRef.setInput('delay', 50);
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans[0].nativeElement.style.animationDelay).toBe('0ms');
        expect(spans[1].nativeElement.style.animationDelay).toBe('50ms');
    });

    it('should apply blur-in animation class to spans', () => {
        fixture.componentRef.setInput('text', 'Hello');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans[0].nativeElement.className).toContain('animate-blur-in');
    });

    it('should apply flex-wrap class to container', () => {
        fixture.componentRef.setInput('text', 'Hello');
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('.flex'));
        expect(container).toBeTruthy();
        expect(container.nativeElement.className).toContain('flex-wrap');
    });

    it('should accept custom class input', () => {
        fixture.componentRef.setInput('class', 'text-4xl');
        fixture.detectChanges();

        const container = fixture.debugElement.children[0];
        expect(container.nativeElement.className).toContain('text-4xl');
    });

    it('should render no spans when text is empty', () => {
        fixture.componentRef.setInput('text', '');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans.length).toBe(1);
        expect(spans[0].nativeElement.textContent.trim()).toBe('');
    });

    it('should compute words from text input', () => {
        fixture.componentRef.setInput('text', 'one two three');
        fixture.detectChanges();

        expect(component.words()).toEqual(['one', 'two', 'three']);
    });
});
