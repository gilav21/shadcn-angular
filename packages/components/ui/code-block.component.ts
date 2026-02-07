import {
    Component,
    ChangeDetectionStrategy,
    input,
    signal,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';
import { ButtonComponent } from './button.component';


export type CodeBlockTheme = Record<string, string>;
export type LanguagePattern = { type: string; regex: RegExp }[];

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
    template: `
    <div [class]="classes()">
      <div class="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-zinc-800">
        <span class="text-xs text-zinc-400 font-mono">{{ language() }}</span>
        <ui-button 
            variant="ghost" 
            size="icon" 
            class="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            (click)="copyToClipboard()"
        >
            @if (copied()) {
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 text-green-500">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            } @else {
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
            }
        </ui-button>
      </div>
      <div class="p-4 overflow-auto font-mono text-sm bg-zinc-950 text-zinc-50">
        <pre><code [class]="'language-' + language()">@for (token of tokens(); track $index) {<span [class]="getTokenClass(token)">{{ token.text }}</span>}</code></pre>
      </div>
    </div>
  `,
})
export class CodeBlockComponent {
    code = input('');
    language = input('typescript');
    class = input('');
    theme = input<CodeBlockTheme | null>(null);
    customLanguages = input<Record<string, LanguagePattern> | null>(null);
    copied = signal(false);

    tokens = computed(() => this.highlight(this.code()));

    classes = computed(() => cn('relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 my-4 text-left', this.class()));

    copyToClipboard() {
        if (!navigator?.clipboard) return;

        navigator.clipboard.writeText(this.code()).then(() => {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 2000);
        });
    }

    getTokenClass(token: { type: string, text: string }): string {
        const theme = this.theme();
        if (theme && theme[token.type]) {
            return theme[token.type];
        }

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

    private readonly LANGUAGE_PATTERNS: Record<string, { type: string, regex: RegExp }[]> = {
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
            { type: 'decorator', regex: /\[[a-zA-Z]\w*\]/ }, // Attributes like [HttpGet]
            { type: 'keyword', regex: /\b(public|private|protected|internal|class|struct|record|interface|enum|delegate|event|void|int|string|bool|var|async|await|Task|return|if|else|for|foreach|while|do|switch|case|default|break|continue|try|catch|finally|throw|new|this|base|using|namespace|static|readonly|const|override|virtual|abstract|sealed|get|set|value)\b/ },
            { type: 'number', regex: /\b\d+\b/ },
            { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\()/ },
        ],
        yaml: [
            { type: 'comment', regex: /#.*/ },
            { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
            { type: 'attr', regex: /[a-zA-Z0-9_-]+(?=:)/ }, // Keys
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

    private highlight(code: string): { type: string, text: string }[] {
        if (!code) return [];

        const tokens: { type: string, text: string }[] = [];
        let current = 0;

        const lang = this.language().toLowerCase();

        // Use custom languages if available, else fallback to builtin
        const custom = this.customLanguages();
        const patterns = (custom && custom[lang]) || this.LANGUAGE_PATTERNS[lang] || this.LANGUAGE_PATTERNS['typescript'];

        while (current < code.length) {
            let bestMatch: { type: string, match: RegExpMatchArray, index: number } | null = null;
            const remaining = code.slice(current);

            for (const p of patterns) {
                const match = remaining.match(p.regex);
                if (match && match.index !== undefined) {
                    if (bestMatch === null || match.index < bestMatch.index) {
                        bestMatch = { type: p.type, match, index: match.index };
                    }
                }
            }

            if (bestMatch && bestMatch.index === 0) {
                tokens.push({ type: bestMatch.type, text: bestMatch.match[0] });
                current += bestMatch.match[0].length;
            } else if (bestMatch) {
                tokens.push({ type: 'text', text: remaining.slice(0, bestMatch.index) });
                current += bestMatch.index;
            } else {
                tokens.push({ type: 'text', text: remaining });
                current += remaining.length;
            }
        }

        return tokens;
    }
}
