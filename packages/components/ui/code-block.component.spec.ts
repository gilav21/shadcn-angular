import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CodeBlockComponent, CODE_BLOCK_THEMES } from './code-block.component';
import {
    braceScopeDetector,
    braceBracketScopeDetector,
    indentScopeDetector,
    tagScopeDetector,
    type ScopeDetector,
} from '../lib/code-scopes';

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

    describe('collapseScope', () => {
        const tsCode = [
            'function greet(name) {',
            '  const message = "hi";',
            '  return message + name;',
            '}',
            '',
            'function farewell() {',
            '  return "bye";',
            '}',
        ].join('\n');

        const yamlCode = [
            'jobs:',
            '  build:',
            '    steps:',
            '      - run: echo hi',
            '  test:',
            '    steps:',
            '      - run: echo bye',
        ].join('\n');

        const htmlCode = [
            '<div>',
            '  <span>inner</span>',
            '</div>',
        ].join('\n');

        const jsonCode = [
            '{',
            '  "name": "x",',
            '  "items": [',
            '    1,',
            '    2',
            '  ]',
            '}',
        ].join('\n');

        function chevrons(f: ComponentFixture<CodeBlockComponent>) {
            return f.debugElement.queryAll(By.css('[data-slot="code-block-chevron"][role="button"]'));
        }

        function collapsedMarkers(f: ComponentFixture<CodeBlockComponent>) {
            return f.debugElement.queryAll(By.css('[data-slot="code-block-collapsed-marker"]'));
        }

        function visibleLineCount(f: ComponentFixture<CodeBlockComponent>) {
            return f.componentInstance.visibleLines().length;
        }

        it('renders no chevrons when collapseScope is false (default)', () => {
            fixture.componentRef.setInput('code', tsCode);
            fixture.detectChanges();
            expect(chevrons(fixture).length).toBe(0);
        });

        it('renders one chevron per brace-detected scope in TS', () => {
            fixture.componentRef.setInput('code', tsCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.detectChanges();
            expect(chevrons(fixture).length).toBe(2);
        });

        it('toggleScope hides interior lines and shows the collapsed marker', () => {
            fixture.componentRef.setInput('code', tsCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.detectChanges();

            const before = visibleLineCount(fixture);
            component.toggleScope(0);
            fixture.detectChanges();

            expect(visibleLineCount(fixture)).toBeLessThan(before);
            expect(component.isCollapsed(0)).toBe(true);
            expect(collapsedMarkers(fixture).length).toBe(1);

            component.toggleScope(0);
            fixture.detectChanges();
            expect(visibleLineCount(fixture)).toBe(before);
            expect(component.isCollapsed(0)).toBe(false);
        });

        it('clicking the chevron toggles the scope', () => {
            fixture.componentRef.setInput('code', tsCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.detectChanges();

            const firstChevron = chevrons(fixture)[0];
            firstChevron.nativeElement.click();
            fixture.detectChanges();
            expect(component.isCollapsed(0)).toBe(true);
        });

        it('detects YAML scopes via indentation', () => {
            fixture.componentRef.setInput('language', 'yaml');
            fixture.componentRef.setInput('code', yamlCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.detectChanges();
            expect(chevrons(fixture).length).toBeGreaterThan(0);
        });

        it('detects HTML scopes via tag pairs', () => {
            fixture.componentRef.setInput('language', 'html');
            fixture.componentRef.setInput('code', htmlCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.detectChanges();
            expect(chevrons(fixture).length).toBe(1);
        });

        it('detects JSON scopes via braces and brackets', () => {
            fixture.componentRef.setInput('language', 'json');
            fixture.componentRef.setInput('code', jsonCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.detectChanges();
            expect(chevrons(fixture).length).toBe(2);
        });

        it('seeds initial collapsed state from defaultCollapsed=0', () => {
            fixture.componentRef.setInput('code', tsCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.componentRef.setInput('defaultCollapsed', 0);
            fixture.detectChanges();

            expect(component.isCollapsed(0)).toBe(true);
            expect(component.isCollapsed(5)).toBe(true);
            expect(collapsedMarkers(fixture).length).toBe(2);
        });

        it('does not collapse outermost scopes when defaultCollapsed=1', () => {
            fixture.componentRef.setInput('language', 'json');
            fixture.componentRef.setInput('code', jsonCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.componentRef.setInput('defaultCollapsed', 1);
            fixture.detectChanges();

            expect(component.isCollapsed(0)).toBe(false);
            expect(component.isCollapsed(2)).toBe(true);
        });

        it('uses scopes detector from a custom language config', () => {
            const customScopes: ScopeDetector = (lines) => {
                const ranges: { startLine: number; endLine: number; depth: number }[] = [];
                let start = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (/^BEGIN/.test(lines[i])) { start = i; }
                    else if (/^END/.test(lines[i]) && start !== -1) {
                        ranges.push({ startLine: start, endLine: i, depth: 0 });
                        start = -1;
                    }
                }
                return ranges;
            };

            fixture.componentRef.setInput('language', 'mylang');
            fixture.componentRef.setInput('code', 'BEGIN\nbody1\nbody2\nEND');
            fixture.componentRef.setInput('collapseScope', true);
            fixture.componentRef.setInput('customLanguages', {
                mylang: { patterns: [], scopes: customScopes },
            });
            fixture.detectChanges();

            expect(chevrons(fixture).length).toBe(1);
            component.toggleScope(0);
            fixture.detectChanges();
            expect(visibleLineCount(fixture)).toBe(1);
        });

        it('renders no chevrons for languages without a detector', () => {
            fixture.componentRef.setInput('language', 'brainfuck');
            fixture.componentRef.setInput('code', '+++[->+++<]\n+++');
            fixture.componentRef.setInput('collapseScope', true);
            fixture.detectChanges();
            expect(chevrons(fixture).length).toBe(0);
        });

        it('clears collapsed state when collapseScope is turned off', () => {
            fixture.componentRef.setInput('code', tsCode);
            fixture.componentRef.setInput('collapseScope', true);
            fixture.componentRef.setInput('defaultCollapsed', 0);
            fixture.detectChanges();
            expect(component.isCollapsed(0)).toBe(true);

            fixture.componentRef.setInput('collapseScope', false);
            fixture.detectChanges();
            expect(component.isCollapsed(0)).toBe(false);
        });
    });

    describe('built-in scope detectors', () => {
        it('braceScopeDetector returns ranges for paired braces', () => {
            const ranges = braceScopeDetector(['function f() {', '  return 1;', '}']);
            expect(ranges).toEqual([{ startLine: 0, endLine: 2, depth: 0 }]);
        });

        it('braceScopeDetector ignores braces inside strings and comments', () => {
            const ranges = braceScopeDetector([
                'const a = "{ not a scope }";',
                '// { also not }',
                'function f() {',
                '  return 1;',
                '}',
            ]);
            expect(ranges).toEqual([{ startLine: 2, endLine: 4, depth: 0 }]);
        });

        it('braceScopeDetector tracks nested depth', () => {
            const ranges = braceScopeDetector([
                'class A {',
                '  m() {',
                '    return 1;',
                '  }',
                '}',
            ]);
            expect(ranges).toContainEqual({ startLine: 0, endLine: 4, depth: 0 });
            expect(ranges).toContainEqual({ startLine: 1, endLine: 3, depth: 1 });
        });

        it('braceBracketScopeDetector handles both braces and brackets', () => {
            const ranges = braceBracketScopeDetector([
                '{',
                '  "items": [',
                '    1',
                '  ]',
                '}',
            ]);
            expect(ranges).toContainEqual({ startLine: 0, endLine: 4, depth: 0 });
            expect(ranges).toContainEqual({ startLine: 1, endLine: 3, depth: 1 });
        });

        it('indentScopeDetector returns ranges based on indentation', () => {
            const ranges = indentScopeDetector([
                'a:',
                '  b:',
                '    c: 1',
                '  d: 2',
            ]);
            expect(ranges).toContainEqual({ startLine: 0, endLine: 3, depth: 0 });
            expect(ranges).toContainEqual({ startLine: 1, endLine: 2, depth: 1 });
        });

        it('tagScopeDetector matches paired tags and skips void tags', () => {
            const ranges = tagScopeDetector([
                '<div>',
                '  <img src="x" />',
                '  <br>',
                '  <span>hi</span>',
                '</div>',
            ]);
            expect(ranges).toContainEqual({ startLine: 0, endLine: 4, depth: 0 });
            expect(ranges.every(r => !(r.startLine === 1 && r.endLine === 1))).toBe(true);
        });
    });
});
