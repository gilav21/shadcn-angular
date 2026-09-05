import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { RichTextViewComponent } from './rich-text-view.component';
import {
    RichTextActionsBindDirective,
    type RichTextActionEvent,
} from '../rich-text-editor/addons/actions';

const HTML_DOC = '<h1>Release notes</h1>'
    + '<p>We shipped <strong>a read-only renderer</strong> for editor output.</p>'
    + '<ul><li>Same sanitizer</li><li>Same markdown parser</li><li>Same typography</li></ul>'
    + '<blockquote>Author here, render there.</blockquote>';

const MARKDOWN_DOC = '# Release notes\n\n'
    + 'We shipped **a read-only renderer** for editor output.\n\n'
    + '- Same sanitizer\n- Same markdown parser\n- Same typography\n\n'
    + '> Author here, render there.\n\n'
    + '```ts\nconst view = "read-only";\n```';

const RTL_DOC = '# הערות שחרור\n\nהוספנו **מציג לקריאה בלבד** לפלט העורך.\n\n- אותו מנקה\n- אותה טיפוגרפיה';

const ACTION_DOC = '<h2>Pricing</h2>'
    + '<p>Plans start at $9 a month. '
    + '<span data-action-click="open-pricing" data-action-click-params=\'{"plan":"pro"}\' '
    + 'style="color: rgb(37, 99, 235); text-decoration: underline;">See the Pro plan</span>'
    + ' for team features.</p>';

const meta: Meta<RichTextViewComponent> = {
    title: 'Components/RichTextView',
    component: RichTextViewComponent,
    tags: ['autodocs'],
    argTypes: {
        mode: { control: 'radio', options: ['markdown', 'html'] },
        size: { control: 'radio', options: ['default', 'sm', 'lg'] },
        dir: { control: 'radio', options: [undefined, 'ltr', 'rtl', 'auto'] },
    },
};

export default meta;
type Story = StoryObj<RichTextViewComponent>;

export const Html: Story = {
    args: { mode: 'html', value: HTML_DOC },
};

export const Markdown: Story = {
    args: { mode: 'markdown', value: MARKDOWN_DOC },
};

@Component({
    selector: 'rich-text-view-sizes',
    standalone: true,
    imports: [RichTextViewComponent],
    template: `
    <div class="space-y-6">
      @for (size of sizes; track size) {
        <div class="space-y-1">
          <p class="text-xs font-medium uppercase text-muted-foreground">{{ size }}</p>
          <div class="rounded-md border p-3">
            <ui-rich-text-view [size]="size" [value]="doc" />
          </div>
        </div>
      }
    </div>
  `,
})
class SizesDemoComponent {
    protected readonly sizes = ['sm', 'default', 'lg'] as const;
    protected readonly doc = MARKDOWN_DOC;
}

export const Sizes: Story = {
    decorators: [moduleMetadata({ imports: [SizesDemoComponent] })],
    render: () => ({ template: '<rich-text-view-sizes />' }),
};

export const Rtl: Story = {
    args: { mode: 'markdown', value: RTL_DOC, dir: 'rtl' },
};

@Component({
    selector: 'rich-text-view-actions',
    standalone: true,
    imports: [RichTextViewComponent, RichTextActionsBindDirective],
    template: `
    <div class="space-y-3">
      <p class="text-sm text-muted-foreground">
        No editor on this page. The view is the delegation container, and
        <code>[uiRichTextActions]</code> keeps the <code>data-action-*</code>
        attributes alive through sanitization.
      </p>
      <div class="rounded-md border p-3">
        <ui-rich-text-view mode="html" [value]="doc" [uiRichTextActions]="handlers" />
      </div>
      @if (fired(); as event) {
        <output class="block rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          Action fired: <code>{{ event.actionId }}</code>
        </output>
      }
    </div>
  `,
})
class ActionsDemoComponent {
    protected readonly doc = ACTION_DOC;
    protected readonly fired = signal<RichTextActionEvent | null>(null);
    protected readonly handlers = {
        'open-pricing': (event: RichTextActionEvent) => this.fired.set(event),
    };
}

export const WithActions: Story = {
    decorators: [moduleMetadata({ imports: [ActionsDemoComponent] })],
    render: () => ({ template: '<rich-text-view-actions />' }),
};
