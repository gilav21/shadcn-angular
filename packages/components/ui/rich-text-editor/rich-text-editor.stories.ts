import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RichTextHistoryDirective } from './addons/history';
import { RichTextToolbarComponent } from './sub/rich-text-toolbar.component';
import { RichTextMentionPopoverComponent, MentionItem, TagItem } from './sub/rich-text-mention.component';
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
            description: 'Border and focus-ring treatment',
        },
        size: {
            control: 'radio',
            options: ['default', 'sm', 'lg'],
            description: 'Editor content text size preset',
        },
        placeholder: {
            control: 'text',
            description: 'Placeholder text shown when the editor is empty.',
        },
        minHeight: {
            control: 'text',
            description: 'Minimum height of the editable area (any CSS length, e.g. `150px`).',
        },
        maxHeight: {
            control: 'text',
            description: 'Maximum height before the editable area scrolls (any CSS length, e.g. `400px`).',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        ariaLabel: { control: 'text', description: 'aria-label applied to the editable surface.' },
        ariaDescribedBy: { control: 'text', description: 'aria-describedby applied to the editable surface.' },
        toolbarItems: {
            control: false,
            description:
                'Ordered list of toolbar item ids to render (e.g. bold, italic, fontFamily, fontSize, separator…). Defaults to the built-in toolbar set.',
        },
        customToolbarItems: {
            control: false,
            description: 'App-provided custom toolbar buttons/dropdowns rendered alongside the built-ins; emits (customToolbarAction) on click.',
        },
        fontFamilies: { control: 'object', description: 'Custom font family list for the fontFamily toolbar dropdown.' },
        mentionSearch: { control: false, description: 'Async/sync search function returning MentionItem[] for @mention autocomplete.' },
        mentionRender: { control: false, description: 'Rendering options (mode: chip|plain, template) for inserted mentions.' },
        tagSearch: { control: false, description: 'Async/sync search function returning TagItem[] for #tag autocomplete.' },
        tagRender: { control: false, description: 'Rendering options (mode: chip|plain, template) for inserted tags.' },
        imageUploader: { control: false, description: 'Callback uploading a File and returning an Observable<string> URL, used by autoImageUpload and the image insert dialog.' },
        aiProvider: { control: false, description: 'Bring-your-own AI provider hook powering AI-assisted editing actions.' },
        locale: {
            control: 'select',
            options: Object.keys(RICH_TEXT_LOCALES),
            description: 'Locale for UI strings and automatic RTL',
        },
        historyDebounceMs: {
            control: { type: 'number', min: 0, max: 2000, step: 50 },
            description: 'Debounce duration (ms) before a typing snapshot is persisted',
        },
        disabled: { control: 'boolean', description: 'Disables the editor' },
        readonly: { control: 'boolean', description: 'Renders content read-only (no editing)' },
        mentions: { control: 'boolean', description: 'Enable @mention autocomplete' },
        tags: { control: 'boolean', description: 'Enable #tag autocomplete' },
        images: { control: 'boolean', description: 'Enable image insertion' },
        autoImageUpload: { control: 'boolean', description: 'Auto-upload pasted/dropped base64 images via imageUploader' },
        imageResize: { control: 'boolean', description: 'Allow drag-resizing of images' },
        imageAlignment: { control: 'boolean', description: 'Show the image alignment toolbar' },
        lockImageAspectRatio: { control: 'boolean', description: 'Constrain image resizing to its aspect ratio' },
        showCount: { control: 'boolean', description: 'Show the character counter' },
        showWordCount: { control: 'boolean', description: 'Show the word counter' },
        imageSources: {
            control: 'select',
            options: ['all', 'upload', 'url'],
            description: 'Which image insertion sources are offered',
        },
        defaultImageAlignment: {
            control: 'select',
            options: ['inline', 'left', 'center', 'right'],
            description: 'Alignment applied to images on insert',
        },
        fontFamiliesStrategy: {
            control: 'radio',
            options: ['append', 'replace'],
            description: 'Whether custom fontFamilies append to or replace the built-in list',
        },
        maxLength: { control: 'number', description: 'Maximum character count (undefined = unlimited)' },
        historyLimit: { control: 'number', description: 'Maximum number of undo/redo snapshots retained' },
        minImageWidth: { control: 'number', description: 'Lower bound (px) for drag-resizing images' },
        maxImageWidth: { control: 'number', description: 'Upper bound (px) for drag-resizing images' },
        defaultImageWidth: { control: 'number', description: 'Width (px) applied to images on insert' },
        defaultImageHeight: { control: 'number', description: 'Height (px) applied to images on insert' },
    },
};

export default meta;
type Story = StoryObj<RichTextEditorComponent>;

/**
 * Interactive playground — Storybook binds every arg to its matching editor
 * input, so the Controls panel drives the live component.
 */
export const Playground: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        variant: 'default',
        size: 'default',
        placeholder: 'Write something amazing...',
        minHeight: '150px',
        maxHeight: '400px',
        disabled: false,
        readonly: false,
        mentions: false,
        tags: false,
        images: true,
        showCount: true,
        showWordCount: true,
        historyDebounceMs: 450,
        historyLimit: 100,
    },
};

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
        toolbarItems: ['bold', 'italic', 'separator', 'link'],
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
            'link', 'image',
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
        <p class="text-sm font-medium mb-2 block">Editor</p>
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
          <p class="text-sm font-medium mb-2 block">Markdown Output</p>
          <pre class="p-4 bg-muted rounded-md text-sm overflow-auto max-h-48">{{ markdown }}</pre>
        </div>
        <div>
          <p class="text-sm font-medium mb-2 block">HTML Output</p>
          <pre class="p-4 bg-muted rounded-md text-sm overflow-auto max-h-48">{{ html }}</pre>
        </div>
      </div>
      
      <div>
        <p class="text-sm font-medium mb-2 block">HTML Preview</p>
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
    imports: [RichTextEditorComponent, RichTextHistoryDirective, FormsModule],
    template: `
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Exercise mentions/tags with realistic handles: <code>@john-doe</code>, <code>@jane.smith</code>, <code>#angular.ui</code>.
      </p>
      <ui-rich-text-editor
        mode="markdown"
        toolbar="top"
        uiRteHistory
        [mentions]="true"
        [mentionSearch]="mentionSearch"
        [tags]="true"
        [tagSearch]="tagSearch"
        [showCount]="true"
        [showWordCount]="true"
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
        <p class="text-sm font-medium mb-2 block">Content</p>
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

export const ImageControls: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        defaultImageWidth: 240,
        defaultImageAlignment: 'center',
        minImageWidth: 80,
        maxImageWidth: 480,
        lockImageAspectRatio: false,
        placeholder: 'Insert an image via the toolbar, then select it and drag the corner or edge handles...',
        minHeight: '240px',
    },
    parameters: {
        docs: {
            description: {
                story: 'Developer-facing image controls: `defaultImageWidth` / `defaultImageHeight` set the size on insert, `defaultImageAlignment` sets the initial alignment, `minImageWidth` / `maxImageWidth` clamp the drag-resize range, and `lockImageAspectRatio={false}` enables single-axis edge handles. Set `imageResize={false}` to disable resizing entirely, or `imageAlignment={false}` to hide the alignment toolbar.',
            },
        },
    },
};

export const FontFamilyToolbar: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        toolbarItems: ['bold', 'italic', 'separator', 'fontFamily', 'fontSize'],
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
