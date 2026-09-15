import { Directive, input } from '@angular/core';
import { RichTextAllowHost, type RichTextAllow } from './rich-text-resource-policy';

/**
 * Declares what every editor and view beneath this element may load and link
 * to, so a page full of views states its policy once instead of on each:
 *
 * ```html
 * <div [uiRichTextAllow]="{ imageHosts: ['cdn.acme.com', '*.assets.acme.com'], linkSchemes: ['acme-crm'] }">
 *   <ui-rich-text-view [value]="a" />
 *   <ui-rich-text-view [value]="b" />
 * </div>
 * ```
 *
 * A component that sets its own `allowedImageHosts` or `linkSchemes` keeps that
 * list whole; the wrapper's is never merged in, so a strict view cannot be
 * widened by a looser ancestor.
 *
 * This is a DOM-ancestor relationship, not a content-projection one. Neither the
 * editor nor the view projects content, so a wrapper element is what makes an
 * enclosing policy reachable at all -- the same shape `[uiRichTextActions]` uses.
 */
@Directive({
    selector: '[uiRichTextAllow]',
    standalone: true,
    providers: [
        {
            provide: RichTextAllowHost,
            useExisting: RichTextAllowDirective,
        },
    ],
})
export class RichTextAllowDirective implements RichTextAllowHost {
    /** Hosts and link schemes for everything beneath this element. */
    readonly uiRichTextAllow = input<RichTextAllow>({});

    readonly allow = (): RichTextAllow => this.uiRichTextAllow();
}
