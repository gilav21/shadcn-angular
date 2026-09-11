import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RichTextHistoryDirective } from './addons/history';
import { RichTextToolbarComponent } from './sub/rich-text-toolbar.component';
import { RichTextMentionsDirective, type MentionItem, type TagItem } from './addons/mentions';
import { RichTextViewComponent } from '../rich-text-view';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { RICH_TEXT_LOCALES } from './rich-text-locales';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { JsonPipe } from '@angular/common';

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
                RichTextMentionsDirective,
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
                'Ordered list of toolbar item ids to render (e.g. bold, italic, heading1, separator…). Defaults to the built-in toolbar set.',
        },
        locale: {
            control: 'select',
            options: Object.keys(RICH_TEXT_LOCALES),
            description: 'Locale for UI strings and automatic RTL',
        },
        history: {
            control: 'object',
            description: 'Undo history tuning: { limit, debounceMs, recordExternalWrites }',
        },
        disabled: { control: 'boolean', description: 'Disables the editor' },
        readonly: { control: 'boolean', description: 'Renders content read-only (no editing)' },
        counter: {
            control: 'select',
            options: [undefined, 'characters', 'words', 'both'],
            description: 'Which counter to show below the editor',
        },
        maxLength: { control: 'number', description: 'Maximum character count (undefined = unlimited)' },
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
        counter: 'both',
        history: { limit: 100, debounceMs: 450 },
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
        toolbarItems: ['bold', 'italic', 'separator', 'underline'],
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
            'undo', 'redo', 'clear',
            'separator',
            'find',
        ],
        placeholder: 'Full featured editor...',
        minHeight: '200px',
    },
};

export const WithCharacterCount: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        counter: 'both',
        placeholder: 'Type something to see character count...',
        minHeight: '150px',
    },
};

export const AdvancedEditorConfig: Story = {
    args: {
        mode: 'markdown',
        toolbar: 'top',
        counter: 'both',
        maxLength: 240,
        history: { limit: 150, debounceMs: 500 },
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
        counter: 'both',
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
        counter: 'both',
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
        counter: 'both',
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
        counter: 'both',
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
    imports: [RichTextEditorComponent, RichTextViewComponent, RichTextMentionsDirective, FormsModule],
    template: `
    <div class="space-y-4">
      <div>
        <p class="text-sm font-medium mb-2 block">Editor</p>
        <ui-rich-text-editor
          mode="markdown"
          toolbar="top"
          uiRteMentions
          [uiRteMentionsSearch]="mentionSearch"
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
        <ui-rich-text-view class="p-4 border rounded-md" mode="html" [value]="html" />
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
    imports: [RichTextEditorComponent, RichTextHistoryDirective, RichTextMentionsDirective, FormsModule],
    template: `
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Exercise mentions/tags with realistic handles: <code>@john-doe</code>, <code>@jane.smith</code>, <code>#angular.ui</code>.
      </p>
      <ui-rich-text-editor
        mode="markdown"
        toolbar="top"
        uiRteHistory
        uiRteMentions
        [uiRteMentionsSearch]="mentionSearch"
        [uiRteTags]="true"
        [uiRteTagsSearch]="tagSearch"
        counter="both"
        [maxLength]="220"
        [history]="{ limit: 200, debounceMs: 500 }"
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

export const CustomToolbar: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        toolbarItems: ['bold', 'italic', 'underline', 'separator', 'heading1', 'heading2', 'separator', 'bulletList', 'orderedList'],
        placeholder: 'A trimmed-down toolbar…',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story: 'A custom `[toolbarItems]` set. Font size/family live in the opt-in `rich-text-editor/typography` addon (`uiRteTypography`); see the Addons/Typography stories.',
            },
        },
    },
};

export const MarkdownShortcuts: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        placeholder: 'Try typing "# ", "- ", "1. ", "> ", "[] ", "---", "**bold**"…',
        minHeight: '260px',
    },
    parameters: {
        docs: {
            description: {
                story:
                    'Markdown markers become real formatting as you type — on by default, no addon needed. '
                    + '`# `/`## `/`### ` make headings, `- ` or `* ` a bullet list, `1. ` a numbered list, '
                    + '`> ` a blockquote, `[] `/`[x] ` a task item, `---` a horizontal rule, and ``` '
                    + '(optionally with a language, then Space or Enter) a code block. Inline, `**bold**`, '
                    + '`*italic*` and `` `code` `` wrap as you close them. '
                    + 'Each transform is one undo step, and pressing Backspace immediately afterwards puts '
                    + 'the literal characters back — so a marker can still be typed as text.',
            },
        },
    },
};

export const MarkdownShortcutsOff: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        markdownShortcuts: false,
        placeholder: 'Markdown markers stay literal here…',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story:
                    '`[markdownShortcuts]="false"` turns the whole feature off. Reach for it when your '
                    + 'authors type Markdown markers they expect to stay literal — a tool whose content '
                    + '*is* Markdown source, say.',
            },
        },
    },
};

export const TextStyleSelect: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        placeholder: 'The block-type group is one select…',
        minHeight: '200px',
    },
    parameters: {
        viewport: { defaultViewport: 'mobile2' },
        docs: {
            description: {
                story:
                    'The default toolbar at 375px. Block type is a single Text style select rather than '
                    + 'four buttons, which is what keeps the toolbar from overflowing into a horizontal '
                    + 'scroll on a phone. It is a native `<select>`, so mobile gets the OS picker.',
            },
        },
    },
};

export const ClassicHeadingButtons: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        toolbarItems: ['bold', 'italic', 'separator', 'paragraph', 'heading1', 'heading2', 'heading3'],
        placeholder: 'The four block buttons, listed explicitly…',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story:
                    'The four block buttons are still valid `[toolbarItems]` entries for consumers who '
                    + 'prefer them to the select. They now render pressed when the caret is in the '
                    + 'matching block, which they never did before.',
            },
        },
    },
};

export const TextStyleRTL: Story = {
    args: {
        mode: 'html',
        toolbar: 'top',
        locale: 'he',
        placeholder: 'כתוב כאן…',
        minHeight: '200px',
    },
    parameters: {
        docs: {
            description: {
                story:
                    'Under an RTL locale the select mirrors: its chevron and padding move to the left '
                    + 'edge. Alignment pressed-state mirrors too — a `text-align: right` block presses '
                    + 'the button whose glyph already points right.',
            },
        },
    },
};

@Component({
    selector: 'rich-text-find-demo',
    standalone: true,
    imports: [RichTextEditorComponent, FormsModule],
    template: `
    <ui-rich-text-editor
      #editor
      mode="html"
      toolbar="top"
      [locale]="locale"
      [toolbarItems]="['bold', 'italic', 'separator', 'find']"
      [findDebounceMs]="0"
      [ngModel]="content"
      minHeight="180px"
    />
  `,
})
class RichTextFindDemoComponent implements AfterViewInit {
    @ViewChild('editor') editor!: RichTextEditorComponent;
    @Input() locale?: string;
    @Input() content = '<p>The cat sat on the mat. Another cat walked past the cat flap.</p>';

    ngAfterViewInit(): void {
        this.editor.openFindReplace(true);
        this.editor.onFindQueryChange('cat');
    }
}

export const FindReplace: Story = {
    render: () => ({
        moduleMetadata: {
            imports: [RichTextFindDemoComponent],
        },
        template: '<rich-text-find-demo />',
    }),
    parameters: {
        docs: {
            description: {
                story:
                    'Find and replace with the panel open on a live query. Highlights are drawn on an '
                    + 'overlay layer, so they never enter the document, the form value or the undo history. '
                    + "The `'find'` toolbar item is the touch-friendly way in; `Ctrl/Cmd+F` and `Ctrl/Cmd+H` "
                    + 'are the keyboard ones.',
            },
        },
    },
};

export const FindReplaceRTL: Story = {
    render: () => ({
        moduleMetadata: {
            imports: [RichTextFindDemoComponent],
        },
        template: '<rich-text-find-demo locale="he" />',
    }),
    parameters: {
        docs: {
            description: {
                story:
                    'The same panel in Hebrew: it anchors at the logical inline-end, the controls run '
                    + 'right-to-left, and the counter reads the localized "{current} מתוך {total}".',
            },
        },
    },
};
