import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { CodeBlockComponent, CODE_BLOCK_THEMES } from './code-block.component';

describe('CodeBlockComponent', () => {
    let component: CodeBlockComponent;
    let fixture: ComponentFixture<CodeBlockComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CodeBlockComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CodeBlockComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render code content', () => {
        fixture.componentRef.setInput('code', 'const x = 42;');
        fixture.detectChanges();

        const codeEl = fixture.debugElement.query(By.css('code'));
        expect(codeEl.nativeElement.textContent).toContain('const');
        expect(codeEl.nativeElement.textContent).toContain('42');
    });

    it('should display the language label', () => {
        fixture.componentRef.setInput('language', 'python');
        fixture.detectChanges();

        const langLabel = fixture.debugElement.query(By.css('.text-xs.text-zinc-400'));
        expect(langLabel.nativeElement.textContent.trim()).toBe('python');
    });

    it('should default to typescript language', () => {
        expect(component.language()).toBe('typescript');

        const langLabel = fixture.debugElement.query(By.css('.text-xs.text-zinc-400'));
        expect(langLabel.nativeElement.textContent.trim()).toBe('typescript');
    });

    it('should display copy button', () => {
        const button = fixture.debugElement.query(By.css('ui-button'));
        expect(button).toBeTruthy();
    });

    it('should apply language class to code element', () => {
        fixture.componentRef.setInput('language', 'python');
        fixture.detectChanges();

        const codeEl = fixture.debugElement.query(By.css('code'));
        expect(codeEl.nativeElement.className).toContain('language-python');
    });

    it('should tokenize TypeScript keywords', () => {
        fixture.componentRef.setInput('code', 'const value = true;');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('code span'));
        const keywordSpans = spans.filter(
            s => s.nativeElement.className.includes('font-bold')
        );
        expect(keywordSpans.length).toBeGreaterThan(0);
    });

    it('should render empty content when code is empty', () => {
        fixture.componentRef.setInput('code', '');
        fixture.detectChanges();

        const codeEl = fixture.debugElement.query(By.css('code'));
        expect(codeEl.nativeElement.textContent.trim()).toBe('');
    });

    it('should apply custom theme token classes', () => {
        fixture.componentRef.setInput('code', 'const x = 1;');
        fixture.componentRef.setInput('theme', CODE_BLOCK_THEMES['dracula']);
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('code span'));
        const keywordSpan = spans.find(
            s => s.nativeElement.textContent.trim() === 'const'
        );
        expect(keywordSpan).toBeTruthy();
        expect(keywordSpan!.nativeElement.className).toContain('text-pink-400');
    });

    it('should apply base styling classes', () => {
        const container = fixture.debugElement.query(By.css('.rounded-lg'));
        expect(container).toBeTruthy();
    });

    it('should accept custom class input', () => {
        fixture.componentRef.setInput('class', 'my-custom-class');
        fixture.detectChanges();

        const container = fixture.debugElement.children[0];
        expect(container.nativeElement.className).toContain('my-custom-class');
    });
});
