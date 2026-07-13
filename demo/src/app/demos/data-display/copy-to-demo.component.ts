import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CopyToDirective } from '../../../../../packages/components/ui/directives/copy-to.directive';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { COPY_TO_DEMO_LOCALES } from './copy-to-demo.locales';

interface ColorToken {
    readonly name: string;
    readonly hex: string;
}

interface LocaleSample {
    readonly code: string;
    readonly label: string;
    readonly text: string;
}

// Deliberately not shaped like any real provider's key: a demo string that
// matches a live-credential pattern trips secret scanners on every clone.
const API_KEY = 'demo_key_0000_not_a_real_credential';
const CODE_SNIPPET = `npx shadcn-angular@latest init
npx shadcn-angular@latest add button card dialog`;

const COLOR_TOKENS: readonly ColorToken[] = [
    { name: 'slate-900', hex: '#0f172a' },
    { name: 'primary', hex: '#2563eb' },
    { name: 'emerald-500', hex: '#10b981' },
    { name: 'amber-500', hex: '#f59e0b' },
    { name: 'rose-500', hex: '#f43f5e' },
    { name: 'violet-500', hex: '#8b5cf6' },
];

const LOCALE_SAMPLES: readonly LocaleSample[] = [
    { code: 'en', label: 'English', text: 'Copied in English' },
    { code: 'he', label: 'עברית', text: 'הועתק בעברית' },
    { code: 'ar', label: 'العربية', text: 'نُسخ بالعربية' },
    { code: 'ja', label: '日本語', text: '日本語でコピー' },
    { code: 'fr', label: 'Français', text: 'Copié en français' },
    { code: 'ru', label: 'Русский', text: 'Скопировано по-русски' },
];

const CONTACT_EMAIL = 'hello@shadcn-angular.dev';
const CONTACT_PHONE = '+1 (555) 019-2837';

@Component({
    selector: 'app-copy-to-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CopyToDirective],
    template: `
        <div class="space-y-10">
            <section class="space-y-4">
                <h2 id="copy-to" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
                <p class="text-muted-foreground">{{ t().description }}</p>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().apiKeyHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().apiKeyDesc }}</p>
                <div class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 sm:p-6">
                    <div class="min-w-0 flex-1 space-y-1">
                        <p class="text-xs font-medium text-muted-foreground">{{ t().apiKeyLabel }}</p>
                        <code class="block truncate font-mono text-sm">{{ apiKey }}</code>
                    </div>
                    <button
                        type="button"
                        [uiCopyTo]="apiKey"
                        class="h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        {{ t().copyButton }}
                    </button>
                    <button
                        type="button"
                        [uiCopyTo]="apiKey"
                        [attr.aria-label]="t().copyIconLabel"
                        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <span aria-hidden="true">⧉</span>
                    </button>
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().codeHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().codeDesc }}</p>
                <pre
                    [uiCopyTo]="codeSnippet"
                    class="w-full max-w-full cursor-pointer overflow-x-auto rounded-lg border bg-muted p-4 text-xs leading-relaxed transition-colors hover:bg-muted/70 sm:p-6 sm:text-sm"
                >{{ codeSnippet }}</pre>
                <p class="text-xs text-muted-foreground">{{ t().codeHint }}</p>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().tokensHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().tokensDesc }}</p>
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    @for (token of colorTokens; track token.hex) {
                        <button
                            type="button"
                            [uiCopyTo]="token.hex"
                            (copied)="onCopied(token.hex)"
                            class="flex flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                        >
                            <span class="h-10 w-full rounded-md border" [style.background-color]="token.hex"></span>
                            <span class="truncate text-xs font-medium">{{ token.name }}</span>
                            <span class="font-mono text-xs text-muted-foreground">{{ token.hex }}</span>
                        </button>
                    }
                </div>
                <p class="text-xs text-muted-foreground">{{ t().tokensHint }}</p>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().outputHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().outputDesc }}</p>
                <div class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 sm:p-6">
                    <button
                        type="button"
                        [uiCopyTo]="contactEmail"
                        (copied)="onCopied(contactEmail)"
                        class="h-11 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        {{ t().copyEmailButton }}
                    </button>
                    <button
                        type="button"
                        [uiCopyTo]="contactPhone"
                        (copied)="onCopied(contactPhone)"
                        class="h-11 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        {{ t().copyPhoneButton }}
                    </button>
                    <p class="text-sm text-muted-foreground">
                        {{ t().lastCopiedLabel }}
                        <strong class="font-mono">{{ lastCopied() || t().nothingCopied }}</strong>
                    </p>
                    <p class="text-sm text-muted-foreground">
                        {{ t().copyCountLabel }} <strong>{{ copyCount() }}</strong>
                    </p>
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().localeHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().localeDesc }}</p>
                <div class="flex flex-wrap gap-3">
                    @for (sample of localeSamples; track sample.code) {
                        <button
                            type="button"
                            [uiCopyTo]="sample.text"
                            [locale]="sample.code"
                            (copied)="onCopied(sample.text)"
                            class="h-11 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            {{ sample.label }}
                        </button>
                    }
                </div>
            </section>
        </div>
    `,
})
export class CopyToDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(() => COPY_TO_DEMO_LOCALES[this.localeId()] ?? COPY_TO_DEMO_LOCALES['en']);

    protected readonly apiKey = API_KEY;
    protected readonly codeSnippet = CODE_SNIPPET;
    protected readonly colorTokens = COLOR_TOKENS;
    protected readonly localeSamples = LOCALE_SAMPLES;
    protected readonly contactEmail = CONTACT_EMAIL;
    protected readonly contactPhone = CONTACT_PHONE;

    protected readonly lastCopied = signal('');
    protected readonly copyCount = signal(0);

    protected onCopied(value: string): void {
        this.lastCopied.set(value);
        this.copyCount.update((n) => n + 1);
    }
}
