import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RichTextToolbarComponent } from './sub/rich-text-toolbar.component';
import { RichTextMentionPopoverComponent, MentionItem, TagItem } from './sub/rich-text-mention.component';
import { RichTextSlashCommand } from './rich-text-command-registry.service';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { RICH_TEXT_LOCALES } from './rich-text-locales';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { Component } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { delay, of } from 'rxjs';

const sampleMentions: MentionItem[] = [
    { id: '1', value: 'john-doe', label: 'John Doe', description: 'john.doe@example.com' },
    { id: '2', value: 'jane.smith', label: 'Jane Smith', description: 'jane.smith@example.com' },
    { id: '3', value: 'team_ops', label: 'Team Ops', description: 'ops@example.com' },
];

const sampleTags: TagItem[] = [
    { id: '1', value: 'angular.ui', label: 'Angular UI', color: '#dd0031' },
    { id: '2', value: 'typescript-5', label: 'TypeScript 5', color: '#3178c6' },
    { id: '3', value: 'release_2026', label: 'Release 2026', color: '#06b6d4' },
];

const filterByQuery = <T extends { label: string; value: string }>(items: T[], query: string): T[] => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return items;
    }
    return items.filter(item =>
        item.label.toLowerCase().includes(normalized) ||
        item.value.toLowerCase().includes(normalized)
    );
};

const mentionSearch = (query: string): MentionItem[] => filterByQuery(sampleMentions, query);
const tagSearch = (query: string): TagItem[] => filterByQuery(sampleTags, query);

const customSlashCommands: RichTextSlashCommand[] = [
    {
        id: 'custom.insert-callout',
        label: 'Insert Callout',
        description: 'Adds a callout block template',
        keywords: ['callout', 'tip'],
        order: 1,
        run: (context) => context.insertHtml('<blockquote><strong>Callout:</strong> Add details here.</blockquote>'),
    },
    {
        id: 'custom.insert-divider',
        label: 'Insert Divider',
        description: 'Adds a horizontal divider',
        keywords: ['divider', 'hr'],
        order: 2,
        run: (context) => context.insertHtml('<hr />'),
    },
];

const meta: Meta<RichTextEditorComponent> = {
    title: 'Components/RichTextEditor',
    component: RichTextEditorComponent,
    decorators: [
        moduleMetadata({
            imports: [
                RichTextEditorComponent,
                RichTextToolbarComponent,
                RichTextMentionPopoverComponent,
                FormsModule,
                ReactiveFormsModule,
            ],
            providers: [RichTextSanitizerService, RichTextMarkdownService],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        mode: {
            control: 'radio',
            options: ['markdown', 'html'],
            description: 'Editor mode: markdown-internal or html contentEditable',
        },
        toolbar: {
            control: 'radio',
            options: ['top', 'floating', 'none'],
            description: 'Toolbar position',
        },
        variant: {
            control: 'radio',
            options: ['default', 'ghost'],
        },
        placeholder: {
            control: 'text',
        },
        minHeight: {
            control: 'text',
        },
        maxHeight: {
            control: 'text',
        },
        showHistoryPanel: {
            control: 'boolean',
            description: 'Show revision history panel for jumping to a previous snapshot',
        },
        showHistoryButton: {
            control: 'boolean',
            description: 'Show/hide the History button (Ctrl/Cmd+Shift+H shortcut still works)',
        },
        enableSlashCommands: {
            control: 'boolean',
            description: 'Enable slash command palette (type / in editor)',
        },
        locale: {
            control: 'select',
            options: Object.keys(RICH_TEXT_LOCALES),
            description: 'Locale for UI strings and automatic RTL',
        },
        historyDebounceMs: {
            control: { type: 'number', min: 0, max: 2000, step: 50 },
            description: 'Debounce duration (ms) before a typing snapshot is persisted',
        },
    },
};

export default meta;
type Story = StoryObj<RichTextEditorComponent>;

export const Default: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        placeholder: 'Write something amazing...',
        minHeight: '150px',
        maxHeight: '400px',
    },
};

export const HtmlMode: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        placeholder: 'WYSIWYG editing...',
        minHeight: '150px',
        maxHeight: '400px',
    },
};

export const FloatingToolbar: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'floating',
        placeholder: 'Select text to see the floating toolbar...',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Toolbar appears when text is selected. Great for distraction-free writing.',
            },
        },
    },
};

export const NoToolbar: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'none',
        placeholder: 'Keyboard shortcuts only (Ctrl+B, Ctrl+I, etc.)',
        minHeight: '150px',
    },
};

export const MinimalToolbar: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        toolbarItems: ['bold', 'italic', 'separator', 'link', 'emoji'],
        placeholder: 'Minimal toolbar...',
        minHeight: '150px',
    },
};

export const FullToolbar: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        toolbarItems: [
            'bold', 'italic', 'underline', 'strikethrough',
            'separator',
            'heading1', 'heading2', 'heading3',
            'separator',
            'bulletList', 'orderedList', 'blockquote',
            'separator',
            'code', 'codeBlock',
            'separator',
            'link', 'image', 'emoji',
            'separator',
            'undo', 'redo', 'clear',
        ],
        placeholder: 'Full featured editor...',
        minHeight: '200px',
    },
};

export const WithMentionsAndTags: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        mentions: true,
        mentionSearch,
        tags: true,
        tagSearch,
        placeholder: 'Type @john-doe or #angular.ui to trigger suggestions...',
        minHeight: '150px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Supports @mentions and #tags. Type @ or # to trigger the picker.',
            },
        },
    },
};

export const WithCharacterCount: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        showCount: true,
        showWordCount: true,
        placeholder: 'Type something to see character count...',
        minHeight: '150px',
    },
};

export const WithCustomSlashCommands: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        enableSlashCommands: true,
        slashCommands: customSlashCommands,
        placeholder: 'Type / to open commands. Try /callout or /divider.',
        minHeight: '160px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Slash commands include built-ins and app-provided commands via `slashCommands` input.',
            },
        },
    },
};

export const AdvancedEditorConfig: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        mentions: true,
        mentionSearch,
        tags: true,
        tagSearch,
        showCount: true,
        showWordCount: true,
        showHistoryPanel: true,
        showHistoryButton: true,
        maxLength: 240,
        historyLimit: 150,
        historyDebounceMs: 500,
        placeholder: 'Try @john-doe, #angular.ui, paste content, then undo/redo.',
        minHeight: '180px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Production-style setup with mention/tag autocomplete, char+word count, max length, and deeper history.',
            },
        },
    },
};

export const HebrewRTL: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        locale: 'he',
        showCount: true,
        showWordCount: true,
        showHistoryPanel: true,
        enableSlashCommands: true,
        minHeight: '180px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Hebrew locale with automatic RTL layout. All toolbar tooltips, slash commands, dialogs, and labels are translated.',
            },
        },
    },
};

export const ArabicRTL: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        locale: 'ar',
        showCount: true,
        showWordCount: true,
        enableSlashCommands: true,
        minHeight: '180px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Arabic locale with automatic RTL layout.',
            },
        },
    },
};

export const FrenchLocale: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        locale: 'fr',
        showCount: true,
        showWordCount: true,
        enableSlashCommands: true,
        minHeight: '180px',
    },
    parameters: {
        docs: {
            description: {
                story: 'French locale with translated UI strings.',
            },
        },
    },
};

export const JapaneseLocale: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        locale: 'ja',
        showCount: true,
        showWordCount: true,
        enableSlashCommands: true,
        minHeight: '180px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Japanese locale with translated UI strings.',
            },
        },
    },
};

export const Disabled: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        disabled: true,
        placeholder: 'This editor is disabled',
        minHeight: '100px',
    },
};

export const ReadOnly: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'none',
        readonly: true,
        minHeight: '100px',
    },
    render: (args) => ({
        props: {
            ...args,
            initialValue: '# Hello World\n\nThis is **read-only** content with *formatting*.\n\n- Item 1\n- Item 2\n- Item 3',
        },
        template: `
      <ui-rich-text-editor
        [mode]="mode"
        [toolbar]="toolbar"
        [readonly]="readonly"
        [minHeight]="minHeight"
        [ngModel]="initialValue"
      />
    `,
    }),
};

export const GhostVariant: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        variant: 'ghost',
        placeholder: 'Ghost variant - borderless until focused...',
        minHeight: '150px',
    },
};

@Component({
    selector: 'rich-text-demo',
    standalone: true,
    imports: [RichTextEditorComponent, FormsModule],
    template: `
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium mb-2 block">Editor</label>
        <ui-rich-text-editor
          mode="markdown"
          toolbar="top"
          [mentions]="true"
          [mentionSearch]="mentionSearch"
          [(ngModel)]="content"
          (htmlChange)="html = $event"
          (markdownChange)="markdown = $event"
          placeholder="Write something..."
          minHeight="150px"
        />
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm font-medium mb-2 block">Markdown Output</label>
          <pre class="p-4 bg-muted rounded-md text-sm overflow-auto max-h-48">{{ markdown }}</pre>
        </div>
        <div>
          <label class="text-sm font-medium mb-2 block">HTML Output</label>
          <pre class="p-4 bg-muted rounded-md text-sm overflow-auto max-h-48">{{ html }}</pre>
        </div>
      </div>
      
      <div>
        <label class="text-sm font-medium mb-2 block">HTML Preview</label>
        <div 
          class="p-4 border rounded-md prose prose-sm dark:prose-invert max-w-none"
          [innerHTML]="html"
        ></div>
      </div>
    </div>
  `,
})
class RichTextDemoComponent {
    content = '';
    html = '';
    markdown = '';
    mentionSearch = mentionSearch;
}

@Component({
    selector: 'rich-text-advanced-demo',
    standalone: true,
    imports: [RichTextEditorComponent, FormsModule],
    template: `
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Exercise mentions/tags with realistic handles: <code>@john-doe</code>, <code>@jane.smith</code>, <code>#angular.ui</code>.
      </p>
      <ui-rich-text-editor
        mode="markdown"
        toolbar="top"
        [mentions]="true"
        [mentionSearch]="mentionSearch"
        [tags]="true"
        [tagSearch]="tagSearch"
        [showCount]="true"
        [showWordCount]="true"
        [showHistoryPanel]="true"
        [maxLength]="220"
        [historyLimit]="200"
        [historyDebounceMs]="500"
        placeholder="Type content, paste text, and use undo/redo to validate history behavior..."
        minHeight="180px"
        [(ngModel)]="content"
      />
      <pre class="p-4 bg-muted rounded-md text-xs overflow-auto max-h-56">{{ content }}</pre>
    </div>
  `,
})
class RichTextAdvancedDemoComponent {
    content = '';
    mentionSearch = mentionSearch;
    tagSearch = tagSearch;
}

export const InteractiveDemo: Story = {
    render: () => ({
        moduleMetadata: {
            imports: [RichTextDemoComponent],
        },
        template: '<rich-text-demo />',
    }),
    parameters: {
        docs: {
            description: {
                story: 'Full interactive demo showing both Markdown and HTML output.',
            },
        },
    },
};

export const AdvancedBehaviorDemo: Story = {
    render: () => ({
        moduleMetadata: {
            imports: [RichTextAdvancedDemoComponent],
        },
        template: '<rich-text-advanced-demo />',
    }),
    parameters: {
        docs: {
            description: {
                story: 'Focused demo for maxLength handling, richer mention/tag triggers, and larger undo/redo history.',
            },
        },
    },
};

@Component({
    selector: 'rich-text-form-demo',
    standalone: true,
    imports: [RichTextEditorComponent, ReactiveFormsModule, JsonPipe],
    template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
      <div>
        <label class="text-sm font-medium mb-2 block">Content</label>
        <ui-rich-text-editor
          formControlName="content"
          [mode]="'markdown'"
          [toolbar]="'top'"
          placeholder="Enter your content..."
          minHeight="150px"
        />
        @if (form.get('content')?.errors?.['required'] && form.get('content')?.touched) {
          <p class="text-sm text-destructive mt-1">Content is required</p>
        }
      </div>
      
      <button 
        type="submit" 
        class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        [disabled]="form.invalid"
      >
        Submit
      </button>
      
      <div class="text-sm text-muted-foreground">
        Form Value: {{ form.value | json }}
      </div>
    </form>
  `,
})
class RichTextFormDemoComponent {
    form = new FormGroup({
        content: new FormControl('', { nonNullable: true }),
    });

    onSubmit() {
        console.log('Form submitted:', this.form.value);
    }
}

export const ReactiveForm: Story = {
    render: () => ({
        moduleMetadata: {
            imports: [RichTextFormDemoComponent],
        },
        template: '<rich-text-form-demo />',
    }),
    parameters: {
        docs: {
            description: {
                story: 'Using the rich text editor with Angular reactive forms.',
            },
        },
    },
};

export const AutoImageUpload: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        autoImageUpload: true,
        imageUploader: (_file: File) =>
            of('https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/1200px-Cat_November_2010-1a.jpg')
                .pipe(delay(2000)),
        placeholder: 'Paste or drag an image to see auto upload...',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Automatically uploads base64 images using the `imageUploader` callback. Shows a shimmer skeleton while uploading, then replaces with the returned URL. Try pasting or dragging any image into the editor.',
            },
        },
    },
};

export const FontFamilyToolbar: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        toolbarItems: ['bold', 'italic', 'separator', 'fontFamily', 'fontSize', 'separator', 'fontColor'],
        placeholder: 'Select text and change its font family...',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Toolbar with the font family dropdown. Select text and pick a typeface from the built-in web-safe list.',
            },
        },
    },
};

export const CustomFontFamilies: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        toolbarItems: ['bold', 'italic', 'separator', 'fontFamily', 'fontSize'],
        fontFamilies: ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins'],
        fontFamiliesStrategy: 'replace',
        placeholder: 'Using custom Google Fonts only...',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Custom font families with `fontFamiliesStrategy="replace"` — only the provided fonts appear in the dropdown.',
            },
        },
    },
};

export const AppendedFontFamilies: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        toolbarItems: ['bold', 'italic', 'separator', 'fontFamily', 'fontSize'],
        fontFamilies: ['Roboto', 'Open Sans', 'Lato'],
        fontFamiliesStrategy: 'append',
        placeholder: 'Default fonts + custom fonts appended...',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Custom font families with `fontFamiliesStrategy="append"` (default) — custom fonts are added after the built-in web-safe defaults.',
            },
        },
    },
};
