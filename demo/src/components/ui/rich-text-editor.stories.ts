import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent, DEFAULT_TOOLBAR_ITEMS } from './rich-text-editor.component';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';
import { RichTextMentionPopoverComponent, MentionItem, TagItem } from './rich-text-mention.component';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { Component, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';

const sampleMentions: MentionItem[] = [
    { id: '1', value: 'john', label: 'John Doe', description: 'john@example.com' },
    { id: '2', value: 'jane', label: 'Jane Smith', description: 'jane@example.com' },
    { id: '3', value: 'bob', label: 'Bob Wilson', description: 'bob@example.com' },
];

const sampleTags: TagItem[] = [
    { id: '1', value: 'angular', label: 'Angular', color: '#dd0031' },
    { id: '2', value: 'typescript', label: 'TypeScript', color: '#3178c6' },
    { id: '3', value: 'tailwind', label: 'TailwindCSS', color: '#06b6d4' },
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
        mentionSource: sampleMentions,
        tags: true,
        tagSource: sampleTags,
        placeholder: 'Type @ to mention someone or # to add a tag...',
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
        placeholder: 'Type something to see character count...',
        minHeight: '150px',
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

// Interactive example with output preview
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
          [mentionSource]="mentions"
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
    mentions = sampleMentions;
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

// Reactive forms example
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
