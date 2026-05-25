import {
    Component,
    ChangeDetectionStrategy,
    input,
    signal,
    computed,
    effect,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { CODE_BLOCK_LOCALES, type CodeBlockLocale } from './code-block.locales';
import {
    BUILTIN_SCOPE_DETECTORS,
    type ScopeDetector,
    type ScopeRange,
} from '../../lib/code-scopes';
import { ButtonComponent } from '../button';

export type { ScopeDetector, ScopeRange } from '../../lib/code-scopes';
export { BUILTIN_SCOPE_DETECTORS } from '../../lib/code-scopes';

export type CodeBlockTheme = Record<string, string>;
export type LanguagePattern = { type: string; regex: RegExp }[];
export type LanguageConfig = {
    patterns: LanguagePattern;
    scopes?: ScopeDetector;
};

type Token = { type: string; text: string };

type RenderLine = {
    index: number;
    tokens: Token[];
    foldStart?: number;
    isOpen?: boolean;
};

export const CODE_BLOCK_THEMES: Record<string, CodeBlockTheme> = {
    vscode: {
        keyword: 'text-blue-400 font-bold',
        string: 'text-orange-300',
        comment: 'text-green-400 italic',
        function: 'text-yellow-200',
        number: 'text-emerald-200',
        decorator: 'text-yellow-400',
        tag: 'text-blue-400',
        attr: 'text-sky-300',
        property: 'text-sky-300'
    },
    dracula: {
        keyword: 'text-pink-400 font-bold',
        string: 'text-yellow-200',
        comment: 'text-purple-400 italic',
        function: 'text-green-400',
        number: 'text-orange-400',
        decorator: 'text-cyan-400',
        tag: 'text-pink-400',
        attr: 'text-green-400 italic',
        property: 'text-cyan-400'
    },
    github: {
        keyword: 'text-red-400 font-bold',
        string: 'text-blue-200',
        comment: 'text-gray-500 italic',
        function: 'text-purple-400',
        number: 'text-blue-400',
        decorator: 'text-orange-400',
        tag: 'text-green-400',
        attr: 'text-purple-400',
        property: 'text-blue-300'
    },
    monokai: {
        keyword: 'text-pink-500 font-bold',
        string: 'text-yellow-300',
        comment: 'text-gray-500 italic',
        function: 'text-green-400',
        number: 'text-purple-400',
        decorator: 'text-orange-400',
        tag: 'text-pink-500',
        attr: 'text-green-400 italic',
        property: 'text-cyan-400'
    }
};

@Component({
    selector: 'ui-code-block',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    templateUrl: './code-block.component.html',
})
export class CodeBlockComponent {
    readonly code = input('');
    readonly language = input('typescript');
    readonly class = input('');
    readonly theme = input<CodeBlockTheme | null>(null);
    readonly customLanguages = input<Record<string, LanguagePattern | LanguageConfig> | null>(null);
    readonly collapseScope = input(false);
    readonly defaultCollapsed = input<number | undefined>(undefined);
    readonly lineNumbers = input(true);

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CodeBlockLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, CODE_BLOCK_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    readonly copied = signal(false);

    /** `aria-label` for the copy button — flips to the "copied" message for a moment after a click. */
    readonly copyAriaLabel = computed(() =>
        this.copied() ? (this.t().copied ?? 'Copied') : (this.t().copy ?? 'Copy'),
    );

    readonly lineNumberWidth = computed(() => {
        const total = this.lineTokens().length;
        const digits = total > 0 ? Math.floor(Math.log10(total)) + 1 : 1;
        return `${digits}ch`;
    });

    private readonly collapsed = signal<ReadonlySet<number>>(new Set<number>());

    readonly classes = computed(() => cn(
        'relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 my-4 text-left',
        this.class()
    ));

    private readonly resolvedLanguage = computed(() => this.normalizeLanguage(this.language()));

    private readonly lineTokens = computed<Token[][]>(() => {
        const code = this.code();
        if (!code) { return []; }
        const patterns = this.resolvedLanguage().patterns;
        return code.split('\n').map(line => this.highlight(line, patterns));
    });

    private readonly scopes = computed<ScopeRange[]>(() => {
        if (!this.collapseScope()) { return []; }
        const detector = this.resolvedLanguage().scopes;
        if (!detector) { return []; }
        return detector(this.code().split('\n'));
    });

    readonly visibleLines = computed<RenderLine[]>(() => {
        const all = this.lineTokens();
        const scopes = this.scopes();
        const collapsed = this.collapsed();
        const scopesByStart = new Map<number, ScopeRange>();
        for (const scope of scopes) { scopesByStart.set(scope.startLine, scope); }
        const result: RenderLine[] = [];
        let skipUntil = -1;
        for (let i = 0; i < all.length; i++) {
            if (i <= skipUntil) { continue; }
            const scope = scopesByStart.get(i);
            const isFold = scope !== undefined;
            const isOpen = isFold ? !collapsed.has(i) : undefined;
            result.push({
                index: i,
                tokens: all[i],
                foldStart: isFold ? i : undefined,
                isOpen,
            });
            if (isFold && !isOpen) { skipUntil = scope.endLine; }
        }
        return result;
    });

    constructor() {
        effect(() => {
            const depth = this.defaultCollapsed();
            if (depth === undefined || !this.collapseScope()) {
                this.collapsed.set(new Set());
                return;
            }
            const seeded = new Set<number>();
            for (const scope of this.scopes()) {
                if (scope.depth >= depth) { seeded.add(scope.startLine); }
            }
            this.collapsed.set(seeded);
        });
    }

    copyToClipboard() {
        if (!navigator?.clipboard) { return; }
        navigator.clipboard.writeText(this.code()).then(() => {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 2000);
        });
    }

    toggleScope(startLine: number) {
        const next = new Set(this.collapsed());
        if (next.has(startLine)) {
            next.delete(startLine);
        } else {
            next.add(startLine);
        }
        this.collapsed.set(next);
    }

    isCollapsed(startLine: number): boolean {
        return this.collapsed().has(startLine);
    }

    onChevronClick(startLine: number | undefined) {
        if (startLine !== undefined) { this.toggleScope(startLine); }
    }

    getTokenClass(token: Token): string {
        const theme = this.theme();
        if (theme?.[token.type]) { return theme[token.type]; }

        switch (token.type) {
            case 'keyword': return 'text-pink-400 font-bold';
            case 'string': return 'text-green-400';
            case 'comment': return 'text-gray-500 italic';
            case 'number': return 'text-orange-400';
            case 'function': return 'text-blue-400';
            case 'decorator': return 'text-yellow-400';
            case 'tag': return 'text-pink-400';
            case 'attr': return 'text-blue-400 italic';
            case 'selector': return 'text-pink-400 font-bold';
            case 'property': return 'text-blue-400';
            default: return 'text-zinc-50';
        }
    }

    private readonly LANGUAGE_PATTERNS: Readonly<Record<string, LanguagePattern>> = {
        typescript: [
            { type: 'comment', regex: /\/\/.*/ },
            { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
            { type: 'keyword', regex: /\b(const|let|var|function|class|import|from|return|if|else|for|while|export|interface|type|public|private|protected|implements|extends|new|this|true|false|null|undefined|void|async|await)\b/ },
            { type: 'number', regex: /\b\d+\b/ },
            { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\()/ },
        ],
        javascript: [
            { type: 'comment', regex: /\/\/.*/ },
            { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
            { type: 'keyword', regex: /\b(const|let|var|function|class|import|from|return|if|else|for|while|export|new|this|true|false|null|undefined|void|async|await)\b/ },
            { type: 'number', regex: /\b\d+\b/ },
            { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\()/ },
        ],
        python: [
            { type: 'comment', regex: /#.*/ },
            { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
            { type: 'decorator', regex: /@[\w.]+/ },
            { type: 'keyword', regex: /\b(def|class|import|from|if|else|elif|for|while|return|try|except|finally|with|as|pass|break|continue|lambda|yield|async|await|True|False|None)\b/ },
            { type: 'number', regex: /\b\d+\b/ },
            { type: 'function', regex: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\()/ },
        ],
        java: [
            { type: 'comment', regex: /\/\/.*/ },
            { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
            { type: 'keyword', regex: /\b(public|private|protected|class|interface|enum|extends|implements|new|this|super|return|if|else|for|while|do|switch|case|default|break|continue|try|catch|finally|throw|throws|import|package|void|int|boolean|char|byte|short|long|float|double|static|final|abstract|synchronized|volatile|transient|native|strictfp|instanceof|null|true|false)\b/ },
            { type: 'decorator', regex: /@[\w]+/ },
            { type: 'number', regex: /\b\d+\b/ },
            { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\()/ },
        ],
        html: [
            { type: 'comment', regex: /<!--[\s\S]*?-->/ },
            { type: 'tag', regex: /<\/?[a-z0-9-]+/i },
            { type: 'attr', regex: /[a-z0-9-]+(?==)/i },
            { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        ],
        xml: [
            { type: 'comment', regex: /<!--[\s\S]*?-->/ },
            { type: 'decorator', regex: /<\?xml[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>/i },
            { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
            { type: 'tag', regex: /<\/?[a-zA-Z_][\w.\-:]*/ },
            { type: 'attr', regex: /[a-zA-Z_][\w.\-:]*(?==)/ },
            { type: 'keyword', regex: /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/ },
            { type: 'number', regex: /\b\d+\b/ },
        ],
        css: [
            { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
            { type: 'selector', regex: /[.#]?[a-zA-Z0-9_-]+(?=\{)/ },
            { type: 'property', regex: /[a-z0-9-]+(?=:)/i },
            { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
            { type: 'number', regex: /\b\d+(?:px|rem|em|%|vh|vw|s|ms|deg)?\b/ },
        ],
        json: [
            { type: 'function', regex: /"[^"]+":/ },
            { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
            { type: 'keyword', regex: /\b(true|false|null)\b/ },
            { type: 'number', regex: /\b\d+\b/ },
        ],
        csharp: [
            { type: 'comment', regex: /\/\/.*/ },
            { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
            { type: 'decorator', regex: /\[[a-zA-Z]\w*\]/ },
            { type: 'keyword', regex: /\b(public|private|protected|internal|class|struct|record|interface|enum|delegate|event|void|int|string|bool|var|async|await|Task|return|if|else|for|foreach|while|do|switch|case|default|break|continue|try|catch|finally|throw|new|this|base|using|namespace|static|readonly|const|override|virtual|abstract|sealed|get|set|value)\b/ },
            { type: 'number', regex: /\b\d+\b/ },
            { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\()/ },
        ],
        yaml: [
            { type: 'comment', regex: /#.*/ },
            { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
            { type: 'attr', regex: /[a-zA-Z0-9_-]+(?=:)/ },
            { type: 'keyword', regex: /\b(true|false|null|yes|no|on|off)\b/ },
            { type: 'number', regex: /\b\d+(\.\d+)?\b/ },
        ],
        bash: [
            { type: 'comment', regex: /#.*/ },
            { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
            { type: 'keyword', regex: /\b(echo|ls|cd|pwd|mkdir|rm|cp|mv|touch|cat|grep|open|ssh|git|npm|node|ng|sudo|chmod|chown)\b/ },
            { type: 'decorator', regex: /\$[a-zA-Z0-9_]+/ },
        ]
    };

    private normalizeLanguage(lang: string): { patterns: LanguagePattern; scopes?: ScopeDetector } {
        const key = lang.toLowerCase();
        const customEntry = this.customLanguages()?.[key];
        if (customEntry) {
            const config = Array.isArray(customEntry) ? { patterns: customEntry } : customEntry;
            const fallbackScopes = config.scopes ?? BUILTIN_SCOPE_DETECTORS[key];
            return { patterns: config.patterns, scopes: fallbackScopes };
        }
        const builtinPatterns = this.LANGUAGE_PATTERNS[key] ?? this.LANGUAGE_PATTERNS['typescript'];
        return { patterns: builtinPatterns, scopes: BUILTIN_SCOPE_DETECTORS[key] };
    }

    private highlight(line: string, patterns: LanguagePattern): Token[] {
        if (!line) { return []; }
        const tokens: Token[] = [];
        let cursor = 0;

        while (cursor < line.length) {
            const remaining = line.slice(cursor);
            const bestMatch = this.findBestMatch(remaining, patterns);

            if (bestMatch && bestMatch.index === 0) {
                tokens.push({ type: bestMatch.type, text: bestMatch.text });
                cursor += bestMatch.text.length;
            } else if (bestMatch) {
                tokens.push({ type: 'text', text: remaining.slice(0, bestMatch.index) });
                cursor += bestMatch.index;
            } else {
                tokens.push({ type: 'text', text: remaining });
                cursor += remaining.length;
            }
        }

        return tokens;
    }

    private findBestMatch(
        remaining: string,
        patterns: LanguagePattern,
    ): { type: string; text: string; index: number } | null {
        let best: { type: string; text: string; index: number } | null = null;
        for (const p of patterns) {
            const match = p.regex.exec(remaining);
            if (match && match.index !== undefined && (best === null || match.index < best.index)) {
                best = { type: p.type, text: match[0], index: match.index };
            }
        }
        return best;
    }
}
