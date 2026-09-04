import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  RichTextEditorComponent,
  ButtonComponent,
  SwitchComponent,
} from '../../../../../packages/components/ui';
import { RTE_FULL } from '../../../../../packages/components/ui/rich-text-editor/addons/full';
import { RichTextInsertDateDirective } from './rich-text-insert-date.directive';
import type { RichTextActionDefinition } from '../../../../../packages/components/ui/rich-text-editor/addons/actions';
import type { MentionItem, TagItem } from '../../../../../packages/components/ui/rich-text-editor/addons/mentions';
import type { AiRequest } from '../../../../../packages/components/lib/ai';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  RICH_TEXT_EDITOR_ADDONS_DEMO_LOCALES,
  type RichTextEditorAddonsDemoLocale,
} from './rich-text-editor-addons-demo.locales';

type AddonKey =
  | 'colors' | 'typography' | 'emoji'
  | 'links' | 'images' | 'tables' | 'fileImport' | 'slashCommands'
  | 'history' | 'outline'
  | 'ai' | 'mentions' | 'actions';

type PresetKey = 'core' | 'writing' | 'media' | 'styling' | 'everything';

interface AddonMeta {
  /** Registry key for the `apply rich-text-editor/<registry>` command. */
  readonly registry: string;
  /** The individual-attributes template form emitted for this addon when enabled. */
  readonly snippet: string;
  /** The addon's own file count (`npx shadcn-angular why rich-text-editor/<registry>` → Files N). */
  readonly files: number;
  /** Locale key for the toggle label. */
  readonly labelKey: keyof RichTextEditorAddonsDemoLocale;
}

/**
 * Per-addon metadata. `files` counts come from `npx shadcn-angular why
 * rich-text-editor/<addon>` (the "Files (N)" line) — stable registry data.
 */
const ADDON_META: Record<AddonKey, AddonMeta> = {
  colors: { registry: 'colors', snippet: 'uiRteColors', files: 6, labelKey: 'addonColors' },
  typography: { registry: 'typography', snippet: 'uiRteTypography', files: 6, labelKey: 'addonTypography' },
  emoji: { registry: 'emoji', snippet: 'uiRteEmoji', files: 6, labelKey: 'addonEmoji' },
  links: { registry: 'links', snippet: 'uiRteLinks', files: 8, labelKey: 'addonLinks' },
  images: { registry: 'images', snippet: 'uiRteImages', files: 11, labelKey: 'addonImages' },
  tables: { registry: 'tables', snippet: 'uiRteTables', files: 6, labelKey: 'addonTables' },
  fileImport: { registry: 'file-import', snippet: 'uiRteFileImport', files: 9, labelKey: 'addonFileImport' },
  slashCommands: { registry: 'slash-commands', snippet: 'uiRteSlashCommands', files: 7, labelKey: 'addonSlashCommands' },
  history: { registry: 'history', snippet: 'uiRteHistory', files: 5, labelKey: 'addonHistory' },
  outline: { registry: 'outline', snippet: 'uiRteOutline', files: 6, labelKey: 'addonOutline' },
  ai: { registry: 'ai', snippet: '[uiRteAi]="aiProvider"', files: 8, labelKey: 'addonAi' },
  mentions: { registry: 'mentions', snippet: 'uiRteMentions [uiRteMentionsSearch]="searchUsers"', files: 7, labelKey: 'addonMentions' },
  actions: { registry: 'actions', snippet: '[uiRteActions]="actionDefs"', files: 18, labelKey: 'addonActions' },
};

const ADDON_KEYS = Object.keys(ADDON_META) as AddonKey[];

/** Base `rich-text-editor` file count (`npx shadcn-angular why rich-text-editor` → Files 12). */
const BASE_FILES = 12;

const PRESETS: Record<PresetKey, AddonKey[]> = {
  core: [],
  writing: ['slashCommands', 'links', 'history', 'outline'],
  media: ['images', 'tables', 'fileImport'],
  styling: ['colors', 'typography', 'emoji'],
  everything: ADDON_KEYS,
};

interface AddonGroup {
  readonly labelKey: keyof RichTextEditorAddonsDemoLocale;
  readonly keys: AddonKey[];
}

function allOn(): Record<AddonKey, boolean> {
  const state = {} as Record<AddonKey, boolean>;
  for (const key of ADDON_KEYS) {
    state[key] = true;
  }
  return state;
}

/**
 * The worked example from `docs/rich-text-editor.md`, kept here as a string so
 * the page can show the whole addon without a build-time file read. It is the
 * same directive the editor below actually runs.
 */
const INSERT_DATE_SOURCE = `import { Directive, effect, inject, input } from '@angular/core';
import { RichTextEditorAddonHost } from '@/components/ui/rich-text-editor';

const ICON = \`<svg …calendar glyph… />\`;

@Directive({ selector: 'ui-rich-text-editor[uiRteInsertDate]' })
export class RichTextInsertDateDirective {
  private readonly host = inject(RichTextEditorAddonHost);

  readonly uiRteInsertDateLocale = input<string>();
  readonly uiRteInsertDateOrder = input(900);

  constructor() {
    effect((onCleanup) => {
      onCleanup(this.host.toolbarSlots.register({
        id: 'insert-date',
        icon: ICON,
        tooltip: "Insert today's date",
        order: this.uiRteInsertDateOrder(),
        isEnabled: () => !this.host.readonly() && !this.host.disabled(),
        onClick: () => this.host.insertTextAtCaret(
          new Intl.DateTimeFormat(this.uiRteInsertDateLocale()).format(new Date()),
        ),
      }));
    });
  }
}`;

@Component({
  selector: 'app-rich-text-editor-addons-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RichTextEditorComponent, ...RTE_FULL, ButtonComponent, SwitchComponent, RichTextInsertDateDirective],
  template: `
    <section class="space-y-6">
      <h2 id="rich-text-editor-addons" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-2">
        <h3 class="text-sm font-medium text-muted-foreground">{{ t().presetsLabel }}</h3>
        <div class="flex flex-wrap gap-2">
          <ui-button variant="outline" size="sm" (click)="applyPreset('core')">{{ t().presetCore }}</ui-button>
          <ui-button variant="outline" size="sm" (click)="applyPreset('writing')">{{ t().presetWriting }}</ui-button>
          <ui-button variant="outline" size="sm" (click)="applyPreset('media')">{{ t().presetMedia }}</ui-button>
          <ui-button variant="outline" size="sm" (click)="applyPreset('styling')">{{ t().presetStyling }}</ui-button>
          <ui-button variant="default" size="sm" (click)="applyPreset('everything')">{{ t().presetEverything }}</ui-button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (group of groups; track group.labelKey) {
        <fieldset class="rounded-lg border bg-card p-4 space-y-3">
          <legend class="px-1 text-sm font-semibold">{{ t()[group.labelKey] }}</legend>
          @for (key of group.keys; track key) {
          <div class="flex flex-wrap items-center gap-2">
            <ui-switch [elementId]="'addon-toggle-' + key" [checked]="addons()[key]"
              (checkedChange)="setAddon(key, $event)" />
            <label [for]="'addon-toggle-' + key" class="text-sm font-medium">{{ addonLabels()[key] }}</label>
          </div>
          }
        </fieldset>
        }
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().editorHeading }}</h3>
        <ui-rich-text-editor mode="html" toolbar="top" uiRteFull minHeight="220px"
          [placeholder]="t().editorPlaceholder"
          [uiRteColors]="addons().colors"
          [uiRteTypography]="addons().typography"
          [uiRteEmoji]="addons().emoji"
          [uiRteLinks]="addons().links"
          [uiRteImages]="addons().images"
          [uiRteTables]="addons().tables"
          [uiRteFileImport]="addons().fileImport"
          [uiRteSlashCommands]="addons().slashCommands"
          [uiRteHistory]="addons().history"
          [uiRteOutline]="addons().outline"
          [uiRteAi]="addons().ai ? mockAiProvider : undefined"
          [uiRteMentions]="addons().mentions"
          [uiRteMentionsSearch]="searchMentions"
          [uiRteTags]="addons().mentions"
          [uiRteTagsSearch]="searchTags"
          [uiRteActions]="addons().actions ? demoActions : noActions" />

        @if (enabledCount() === 0) {
        <p class="text-sm text-muted-foreground">{{ t().allOffNote }}</p>
        }

        @if (addons().fileImport) {
        <p class="text-sm text-muted-foreground">
          Try the import button with an example PDF:
          @for (example of examplePdfs; track example) {
            <a class="text-primary underline underline-offset-2 me-2" [href]="'/examples/' + example" download>{{ example }}</a>
          }
        </p>
        }
        <div class="space-y-1 text-sm text-muted-foreground">
          @if (addons().slashCommands) { <p>{{ t().slashHint }}</p> }
          @if (addons().mentions) { <p>{{ t().mentionsHint }}</p> }
          @if (addons().ai) { <p>{{ t().aiHint }}</p> }
          @if (addons().actions) { <p>{{ t().actionsHint }}</p> }
        </div>
      </div>

      <div data-testid="write-your-own-addon" class="space-y-3 rounded-md border p-4">
        <h3 class="text-lg font-semibold">{{ t().writeOwnHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().writeOwnDescription }}</p>
        <ui-rich-text-editor
          uiRteInsertDate
          mode="html"
          minHeight="120px"
          [placeholder]="t().writeOwnEditorPlaceholder"
        />
        <div class="space-y-1.5">
          <p class="text-sm font-medium">{{ t().writeOwnCodeLabel }}</p>
          <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{{ insertDateSource }}</pre>
        </div>
      </div>

      <details class="rounded-md border bg-muted/30 p-3">
        <summary class="cursor-pointer text-sm font-medium">{{ t().codePanelSummary }}</summary>
        <div class="mt-3 space-y-4">
          <div class="space-y-1.5">
            <p class="text-sm font-medium">{{ t().templateLabel }}</p>
            <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{{ templateSnippet() }}</pre>
          </div>
          <div class="space-y-1.5">
            <p class="text-sm font-medium">{{ t().commandsLabel }}</p>
            <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{{ installCommands() }}</pre>
          </div>
          <p class="text-sm">
            <span class="font-medium">{{ t().footprintLabel }}:</span>
            {{ t().footprintBaseWord }} {{ baseFiles }} {{ t().filesWord }} + {{ addonFilesCount() }}
            {{ t().addonFilesWord }} ({{ enabledCount() }} {{ t().addonsWord }})
          </p>
        </div>
      </details>
    </section>
  `,
})
export class RichTextEditorAddonsDemoComponent {
  /** Source of the worked-example addon, shown verbatim on the page. */
  protected readonly insertDateSource = INSERT_DATE_SOURCE;

  /** Fictional example documents shipped with the demo under /examples. */
  readonly examplePdfs = ['invoice.pdf', 'newsletter.pdf', 'quarterly-report.pdf', 'hebrew-receipt.pdf', 'registration-form.pdf'];

  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => RICH_TEXT_EDITOR_ADDONS_DEMO_LOCALES[this.localeId()] ?? RICH_TEXT_EDITOR_ADDONS_DEMO_LOCALES['en'],
  );

  protected readonly baseFiles = BASE_FILES;
  protected readonly addons = signal<Record<AddonKey, boolean>>(allOn());

  protected readonly groups: AddonGroup[] = [
    { labelKey: 'groupFormatting', keys: ['colors', 'typography', 'emoji'] },
    { labelKey: 'groupInsert', keys: ['links', 'images', 'tables', 'fileImport', 'slashCommands'] },
    { labelKey: 'groupOverlays', keys: ['history', 'outline'] },
    { labelKey: 'groupIntelligence', keys: ['ai', 'mentions', 'actions'] },
  ];

  protected readonly addonLabels = computed<Record<AddonKey, string>>(() => {
    const loc = this.t();
    const labels = {} as Record<AddonKey, string>;
    for (const key of ADDON_KEYS) {
      labels[key] = loc[ADDON_META[key].labelKey];
    }
    return labels;
  });

  protected readonly enabledKeys = computed(() => ADDON_KEYS.filter((key) => this.addons()[key]));
  protected readonly enabledCount = computed(() => this.enabledKeys().length);
  protected readonly addonFilesCount = computed(() =>
    this.enabledKeys().reduce((sum, key) => sum + ADDON_META[key].files, 0),
  );

  protected readonly templateSnippet = computed(() => {
    const enabled = this.enabledKeys();
    const open = '<ui-rich-text-editor mode="html" toolbar="top"';
    if (enabled.length === ADDON_KEYS.length) {
      return `${open} uiRteFull />`;
    }
    if (enabled.length === 0) {
      return `${open} />`;
    }
    const attrs = enabled.map((key) => ADDON_META[key].snippet);
    return `${open}\n  ${attrs.join('\n  ')} />`;
  });

  protected readonly installCommands = computed(() => {
    const enabled = this.enabledKeys();
    const lines = ['npx @gilav21/shadcn-angular add rich-text-editor'];
    for (const key of enabled) {
      lines.push(`npx @gilav21/shadcn-angular apply rich-text-editor/${ADDON_META[key].registry}`);
    }
    return `${this.t().commandsBaseNote}\n${lines.join('\n')}`;
  });

  protected setAddon(key: AddonKey, enabled: boolean): void {
    this.addons.update((state) => ({ ...state, [key]: enabled }));
  }

  protected applyPreset(preset: PresetKey): void {
    const on = new Set(PRESETS[preset]);
    const state = {} as Record<AddonKey, boolean>;
    for (const key of ADDON_KEYS) {
      state[key] = on.has(key);
    }
    this.addons.set(state);
  }

  // ── Mock addon config (canned, no network) ─────────────────────────

  protected readonly noActions: RichTextActionDefinition[] = [];
  protected readonly demoActions: RichTextActionDefinition[] = [
    {
      id: 'demo.tooltip',
      label: 'Tooltip',
      description: 'Show a tooltip when the reader hovers the selection',
      triggers: ['hover'],
      fields: [
        { key: 'text', label: 'Tooltip text', type: 'text', required: true, placeholder: 'A helpful hint…' },
      ],
    },
  ];

  private readonly demoMentions: MentionItem[] = [
    { id: 'button', value: 'button', label: 'Button', description: 'ui-button' },
    { id: 'card', value: 'card', label: 'Card', description: 'ui-card' },
    { id: 'dialog', value: 'dialog', label: 'Dialog', description: 'ui-dialog' },
    { id: 'tabs', value: 'tabs', label: 'Tabs', description: 'ui-tabs' },
  ];

  private readonly demoTags: TagItem[] = [
    { id: '1', value: 'angular', label: 'Angular', color: '#dd0031' },
    { id: '2', value: 'typescript', label: 'TypeScript', color: '#3178c6' },
    { id: '3', value: 'tailwind', label: 'Tailwind', color: '#06b6d4' },
  ];

  protected readonly searchMentions = (query: string): MentionItem[] => filterByLabel(this.demoMentions, query);
  protected readonly searchTags = (query: string): TagItem[] => filterByLabel(this.demoTags, query);

  /** Mock AI provider — resolves canned text after a short delay (no network). */
  protected readonly mockAiProvider = (req: AiRequest): Promise<string> =>
    new Promise((resolve) => setTimeout(() => resolve(cannedAiOutput(req)), 300));
}

function filterByLabel<T extends { label: string; value: string }>(items: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return items;
  }
  return items.filter((item) => item.label.toLowerCase().includes(needle) || item.value.toLowerCase().includes(needle));
}

function cannedAiOutput(req: AiRequest): string {
  const input = req.input.trim();
  if (req.task === 'shorten') {
    return `${input.split(/\s+/).slice(0, 6).join(' ')}.`;
  }
  if (req.task === 'expand') {
    return `${input} It also adds a little supporting detail for the reader.`;
  }
  if (req.task === 'summarize') {
    return `In short: ${input.split(/\s+/).slice(0, 8).join(' ')}…`;
  }
  if (req.task === 'custom') {
    return `(${req.prompt ?? ''}) ${input}`;
  }
  return `Improved: ${input}`;
}
