import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { CopyToDirective } from './directives/copy-to.directive';

// CopyToDirective has no `component` metadata target since it's a directive;
// every input is still exposed via argTypes so the Controls panel drives it live.
const meta: Meta = {
    title: 'UI/Copy To',
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [CopyToDirective],
        }),
    ],
    argTypes: {
        uiCopyTo: {
            control: 'text',
            description:
                'Required. The text written to the clipboard when the host element is clicked (or tapped).',
        },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description:
                'Locale key (or a custom CommonLocale dictionary) used for the floating "Copied!" indicator. Defaults to the ambient UI locale.',
        },
        copied: {
            action: 'copied',
            description: 'Emits after the text has been successfully written to the clipboard.',
        },
    },
    args: {
        uiCopyTo: 'npx shadcn-angular add button',
        locale: 'en',
    },
};

export default meta;
type Story = StoryObj;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-col items-center justify-center gap-3 p-12">
                <button
                    type="button"
                    [uiCopyTo]="uiCopyTo"
                    [locale]="locale"
                    (copied)="copied()"
                    class="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                    Copy to clipboard
                </button>
                <p class="text-xs text-muted-foreground">Clicking copies: <code>{{ uiCopyTo }}</code></p>
            </div>
        `,
    }),
};

/** The simplest case — copy a plain string from a button. */
export const PlainText: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center p-12">
                <button
                    type="button"
                    uiCopyTo="hello@example.com"
                    class="px-5 py-2.5 rounded-lg border bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    hello&#64;example.com
                </button>
            </div>
        `,
    }),
};

/** Attach the directive to a code block so the whole snippet is one big copy target. */
export const CodeSnippet: Story = {
    render: () => ({
        props: { snippet: 'npm i -D @storybook/angular\nnpx shadcn-angular add button card' },
        template: `
            <div class="flex items-center justify-center p-6 sm:p-12">
                <pre
                    [uiCopyTo]="snippet"
                    class="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg cursor-pointer overflow-x-auto rounded-lg border bg-muted p-4 text-xs leading-relaxed hover:bg-muted/70 transition-colors"
                >{{ snippet }}</pre>
            </div>
        `,
    }),
};

/** Any element can host the directive — a button, an icon-only button, or a code block. */
export const HostElements: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center justify-center gap-4 p-12">
                <button
                    type="button"
                    uiCopyTo="sk_live_51H8xVeryS3cr3t"
                    class="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                    Copy API key
                </button>

                <button
                    type="button"
                    uiCopyTo="sk_live_51H8xVeryS3cr3t"
                    aria-label="Copy API key"
                    class="h-11 w-11 flex items-center justify-center rounded-lg border bg-background hover:bg-accent transition-colors"
                >
                    <span aria-hidden="true">⧉</span>
                </button>

                <code
                    uiCopyTo="#0f172a"
                    class="cursor-pointer rounded-md border bg-muted px-3 py-2 font-mono text-xs hover:bg-muted/70 transition-colors"
                >#0f172a</code>
            </div>
        `,
    }),
};

/** The `copied` output fires once the clipboard write resolves — use it for toasts or analytics. */
export const CopiedOutput: Story = {
    render: () => ({
        props: {
            count: 0,
            onCopied(this: { count: number }) {
                this.count++;
            },
        },
        template: `
            <div class="flex flex-col items-center justify-center gap-3 p-12">
                <button
                    type="button"
                    uiCopyTo="Copied via the (copied) output"
                    (copied)="onCopied()"
                    class="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                    Copy
                </button>
                <p class="text-sm text-muted-foreground">Copied {{ count }} time(s).</p>
            </div>
        `,
    }),
};

/** The floating indicator is localized through the `locale` input. */
export const LocalizedIndicator: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center justify-center gap-4 p-12">
                <button type="button" uiCopyTo="shalom" locale="he" class="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">
                    עברית
                </button>
                <button type="button" uiCopyTo="bonjour" locale="fr" class="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">
                    Français
                </button>
                <button type="button" uiCopyTo="konnichiwa" locale="ja" class="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">
                    日本語
                </button>
                <button type="button" uiCopyTo="privet" locale="ru" class="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">
                    Русский
                </button>
            </div>
        `,
    }),
};
