import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { RichTextViewComponent } from './rich-text-view.component';
import { RichTextAllowDirective } from '../rich-text-editor';
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

const REMOTE_DOC = '# Newsletter\n\n'
    + '![Logo](https://cdn.trusted.com/logo.png)\n\n'
    + 'Thanks for reading.\n\n'
    + '![](https://pixel.tracker.example/open?id=42)';

@Component({
    selector: 'rich-text-view-policy',
    standalone: true,
    imports: [RichTextViewComponent, RichTextAllowDirective],
    template: `
        <div class="space-y-6">
            <div class="space-y-2">
                <p class="text-xs font-medium uppercase text-muted-foreground">
                    No policy — every host loads
                </p>
                <ui-rich-text-view [value]="doc" />
            </div>

            <div class="space-y-2">
                <p class="text-xs font-medium uppercase text-muted-foreground">
                    Only cdn.trusted.com
                </p>
                <ui-rich-text-view [value]="doc" [allowedImageHosts]="hosts" />
            </div>

            <div class="space-y-2" [uiRichTextAllow]="{ imageHosts: hosts }">
                <p class="text-xs font-medium uppercase text-muted-foreground">
                    Inherited from a wrapper
                </p>
                <ui-rich-text-view [value]="doc" />
            </div>
        </div>
    `,
})
class RichTextViewPolicyStory {
    /** One allowed host and one that is not, so the difference is visible. */
    readonly doc = REMOTE_DOC;
    readonly hosts: readonly string[] = ['cdn.trusted.com'];
}

/**
 * A remote image is a request every reader's browser makes on render. A policy
 * on the editor governs what an author can insert; it is not stored in the
 * document, so the view needs its own. A blocked image keeps its alt and its
 * place and retains the URL, so allowing the host later restores it.
 */
export const ResourcePolicy: Story = {
    render: () => ({ template: '<rich-text-view-policy />' }),
    decorators: [moduleMetadata({ imports: [RichTextViewPolicyStory] })],
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
