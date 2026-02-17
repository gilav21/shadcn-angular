import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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

    describe('copy functionality', () => {
        let originalClipboard: Clipboard;

        beforeEach(() => {
            originalClipboard = navigator.clipboard;
            const mockClipboard = {
                writeText: vi.fn().mockResolvedValue(undefined),
                readText: vi.fn().mockResolvedValue(''),
                read: vi.fn(),
                write: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            };
            Object.defineProperty(navigator, 'clipboard', {
                value: mockClipboard,
                writable: true,
                configurable: true,
            });
        });

        afterEach(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: originalClipboard,
                writable: true,
                configurable: true,
            });
            vi.restoreAllMocks();
        });

        it('should set copied to true after calling copyToClipboard', async () => {
            fixture.componentRef.setInput('code', 'console.log("hello")');
            fixture.detectChanges();

            component.copyToClipboard();
            await vi.waitFor(() => {
                expect(component.copied()).toBe(true);
            });

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("hello")');
        });

        it('should show check icon when copied is true', async () => {
            fixture.componentRef.setInput('code', 'test code');
            fixture.detectChanges();

            component.copyToClipboard();
            await vi.waitFor(() => {
                expect(component.copied()).toBe(true);
            });

            fixture.detectChanges();

            const checkIcon = fixture.debugElement.query(By.css('.text-green-500'));
            expect(checkIcon).toBeTruthy();
        });

        it('should reset copied to false after 2000ms', async () => {
            vi.useFakeTimers();

            fixture.componentRef.setInput('code', 'test');
            fixture.detectChanges();

            component.copyToClipboard();

            await vi.advanceTimersByTimeAsync(0);
            expect(component.copied()).toBe(true);

            vi.advanceTimersByTime(2000);
            expect(component.copied()).toBe(false);

            vi.useRealTimers();
        });
    });

    describe('multiple languages', () => {
        it('should tokenize Python keywords', () => {
            fixture.componentRef.setInput('language', 'python');
            fixture.componentRef.setInput('code', 'def hello():');
            fixture.detectChanges();

            const spans = fixture.debugElement.queryAll(By.css('code span'));
            const keywordSpan = spans.find(
                s => s.nativeElement.textContent.trim() === 'def'
            );
            expect(keywordSpan).toBeTruthy();
            expect(keywordSpan!.nativeElement.className).toContain('font-bold');
        });

        it('should tokenize Python decorators', () => {
            fixture.componentRef.setInput('language', 'python');
            fixture.componentRef.setInput('code', '@staticmethod\ndef foo():');
            fixture.detectChanges();

            const spans = fixture.debugElement.queryAll(By.css('code span'));
            const decoratorSpan = spans.find(
                s => s.nativeElement.textContent.trim() === '@staticmethod'
            );
            expect(decoratorSpan).toBeTruthy();
        });

        it('should tokenize HTML tags', () => {
            fixture.componentRef.setInput('language', 'html');
            fixture.componentRef.setInput('code', '<div class="test">');
            fixture.detectChanges();

            const spans = fixture.debugElement.queryAll(By.css('code span'));
            const tagSpan = spans.find(
                s => s.nativeElement.textContent.trim() === '<div'
            );
            expect(tagSpan).toBeTruthy();
        });
    });

    describe('language fallback', () => {
        it('should render without error for an unknown language', () => {
            fixture.componentRef.setInput('language', 'brainfuck');
            fixture.componentRef.setInput('code', '+++[->+++<]');
            fixture.detectChanges();

            const codeEl = fixture.debugElement.query(By.css('code'));
            expect(codeEl).toBeTruthy();
            expect(codeEl.nativeElement.textContent).toContain('+++');
        });

        it('should fall back to typescript patterns for unknown language', () => {
            fixture.componentRef.setInput('language', 'unknown_lang');
            fixture.componentRef.setInput('code', 'const x = 42;');
            fixture.detectChanges();

            const spans = fixture.debugElement.queryAll(By.css('code span'));
            const keywordSpan = spans.find(
                s => s.nativeElement.textContent.trim() === 'const'
            );
            expect(keywordSpan).toBeTruthy();
            expect(keywordSpan!.nativeElement.className).toContain('font-bold');
        });

        it('should display the unknown language name in the label', () => {
            fixture.componentRef.setInput('language', 'brainfuck');
            fixture.detectChanges();

            const langLabel = fixture.debugElement.query(By.css('.text-xs.text-zinc-400'));
            expect(langLabel.nativeElement.textContent.trim()).toBe('brainfuck');
        });
    });
});
