import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import {
    BadgeComponent,
    ButtonComponent,
    RichTextEditorComponent,
} from '../../../../../packages/components/ui';
import {
    hoverCardAction,
    hoverCardHandlers,
    linkedPreviewDialogAction,
    linkedPreviewDialogHandlers,
    openDialogAction,
    openDialogHandlers,
    RichTextActionsBindDirective,
    RichTextActionsDirective,
    type RichTextActionDefinition,
    type RichTextActionEvent,
    type RichTextActionHandler,
} from '../../../../../packages/components/ui/rich-text-editor/addons/actions';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { RICH_TEXT_ACTIONS_DEMO_LOCALES } from './rich-text-actions-demo.locales';
import {
    DemoEntityFormComponent,
    DemoPricingComponent,
    DEMO_GLOSSARY,
    DEMO_PRODUCTS,
    DEMO_USERS,
    type DemoProduct,
    type DemoUser,
} from './rich-text-actions-demo.parts';

// --- Action definitions the developer registers on the editor -----------------

/** Tier 1 — a glossary term looked up on hover. */
const GLOSSARY_DEF: RichTextActionDefinition = {
    id: 'glossary', label: 'Glossary term', icon: 'book-open', triggers: ['hover'], targets: ['text'],
    fields: [{
        key: 'term', label: 'Term', type: 'select', required: true,
        options: Object.keys(DEMO_GLOSSARY).map((t) => ({ value: t, label: t })),
    }],
};

/** Tier 1 — a product quick-view opened on click. */
const PRODUCT_DEF: RichTextActionDefinition = {
    id: 'product', label: 'Product quick-view', icon: 'shopping-bag', triggers: ['click'],
    fields: [{
        key: 'sku', label: 'Product', type: 'select', required: true,
        options: Object.values(DEMO_PRODUCTS).map((p) => ({ value: p.sku, label: p.name })),
    }],
};

/** Tier 1 — fire an analytics event on click. */
const TRACK_DEF: RichTextActionDefinition = {
    id: 'track', label: 'Track click', icon: 'bar-chart-3', triggers: ['click'],
    fields: [{ key: 'event', label: 'Event name', type: 'text', required: true, placeholder: 'cta_clicked' }],
};

/** Tier 2 — a teammate profile card; params gathered by a custom form component. */
const PROFILE_DEF: RichTextActionDefinition = {
    id: 'profile', label: 'Profile card', icon: 'user-round', triggers: ['hover'], targets: ['text'],
    formComponent: DemoEntityFormComponent,
};

/** Tier 3 — an external picker; the addon shows no dialog, the dev resolves params. */
const ENTITY_DEF: RichTextActionDefinition = {
    id: 'entity', label: 'Link entity (external)', icon: 'link', triggers: ['click'],
    resolveParams: async (ctx) => {
        // A real app opens its own searchable picker or calls an API here.
        await new Promise((r) => setTimeout(r, 150));
        const slug = ctx.selectionText.trim().toLowerCase().replaceAll(/\s+/g, '-') || 'entity';
        return { entityId: slug, source: 'external' };
    },
};

// --- v2: starter styling + combined action -------------------------------------

/** Global default inline style seeded onto newly-attached actions via `uiRteActionsStyle`. */
const V2_STARTER_STYLE: Record<string, string> = {
    color: '#2563eb', textDecoration: 'underline dotted', textUnderlineOffset: '3px',
};

// --- Seeded documents ---------------------------------------------------------

const PLAYGROUND_CONTENT =
    '<p>Our sync API is ' +
    '<span data-action-hover="glossary" data-action-hover-params=\'{"term":"idempotent"}\'>idempotent</span>, ' +
    'so retries are safe. Ping ' +
    '<span data-action-hover="profile" data-action-hover-params=\'{"userId":"ada","userName":"Ada Lovelace"}\'>' +
    '@Ada</span> for access, browse the ' +
    '<span data-action-click="product" data-action-click-params=\'{"sku":"kbd-01"}\'>Aurora Keyboard</span>, ' +
    'then <span data-action-click="track" data-action-click-params=\'{"event":"cta_clicked"}\'>get started</span>.</p>';

const PRESETS_CONTENT =
    '<p>Hover <span data-action-hover="preset.hover-card" ' +
    'data-action-hover-params=\'{"title":"Heads up","body":"This floating card is the built-in hover-card ' +
    'preset — no custom render code."}\'>this term</span>, click ' +
    '<span data-action-click="preset.open-dialog" ' +
    'data-action-click-params=\'{"title":"Welcome aboard","body":"The open-dialog preset renders a real modal in ' +
    'the top layer.","confirmLabel":"Got it"}\'>here</span>, or view ' +
    '<span data-action-click="preset.pricing" data-action-click-params=\'{"plan":"pro"}\'>Pro pricing</span> ' +
    '— a dialog rendering your own component.</p>';

const TIER3_CONTENT =
    '<p>Tier 3 links to an <span data-action-click="entity" ' +
    'data-action-click-params=\'{"entityId":"ada-lovelace","source":"external"}\'>external record</span> ' +
    'resolved by your own picker.</p>';

const READONLY_CONTENT =
    '<p>Published, read-only content still fires actions — hover ' +
    '<span data-action-hover="glossary" data-action-hover-params=\'{"term":"serialization"}\'>serialization</span> ' +
    'or open the <span data-action-click="product" data-action-click-params=\'{"sku":"mou-02"}\'>Glide Mouse</span> ' +
    '— but the authoring toolbar is gone.</p>';

const RTL_CONTENT =
    '<p dir="rtl">רחפו מעל <span data-action-hover="preset.hover-card" ' +
    'data-action-hover-params=\'{"title":"טיפ","body":"כרטיס ריחוף מובנה — עובד גם מימין לשמאל."}\'>' +
    'המונח הזה</span> כדי לראות כרטיס ריחוף.</p>';

const V2_PARAMS = '{"title":"Idempotent","body":"Calling it once or many times has the same effect."}';
// The action span carries the same inline style a fresh attach seeds from
// `uiRteActionsStyle` (V2_STARTER_STYLE) — so the starter look is visible on load.
const V2_SEEDED_STYLE = 'color:#2563eb;text-decoration:underline dotted;text-underline-offset:3px';
const V2_CONTENT =
    '<p>Newly-attached actions inherit the starter style. Hover or click ' +
    `<span style="${V2_SEEDED_STYLE}" data-action-hover="preset.linked-preview-dialog" data-action-hover-params='${V2_PARAMS}' ` +
    `data-action-click="preset.linked-preview-dialog" data-action-click-params='${V2_PARAMS}'>idempotent</span> — ` +
    'one combined action definition drives both a hover preview and a click dialog.</p>';

// --- Copy-paste snippets ------------------------------------------------------

interface Snippet {
    title: string;
    trigger: 'hover' | 'click';
    tier: string;
    code: string;
}

const SNIPPETS: Snippet[] = [
    {
        title: 'Batteries included — presets',
        trigger: 'hover', tier: 'preset',
        code:
            `// Register the ready-made actions on the editor:\n` +
            `defs = [hoverCardAction(), openDialogAction()];\n\n` +
            `// Spread their handlers into the render-side directive:\n` +
            `handlers = {\n` +
            `  ...hoverCardHandlers(this.injector),\n` +
            `  ...openDialogHandlers(this.injector),\n` +
            `};\n` +
            `// <article [innerHTML]="html" [uiRichTextActions]="handlers">`,
    },
    {
        title: 'Custom hover action — glossary tooltip',
        trigger: 'hover', tier: 'fields',
        code:
            `const glossaryDef = {\n` +
            `  id: 'glossary', triggers: ['hover'],\n` +
            `  fields: [{ key: 'term', type: 'select', options }],\n` +
            `};\n\n` +
            `handlers = {\n` +
            `  glossary: (e) => {\n` +
            `    if (e.phase === 'end') return this.tooltip.set(null);\n` +
            `    const r = e.element.getBoundingClientRect();\n` +
            `    this.tooltip.set({ text: LOOKUP[e.params.term], x: r.left, y: r.bottom });\n` +
            `  },\n` +
            `};`,
    },
    {
        title: 'Custom click action — analytics + toast',
        trigger: 'click', tier: 'fields',
        code:
            `const trackDef = {\n` +
            `  id: 'track', triggers: ['click'],\n` +
            `  fields: [{ key: 'event', type: 'text', required: true }],\n` +
            `};\n\n` +
            `handlers = {\n` +
            `  track: (e) => {\n` +
            `    analytics.send(e.params.event);   // your call\n` +
            `    this.toast.set('Tracked: ' + e.params.event);\n` +
            `  },\n` +
            `};`,
    },
    {
        title: 'Tier 3 — external picker (no addon dialog)',
        trigger: 'click', tier: 'resolveParams',
        code:
            `const entityDef = {\n` +
            `  id: 'entity', triggers: ['click'],\n` +
            `  resolveParams: async (ctx) => {\n` +
            `    const picked = await myPicker.open(ctx.selectionText);\n` +
            `    return picked ? { entityId: picked.id } : null;\n` +
            `  },\n` +
            `};`,
    },
];

/** Shown in its own code block under section 6 ("Starter styling + combined action"), not the cookbook loop. */
const V2_SNIPPET: Snippet = {
    title: 'Starter style + combined action',
    trigger: 'click', tier: 'v2',
    code:
        `// Seed the inline style newly-attached actions get:\n` +
        `<ui-rich-text-editor [uiRteActions]="defs" [uiRteActionsStyle]="{\n` +
        `  color: '#2563eb', textDecoration: 'underline dotted', textUnderlineOffset: '3px',\n` +
        `}" />\n\n` +
        `// One definition, hover previews and click opens the dialog:\n` +
        `defs = [linkedPreviewDialogAction()];\n` +
        `handlers = { ...linkedPreviewDialogHandlers(this.injector) };`,
};

type HandlerMap = Record<string, RichTextActionHandler>;
interface Anchored { x: number; y: number; }

@Component({
    selector: 'app-rich-text-actions-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, RichTextEditorComponent, RichTextActionsDirective, RichTextActionsBindDirective,
        ButtonComponent, BadgeComponent,
    ],
    templateUrl: './rich-text-actions-demo.component.html',
})
export class RichTextActionsDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    private readonly sanitizer = inject(DomSanitizer);
    private readonly injector = inject(Injector);

    protected readonly t = computed(() =>
        RICH_TEXT_ACTIONS_DEMO_LOCALES[this.localeId()] ?? RICH_TEXT_ACTIONS_DEMO_LOCALES['en']);

    protected readonly snippets = SNIPPETS;
    protected readonly v2Snippet = V2_SNIPPET;
    protected readonly copiedTitle = signal('');

    // Editor registrations
    protected readonly playgroundDefs: RichTextActionDefinition[] = [
        GLOSSARY_DEF, PROFILE_DEF, PRODUCT_DEF, TRACK_DEF,
        hoverCardAction(), openDialogAction(),
    ];
    protected readonly tier3Defs: RichTextActionDefinition[] = [ENTITY_DEF];
    protected readonly v2Defs: RichTextActionDefinition[] = [linkedPreviewDialogAction()];
    protected readonly v2Style = V2_STARTER_STYLE;

    // Editable documents
    protected readonly playgroundContent = signal(PLAYGROUND_CONTENT);
    protected readonly tier3Content = signal(TIER3_CONTENT);
    protected readonly v2Content = signal(V2_CONTENT);

    // Live overlay state driven by the render-side handlers
    protected readonly tooltip = signal<(Anchored & { text: string }) | null>(null);
    protected readonly profileCard = signal<(Anchored & { user: DemoUser }) | null>(null);
    protected readonly product = signal<DemoProduct | null>(null);
    protected readonly toast = signal<string | null>(null);
    protected readonly eventLog = signal<string[]>([]);
    private toastTimer: ReturnType<typeof setTimeout> | null = null;

    // Trusted HTML (the editor already sanitizes; keep inert data-action-* hooks)
    protected readonly playgroundTrusted = computed<SafeHtml>(() => this.trust(this.playgroundContent()));
    protected readonly tier3Trusted = computed<SafeHtml>(() => this.trust(this.tier3Content()));
    protected readonly presetsTrusted: SafeHtml = this.trust(PRESETS_CONTENT);
    protected readonly readonlyTrusted: SafeHtml = this.trust(READONLY_CONTENT);
    protected readonly rtlTrusted: SafeHtml = this.trust(RTL_CONTENT);
    protected readonly v2Trusted = computed<SafeHtml>(() => this.trust(this.v2Content()));

    /** Custom developer-owned handlers for the cookbook actions. */
    private readonly cookbookHandlers: HandlerMap = {
        glossary: (e) => this.onHoverCard(e, () => ({
            text: DEMO_GLOSSARY[String(e.params['term'])] ?? '—',
        }), this.tooltip),
        profile: (e) => this.onHoverCard(e, () => {
            const user = DEMO_USERS.find((u) => u.id === e.params['userId']);
            return user ? { user } : null;
        }, this.profileCard),
        product: (e) => {
            this.product.set(DEMO_PRODUCTS[String(e.params['sku'])] ?? null);
        },
        track: (e) => this.showToast(`Tracked: ${e.params['event']}`),
        entity: (e) => this.showToast(`Linked to ${e.params['entityId']} (${e.params['source']})`),
    };

    /** Playground merges cookbook + all presets + a catch-all event logger. */
    protected readonly playgroundHandlers: HandlerMap = {
        ...this.cookbookHandlers,
        ...hoverCardHandlers(this.injector),
        ...openDialogHandlers(this.injector),
        ...openDialogHandlers(this.injector, { id: 'preset.pricing', component: DemoPricingComponent }),
        '*': (e) => this.log(e),
    };

    protected readonly presetHandlers: HandlerMap = {
        ...hoverCardHandlers(this.injector),
        ...openDialogHandlers(this.injector),
        ...openDialogHandlers(this.injector, { id: 'preset.pricing', component: DemoPricingComponent }),
    };

    protected readonly tier3Handlers: HandlerMap = { entity: this.cookbookHandlers['entity'] };

    protected readonly readonlyHandlers: HandlerMap = {
        glossary: this.cookbookHandlers['glossary'],
        product: this.cookbookHandlers['product'],
    };

    protected readonly rtlHandlers: HandlerMap = { ...hoverCardHandlers(this.injector) };

    protected readonly v2Handlers: HandlerMap = { ...linkedPreviewDialogHandlers(this.injector) };

    protected async copy(snippet: Snippet): Promise<void> {
        try {
            await navigator.clipboard.writeText(snippet.code);
            this.copiedTitle.set(snippet.title);
            setTimeout(() => this.copiedTitle.set(''), 1500);
        } catch {
            // Clipboard blocked (e.g. insecure context) — no-op; the code is visible to select.
            this.copiedTitle.set('');
        }
    }

    protected dismissProduct(): void {
        this.product.set(null);
    }

    private onHoverCard<T>(
        e: RichTextActionEvent,
        build: () => T | null,
        target: { set(v: (Anchored & T) | null): void },
    ): void {
        if (e.phase === 'end') { target.set(null); return; }
        const payload = build();
        if (!payload) return;
        const r = e.element.getBoundingClientRect();
        target.set({ ...payload, x: r.left, y: r.bottom + 6 });
    }

    private showToast(message: string): void {
        this.toast.set(message);
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.toast.set(null), 2600);
    }

    private log(e: RichTextActionEvent): void {
        if (e.trigger === 'hover' && e.phase === 'end') return;
        const suffix = e.trigger === 'hover' ? ' · hover' : ' · click';
        const line = `${e.actionId}${suffix}`;
        this.eventLog.update((prev) => [line, ...prev].slice(0, 8));
    }

    // The rich-text editor already sanitizes its HTML output, so rendering it
    // verbatim keeps the inert data-action-* hooks the runtime binds to.
    private trust(html: string): SafeHtml {
        // eslint-disable-next-line sonarjs/no-angular-bypass-sanitization
        return this.sanitizer.bypassSecurityTrustHtml(html);
    }
}
