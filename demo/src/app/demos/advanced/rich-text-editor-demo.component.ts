import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { delay, of } from 'rxjs';
import {
  RichTextEditorComponent,
  SwitchComponent,
  MentionItem,
  TagItem,
  ToolbarItem,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-rich-text-editor-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RichTextEditorComponent, SwitchComponent],
  template: `
    <section class="space-y-6">
      <h2 id="rich-text-editor" class="text-2xl font-semibold scroll-m-20">Rich Text Editor</h2>
      <p class="text-muted-foreground">
        A secure, configurable rich text editor with Markdown and HTML support.
      </p>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Basic Editor (Top Toolbar)</h3>
        <ui-rich-text-editor mode="markdown" toolbar="top"
          placeholder="Start typing... Use **bold**, *italic*, or toolbar buttons" minHeight="150px"
          [(ngModel)]="richTextContent" (htmlChange)="richTextHtml = $event" />
        @if (richTextHtml) {
        <details class="mt-2">
          <summary class="text-sm text-muted-foreground cursor-pointer">View HTML Output</summary>
          <pre class="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-32">{{
          richTextHtml
        }}</pre>
        </details>
        }
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Floating Toolbar (Select text)</h3>
        <ui-rich-text-editor mode="markdown" toolbar="floating"
          placeholder="Select text to see the floating toolbar appear..." minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Minimal Toolbar</h3>
        <ui-rich-text-editor mode="markdown" toolbar="top"
          [toolbarItems]="['bold', 'italic', 'separator', 'link', 'emoji']"
          placeholder="Simplified toolbar with just the essentials..." minHeight="100px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">With Mentions & Tags</h3>
        <p class="text-sm text-muted-foreground">Type &#64;button or #angular to trigger autocomplete — mentions link to
          components, tags link to #</p>
        <ui-rich-text-editor mode="markdown" toolbar="top" [mentions]="true" [mentionSearch]="searchMentions"
          [mentionRender]="mentionLinkRender" [tags]="true" [tagSearch]="searchTags" [tagRender]="tagLinkRender"
          placeholder="Type @button, @card, #angular, #typescript..." minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">With Character and Word Count</h3>
        <ui-rich-text-editor mode="markdown" toolbar="top" [showCount]="true" [showWordCount]="true"
          [maxLength]="120" placeholder="Type to see char + word counts below... (Max 120 chars)"
          minHeight="100px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Advanced Config (History + Limits)</h3>
        <p class="text-sm text-muted-foreground">Click a revision to quick-apply, or use Preview for full-screen
          view. Shortcut: Ctrl/Cmd + Shift + H</p>
        <div class="flex items-center gap-2">
          <ui-switch id="richTextShowHistoryButton" [checked]="richTextShowHistoryButton()"
            (checkedChange)="richTextShowHistoryButton.set($event)" />
          <label for="richTextShowHistoryButton" class="text-sm font-medium">Show History Button</label>
        </div>
        @if (!richTextShowHistoryButton()) {
        <p class="text-xs text-muted-foreground">History button hidden. Use Ctrl/Cmd + Shift + H to open history
          browser.</p>
        }
        <ui-rich-text-editor mode="markdown" toolbar="top" [mentions]="true" [mentionSearch]="searchMentions"
          [mentionRender]="mentionLinkRender" [tags]="true" [tagSearch]="searchTags" [tagRender]="tagLinkRender"
          [showCount]="true" [showWordCount]="true" [maxLength]="220" [historyLimit]="180" [showHistoryPanel]="true"
          [showHistoryButton]="richTextShowHistoryButton()" [historyDebounceMs]="500"
          placeholder="Compose a longer note and test undo/redo behavior..." minHeight="160px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Document Outline</h3>
        <p class="text-sm text-muted-foreground">
          Auto-generated table of contents that opens as a docked side panel.
          Click an entry to scroll to the heading; the outline updates live as you
          edit. Open it from the <code>outline</code> toolbar button — or with the
          <code>/outline</code> slash command, which works even without the toolbar item.
        </p>
        <div class="flex items-center gap-2">
          <ui-switch id="richTextOutlineShowToolbarItem" [checked]="richTextOutlineShowToolbarItem()"
            (checkedChange)="richTextOutlineShowToolbarItem.set($event)" />
          <label for="richTextOutlineShowToolbarItem" class="text-sm font-medium">
            Outline toolbar item (off — use /outline)
          </label>
        </div>
        <ui-rich-text-editor mode="html" toolbar="top"
          [toolbarItems]="outlineToolbarItems()"
          [(ngModel)]="richTextOutlineContent"
          minHeight="320px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">HTML Mode (contentEditable)</h3>
        <ui-rich-text-editor mode="html" toolbar="top" placeholder="True WYSIWYG with contentEditable..."
          minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">No Toolbar (Keyboard Only)</h3>
        <p class="text-sm text-muted-foreground">Use Ctrl+B, Ctrl+I, Ctrl+U for formatting</p>
        <ui-rich-text-editor mode="markdown" toolbar="none" variant="ghost"
          placeholder="Clean writing experience - use keyboard shortcuts..." minHeight="100px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Hebrew RTL Locale</h3>
        <p class="text-sm text-muted-foreground">Hebrew locale with automatic RTL layout. Toolbar tooltips, slash
          commands, and all UI strings are translated.</p>
        <ui-rich-text-editor mode="markdown" toolbar="top" locale="he" [showCount]="true" [showWordCount]="true"
          [enableSlashCommands]="true" minHeight="150px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Font Family Selection</h3>
        <p class="text-sm text-muted-foreground">Select text and change its font family. Uses the built-in web-safe font list.</p>
        <ui-rich-text-editor mode="html" toolbar="top"
          [toolbarItems]="['bold', 'italic', 'separator', 'fontFamily', 'fontSize', 'separator', 'fontColor']"
          placeholder="Type something, select it, and pick a font..." minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Custom Font Families (Replace Mode)</h3>
        <p class="text-sm text-muted-foreground">Only custom fonts are shown when using <code class="text-xs bg-muted px-1.5 py-0.5 rounded">fontFamiliesStrategy="replace"</code>.</p>
        <ui-rich-text-editor mode="html" toolbar="top"
          [toolbarItems]="['bold', 'italic', 'separator', 'fontFamily', 'fontSize']"
          [fontFamilies]="['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins']"
          fontFamiliesStrategy="replace"
          placeholder="Custom Google Fonts only..." minHeight="120px" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Auto Image Upload</h3>
        <p class="text-sm text-muted-foreground">
          Paste or drop any image — base64 is automatically replaced with a URL.
          This demo simulates a 2-second upload, then swaps in a cute cat photo.
        </p>
        <ui-rich-text-editor mode="html" toolbar="top" [autoImageUpload]="true" [imageUploader]="fakeImageUploader"
          (autoImageUploadComplete)="lastAutoUploadUrl = $event"
          (autoImageUploadError)="lastAutoUploadError = $event"
          placeholder="Paste or drag an image here to see auto upload in action..." minHeight="160px" />
        @if (lastAutoUploadError) {
        <p class="text-sm text-destructive">Upload failed: {{ lastAutoUploadError }}</p>
        }
        @if (lastAutoUploadUrl) {
        <p class="text-sm text-muted-foreground">
          Uploaded URL: <code class="text-xs bg-muted px-1.5 py-0.5 rounded">{{ lastAutoUploadUrl }}</code>
        </p>
        }
      </div>
    </section>
  `,
})
export class RichTextEditorDemoComponent {
  richTextContent = '';
  richTextHtml = '';
  readonly richTextShowHistoryButton = signal(true);
  readonly richTextOutlineShowToolbarItem = signal(true);
  lastAutoUploadUrl = '';
  lastAutoUploadError = '';

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

  richTextOutlineContent =
    '<h1>Getting Started</h1>' +
    '<p>Welcome to the rich text editor. Use the outline button to navigate.</p>' +
    '<h2>Installation</h2>' +
    '<p>Install the package and import the component.</p>' +
    '<h3>Prerequisites</h3>' +
    '<p>Make sure you have a recent version of Angular.</p>' +
    '<h3>Package Setup</h3>' +
    '<p>Add the component to your imports array.</p>' +
    '<h2>Configuration</h2>' +
    '<p>Configure the editor with inputs and outputs.</p>' +
    '<h3>Toolbar Options</h3>' +
    '<p>Customize which toolbar buttons appear.</p>' +
    '<h2>Advanced Usage</h2>' +
    '<p>Explore mentions, tables, history, and the document outline.</p>';

  readonly fakeImageUploader = (_file: File) =>
    of('https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/1200px-Cat_November_2010-1a.jpg')
      .pipe(delay(2000));

  readonly sampleMentions: MentionItem[] = [
    { id: 'button', value: 'button', label: 'Button', description: 'Inputs' },
    { id: 'card', value: 'card', label: 'Card', description: 'Data Display' },
    { id: 'dialog', value: 'dialog', label: 'Dialog', description: 'Overlay' },
    { id: 'tabs', value: 'tabs', label: 'Tabs', description: 'Navigation' },
    { id: 'timeline', value: 'timeline', label: 'Timeline', description: 'Data Display' },
    { id: 'badge', value: 'badge', label: 'Badge', description: 'Data Display' },
  ];

  readonly sampleTags: TagItem[] = [
    { id: '1', value: 'angular', label: 'Angular', color: '#dd0031' },
    { id: '2', value: 'typescript', label: 'TypeScript', color: '#3178c6' },
    { id: '3', value: 'tailwind', label: 'Tailwind', color: '#06b6d4' },
  ];

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

  readonly searchMentions = (query: string): MentionItem[] => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.sampleMentions;
    }
    return this.sampleMentions.filter(item =>
      item.label.toLowerCase().includes(normalized) ||
      item.value.toLowerCase().includes(normalized)
    );
  };

  readonly searchTags = (query: string): TagItem[] => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.sampleTags;
    }
    return this.sampleTags.filter(item =>
      item.label.toLowerCase().includes(normalized) ||
      item.value.toLowerCase().includes(normalized)
    );
  };
}
