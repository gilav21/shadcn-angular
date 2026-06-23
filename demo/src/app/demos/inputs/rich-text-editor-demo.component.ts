import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { delay, of, Observable } from 'rxjs';
import { AiRequest } from '../../../../../packages/components/lib/ai';
import {
  RichTextEditorComponent,
  SwitchComponent,
  InputComponent,
  SelectComponent,
  MentionItem,
  TagItem,
  ToolbarItem,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { RICH_TEXT_EDITOR_DEMO_LOCALES } from './rich-text-editor-demo.locales';

type ImageAlignmentOption = 'inline' | 'left' | 'center' | 'right';

@Component({
  selector: 'app-rich-text-editor-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RichTextEditorComponent, SwitchComponent, InputComponent, SelectComponent],
  template: `
    <section class="space-y-6">
      <h2 id="rich-text-editor" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().basicHeading }}</h3>
        <ui-rich-text-editor mode="markdown" toolbar="top"
          [placeholder]="t().basicPlaceholder" minHeight="150px"
          [(ngModel)]="richTextContent" (htmlChange)="richTextHtml = $event" />
        @if (richTextHtml) {
        <details class="mt-2">
          <summary class="text-sm text-muted-foreground cursor-pointer">{{ t().viewHtmlLabel }}</summary>
          <pre class="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-32">{{
          richTextHtml
        }}</pre>
        </details>
        }
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().floatingHeading }}</h3>
        <ui-rich-text-editor mode="markdown" toolbar="floating"
          [placeholder]="t().floatingPlaceholder" minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">AI assist</h3>
        <p class="text-sm text-muted-foreground">
          Select some text, then click the <strong>✨ Ask AI</strong> chip to rewrite, shorten, expand, fix grammar,
          summarize, continue, or run a custom prompt. The output streams in; Accept / Discard / Try again.
          This demo wires a <strong>mock</strong> provider (no network) to show the flow.
        </p>
        <ui-rich-text-editor mode="markdown" toolbar="top" [aiProvider]="mockAiProvider"
          [placeholder]="'Type a sentence, select it, then click ✨ Ask AI…'" minHeight="140px" />

        <details class="mt-2 rounded-md border bg-muted/30 p-3">
          <summary class="cursor-pointer text-sm font-medium">Wire up a real AI backend</summary>
          <div class="mt-3 space-y-3 text-sm">
            <p class="text-muted-foreground">
              <code class="bg-muted px-1 rounded">aiProvider</code> is just a callback that returns
              <code class="bg-muted px-1 rounded">string</code> · <code class="bg-muted px-1 rounded">Promise&lt;string&gt;</code> ·
              <code class="bg-muted px-1 rounded">Observable&lt;string&gt;</code>. Point it at <strong>your</strong> backend —
              <strong>never call the model directly from the browser</strong>, or your API key leaks. For the editor's live
              streaming, return an Observable that emits the <strong>full text so far</strong> on each chunk.
            </p>
            <div>
              <p class="mb-1 font-medium">1 — Frontend provider</p>
              <pre class="overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{{ aiFrontendCode }}</pre>
            </div>
            <div>
              <p class="mb-1 font-medium">2 — Backend (Claude via the official SDK, streaming)</p>
              <pre class="overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{{ aiBackendCode }}</pre>
            </div>
            <p class="text-muted-foreground">
              A one-shot <code class="bg-muted px-1 rounded">Promise&lt;string&gt;</code> provider works too — the editor
              just inserts the whole result at once instead of streaming.
            </p>
          </div>
        </details>
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().minimalHeading }}</h3>
        <ui-rich-text-editor mode="markdown" toolbar="top"
          [toolbarItems]="['bold', 'italic', 'separator', 'link', 'emoji']"
          [placeholder]="t().minimalPlaceholder" minHeight="100px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().mentionsHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().mentionsDescription }}</p>
        <ui-rich-text-editor mode="markdown" toolbar="top" [mentions]="true" [mentionSearch]="searchMentions"
          [mentionRender]="mentionLinkRender" [tags]="true" [tagSearch]="searchTags" [tagRender]="tagLinkRender"
          [placeholder]="t().mentionsPlaceholder" minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().countHeading }}</h3>
        <ui-rich-text-editor mode="markdown" toolbar="top" [showCount]="true" [showWordCount]="true"
          [maxLength]="120" [placeholder]="t().countPlaceholder"
          minHeight="100px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().advancedHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().advancedDescription }}</p>
        <div class="flex items-center gap-2">
          <ui-switch id="richTextShowHistoryButton" [checked]="richTextShowHistoryButton()"
            (checkedChange)="richTextShowHistoryButton.set($event)" />
          <label for="richTextShowHistoryButton" class="text-sm font-medium">{{ t().showHistoryLabel }}</label>
        </div>
        @if (!richTextShowHistoryButton()) {
        <p class="text-xs text-muted-foreground">{{ t().historyHiddenNote }}</p>
        }
        <ui-rich-text-editor mode="markdown" toolbar="top" [mentions]="true" [mentionSearch]="searchMentions"
          [mentionRender]="mentionLinkRender" [tags]="true" [tagSearch]="searchTags" [tagRender]="tagLinkRender"
          [showCount]="true" [showWordCount]="true" [maxLength]="220" [historyLimit]="180" [showHistoryPanel]="true"
          [showHistoryButton]="richTextShowHistoryButton()" [historyDebounceMs]="500"
          [placeholder]="t().advancedPlaceholder" minHeight="160px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().outlineHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().outlineDescription }}</p>
        <div class="flex items-center gap-2">
          <ui-switch id="richTextOutlineShowToolbarItem" [checked]="richTextOutlineShowToolbarItem()"
            (checkedChange)="richTextOutlineShowToolbarItem.set($event)" />
          <label for="richTextOutlineShowToolbarItem" class="text-sm font-medium">
            {{ t().outlineToolbarLabel }}
          </label>
        </div>
        <ui-rich-text-editor mode="html" toolbar="top"
          [toolbarItems]="outlineToolbarItems()"
          [(ngModel)]="richTextOutlineContent"
          minHeight="320px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().htmlModeHeading }}</h3>
        <ui-rich-text-editor mode="html" toolbar="top" [placeholder]="t().htmlModePlaceholder"
          minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().noToolbarHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().noToolbarDescription }}</p>
        <ui-rich-text-editor mode="markdown" toolbar="none" variant="ghost"
          [placeholder]="t().noToolbarPlaceholder" minHeight="100px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().hebrewHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().hebrewDescription }}</p>
        <ui-rich-text-editor mode="markdown" toolbar="top" locale="he" [showCount]="true" [showWordCount]="true"
          [enableSlashCommands]="true" minHeight="150px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().fontFamilyHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().fontFamilyDescription }}</p>
        <ui-rich-text-editor mode="html" toolbar="top"
          [toolbarItems]="['bold', 'italic', 'separator', 'fontFamily', 'fontSize', 'separator', 'fontColor']"
          [placeholder]="t().fontFamilyPlaceholder" minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().customFontHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().customFontDescription }}</p>
        <ui-rich-text-editor mode="html" toolbar="top"
          [toolbarItems]="['bold', 'italic', 'separator', 'fontFamily', 'fontSize']"
          [fontFamilies]="['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins']"
          fontFamiliesStrategy="replace"
          [placeholder]="t().customFontPlaceholder" minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().imageUploadHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().imageUploadDescription }}</p>
        <ui-rich-text-editor mode="html" toolbar="top" [autoImageUpload]="true" [imageUploader]="fakeImageUploader"
          (autoImageUploadComplete)="lastAutoUploadUrl = $event"
          (autoImageUploadError)="lastAutoUploadError = $event"
          [placeholder]="t().imageUploadPlaceholder" minHeight="160px" />
        @if (lastAutoUploadError) {
        <p class="text-sm text-destructive">{{ t().uploadFailedLabel }} {{ lastAutoUploadError }}</p>
        }
        @if (lastAutoUploadUrl) {
        <p class="text-sm text-muted-foreground">
          {{ t().uploadedUrlLabel }} <code class="text-xs bg-muted px-1.5 py-0.5 rounded">{{ lastAutoUploadUrl }}</code>
        </p>
        }
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">{{ t().imageControlsHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().imageControlsDescription }}</p>
        <p class="text-sm text-muted-foreground">{{ t().playgroundHint }}</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border bg-card p-4 sm:p-6">
          <div class="space-y-1.5">
            <label for="imgDefaultWidth" class="text-sm font-medium">{{ t().defaultWidthLabel }}</label>
            <ui-input elementId="imgDefaultWidth" placeholder="200px"
              [ngModel]="imgDefaultWidthRaw()" (ngModelChange)="imgDefaultWidthRaw.set($event)" />
          </div>
          <div class="space-y-1.5">
            <label for="imgDefaultHeight" class="text-sm font-medium">{{ t().defaultHeightLabel }}</label>
            <ui-input elementId="imgDefaultHeight" placeholder="auto"
              [ngModel]="imgDefaultHeightRaw()" (ngModelChange)="imgDefaultHeightRaw.set($event)" />
          </div>
          <div class="space-y-1.5">
            <span id="imgDefaultAlignmentLabel" class="text-sm font-medium">{{ t().defaultAlignmentLabel }}</span>
            <ui-select class="w-full" ariaLabelledby="imgDefaultAlignmentLabel"
              [options]="alignmentOptions" [displayWith]="alignmentDisplay()"
              [value]="imgDefaultAlignment()" (valueChange)="imgDefaultAlignment.set($event)" />
          </div>
          <div class="space-y-1.5">
            <label for="imgMinWidth" class="text-sm font-medium">{{ t().minWidthLabel }}</label>
            <ui-input elementId="imgMinWidth" type="number" placeholder="20"
              [ngModel]="imgMinWidthRaw()" (ngModelChange)="imgMinWidthRaw.set($event)" />
          </div>
          <div class="space-y-1.5">
            <label for="imgMaxWidth" class="text-sm font-medium">{{ t().maxWidthLabel }}</label>
            <ui-input elementId="imgMaxWidth" type="number" placeholder="480"
              [ngModel]="imgMaxWidthRaw()" (ngModelChange)="imgMaxWidthRaw.set($event)" />
          </div>
          <div class="flex flex-col justify-center gap-3">
            <div class="flex items-center gap-2">
              <ui-switch id="imgResize" [checked]="imgResize()" (checkedChange)="imgResize.set($event)" />
              <label for="imgResize" class="text-sm font-medium">{{ t().enableResizeLabel }}</label>
            </div>
            <div class="flex items-center gap-2">
              <ui-switch id="imgAlignmentButtons" [checked]="imgAlignmentButtons()"
                (checkedChange)="imgAlignmentButtons.set($event)" />
              <label for="imgAlignmentButtons" class="text-sm font-medium">{{ t().showAlignmentLabel }}</label>
            </div>
            <div class="flex items-center gap-2">
              <ui-switch id="imgLockAspect" [checked]="imgLockAspect()" (checkedChange)="imgLockAspect.set($event)" />
              <label for="imgLockAspect" class="text-sm font-medium">{{ t().lockAspectLabel }}</label>
            </div>
          </div>
        </div>

        <ui-rich-text-editor mode="html" toolbar="top"
          [imageResize]="imgResize()"
          [imageAlignment]="imgAlignmentButtons()"
          [defaultImageWidth]="imgDefaultWidth()"
          [defaultImageHeight]="imgDefaultHeight()"
          [defaultImageAlignment]="imgDefaultAlignment()"
          [minImageWidth]="imgMinWidth()"
          [maxImageWidth]="imgMaxWidth()"
          [lockImageAspectRatio]="imgLockAspect()"
          [placeholder]="t().imageControlsPlaceholder" minHeight="200px" />
      </div>
    </section>
  `,
})
export class RichTextEditorDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => RICH_TEXT_EDITOR_DEMO_LOCALES[this.localeId()] ?? RICH_TEXT_EDITOR_DEMO_LOCALES['en']);

  richTextContent = '';
  richTextHtml = '';
  readonly richTextShowHistoryButton = signal(true);
  readonly richTextOutlineShowToolbarItem = signal(true);
  lastAutoUploadUrl = '';
  lastAutoUploadError = '';

  readonly imgResize = signal(true);
  readonly imgAlignmentButtons = signal(true);
  readonly imgLockAspect = signal(true);
  readonly imgDefaultWidthRaw = signal('200px');
  readonly imgDefaultHeightRaw = signal('');
  readonly imgMinWidthRaw = signal('80');
  readonly imgMaxWidthRaw = signal('480');
  readonly imgDefaultAlignment = signal<ImageAlignmentOption>('center');

  readonly alignmentOptions: ImageAlignmentOption[] = ['inline', 'left', 'center', 'right'];

  readonly alignmentDisplay = computed(() => {
    const loc = this.t();
    const labels: Record<ImageAlignmentOption, string> = {
      inline: loc.alignInline,
      left: loc.alignLeft,
      center: loc.alignCenter,
      right: loc.alignRight,
    };
    return (value: ImageAlignmentOption): string => labels[value];
  });

  readonly imgDefaultWidth = computed(() => this.normalizeSize(this.imgDefaultWidthRaw()));
  readonly imgDefaultHeight = computed(() => this.normalizeSize(this.imgDefaultHeightRaw()));
  readonly imgMinWidth = computed(() => this.toPositiveInt(this.imgMinWidthRaw()) ?? 20);
  readonly imgMaxWidth = computed(() => this.toPositiveInt(this.imgMaxWidthRaw()));

  private normalizeSize(raw: string): string | undefined {
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }
    return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
  }

  private toPositiveInt(raw: string): number | undefined {
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private readonly outlineToolbarBase: ToolbarItem[] = [
    'bold', 'italic', 'underline',
    'separator',
    'paragraph', 'heading1', 'heading2', 'heading3',
    'separator',
    'bulletList', 'orderedList',
  ];

  readonly outlineToolbarItems = computed<ToolbarItem[]>(() =>
    this.richTextOutlineShowToolbarItem()
      ? [...this.outlineToolbarBase, 'separator', 'outline']
      : this.outlineToolbarBase
  );

  richTextOutlineContent = '';

  readonly sampleMentions = signal<MentionItem[]>([]);
  readonly sampleTags = signal<TagItem[]>([]);

  constructor() {
    effect(() => {
      const loc = this.t();
      this.sampleMentions.set([
        { id: 'button', value: 'button', label: loc.mentionButtonLabel, description: loc.mentionButtonDescription },
        { id: 'card', value: 'card', label: loc.mentionCardLabel, description: loc.mentionCardDescription },
        { id: 'dialog', value: 'dialog', label: loc.mentionDialogLabel, description: loc.mentionDialogDescription },
        { id: 'tabs', value: 'tabs', label: loc.mentionTabsLabel, description: loc.mentionTabsDescription },
        { id: 'timeline', value: 'timeline', label: loc.mentionTimelineLabel, description: loc.mentionTimelineDescription },
        { id: 'badge', value: 'badge', label: loc.mentionBadgeLabel, description: loc.mentionBadgeDescription },
      ]);
      this.sampleTags.set([
        { id: '1', value: 'angular', label: loc.tagAngularLabel, color: '#dd0031' },
        { id: '2', value: 'typescript', label: loc.tagTypescriptLabel, color: '#3178c6' },
        { id: '3', value: 'tailwind', label: loc.tagTailwindLabel, color: '#06b6d4' },
      ]);
      this.richTextOutlineContent =
        `<h1>${loc.outlineH1}</h1>` +
        `<p>${loc.outlineIntroP}</p>` +
        `<h2>${loc.outlineH2Installation}</h2>` +
        `<p>${loc.outlineInstallationP}</p>` +
        `<h3>${loc.outlineH3Prerequisites}</h3>` +
        `<p>${loc.outlinePrerequisitesP}</p>` +
        `<h3>${loc.outlineH3PackageSetup}</h3>` +
        `<p>${loc.outlinePackageSetupP}</p>` +
        `<h2>${loc.outlineH2Configuration}</h2>` +
        `<p>${loc.outlineConfigurationP}</p>` +
        `<h3>${loc.outlineH3ToolbarOptions}</h3>` +
        `<p>${loc.outlineToolbarOptionsP}</p>` +
        `<h2>${loc.outlineH2AdvancedUsage}</h2>` +
        `<p>${loc.outlineAdvancedUsageP}</p>`;
    });
  }

  readonly mentionLinkRender = {
    mode: 'link' as const,
    urlTemplate: 'https://intranet.example.com/users/:userId',
    className: 'bg-accent/20 text-primary rounded px-1 underline underline-offset-2',
    target: '_blank',
    rel: 'noopener noreferrer',
  };

  readonly tagLinkRender = {
    mode: 'link' as const,
    urlTemplate: 'https://intranet.example.com/tags/@@tagId@@?sort=asc',
    className: 'bg-accent/20 text-primary rounded px-1 underline underline-offset-2',
    target: '_blank',
    rel: 'noopener noreferrer',
  };

  readonly fakeImageUploader = (_file: File) =>
    of('https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/1200px-Cat_November_2010-1a.jpg')
      .pipe(delay(2000));

  readonly searchMentions = (query: string): MentionItem[] => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.sampleMentions();
    }
    return this.sampleMentions().filter(item =>
      item.label.toLowerCase().includes(normalized) ||
      item.value.toLowerCase().includes(normalized)
    );
  };

  /** Mock AI provider — streams a canned transformation word-by-word (no network). */
  readonly mockAiProvider = (req: AiRequest): Observable<string> => {
    const words = this.mockAiOutput(req).split(' ');
    return new Observable<string>(subscriber => {
      let i = 0;
      const id = setInterval(() => {
        i++;
        subscriber.next(words.slice(0, i).join(' '));
        if (i >= words.length) {
          clearInterval(id);
          subscriber.complete();
        }
      }, 50);
      return () => clearInterval(id);
    });
  };

  private mockAiOutput(req: AiRequest): string {
    const input = req.input.trim();
    const wordCount = input.split(/\s+/).filter(Boolean).length;
    if (req.task === 'shorten') {
      return input.split(/\s+/).slice(0, Math.max(1, Math.ceil(wordCount / 2))).join(' ') + '.';
    }
    if (req.task === 'expand') {
      return `${input} Moreover, this expanded version adds supporting detail and a touch more context for the reader.`;
    }
    if (req.task === 'fix-grammar') {
      return input.charAt(0).toUpperCase() + input.slice(1).replace(/\s+/g, ' ');
    }
    if (req.task === 'summarize') {
      return `In short: ${input.split(/\s+/).slice(0, 8).join(' ')}…`;
    }
    if (req.task === 'continue') {
      return ' …and from there the idea naturally led to the next step.';
    }
    if (req.task === 'custom') {
      return `(${req.prompt ?? ''}) ${input}`;
    }
    return `Improved: ${input}`;
  }

  // Copy-paste guidance for wiring a real AI backend (rendered as plain text).
  readonly aiFrontendCode = [
    "// In your component — point the provider at YOUR backend.",
    "// The API key lives on the server and never touches the browser.",
    "import { AiRequest } from '@gilav21/shadcn-angular';",
    "import { Observable } from 'rxjs';",
    "",
    "// Streaming provider → drives the editor's live typewriter effect.",
    "readonly aiProvider = (req: AiRequest): Observable<string> =>",
    "  new Observable<string>((sub) => {",
    "    const ctrl = new AbortController();",
    "    req.signal?.addEventListener('abort', () => ctrl.abort());",
    "    let text = '';",
    "    fetch('/api/ai', {",
    "      method: 'POST',",
    "      headers: { 'content-type': 'application/json' },",
    "      body: JSON.stringify(req),   // { task, input, prompt, context }",
    "      signal: ctrl.signal,",
    "    }).then(async (res) => {",
    "      const reader = res.body!.getReader();",
    "      const decoder = new TextDecoder();",
    "      for (;;) {",
    "        const { done, value } = await reader.read();",
    "        if (done) break;",
    "        text += decoder.decode(value, { stream: true });",
    "        sub.next(text);            // emit the FULL text so far",
    "      }",
    "      sub.complete();",
    "    }).catch((err) => sub.error(err));",
    "    return () => ctrl.abort();",
    "  });",
  ].join('\n');

  readonly aiBackendCode = [
    "// Backend (Node / Express) — holds ANTHROPIC_API_KEY; the browser never sees it.",
    "// npm i @anthropic-ai/sdk",
    "import Anthropic from '@anthropic-ai/sdk';",
    "const client = new Anthropic();",
    "",
    "const SYSTEM: Record<string, string> = {",
    "  rewrite: 'Rewrite the text to read better. Return only the rewritten text.',",
    "  shorten: 'Make the text shorter. Return only the result.',",
    "  expand: 'Expand the text with useful detail. Return only the result.',",
    "  'fix-grammar': 'Fix spelling and grammar. Return only the corrected text.',",
    "  summarize: 'Summarize the text in one or two sentences.',",
    "  continue: 'Continue the text naturally. Return only the continuation.',",
    "  custom: 'Apply the user instruction to the given text.',",
    "};",
    "",
    "app.post('/api/ai', async (req, res) => {",
    "  const { task, input, prompt } = req.body;",
    "  res.setHeader('content-type', 'text/plain; charset=utf-8');",
    "  const stream = client.messages.stream({",
    "    model: 'claude-opus-4-8',",
    "    max_tokens: 1024,",
    "    system: SYSTEM[task] ?? 'You are a helpful writing assistant.',",
    "    messages: [{ role: 'user', content: prompt ? prompt + ' — ' + input : input }],",
    "  });",
    "  stream.on('text', (delta) => res.write(delta));  // stream tokens to the browser",
    "  await stream.finalMessage();",
    "  res.end();",
    "});",
  ].join('\n');

  readonly searchTags = (query: string): TagItem[] => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.sampleTags();
    }
    return this.sampleTags().filter(item =>
      item.label.toLowerCase().includes(normalized) ||
      item.value.toLowerCase().includes(normalized)
    );
  };
}
