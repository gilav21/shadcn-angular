import { Directive, input } from '@angular/core';
import { RichTextResourcePolicyHost } from './rich-text-resource-policy';

/**
 * Declares a remote-host policy for every editor and view beneath this element.
 *
 * A page that renders many views under one policy would otherwise repeat the
 * host list on each, and the more likely mistake is missing one. Put the list on
 * a wrapper instead, and opt each view in with `inheritResourcePolicy`:
 *
 * ```html
 * <div [uiRichTextResourcePolicy]="['cdn.acme.com', '*.assets.acme.com']">
 *   <ui-rich-text-view [value]="a" [inheritResourcePolicy]="true" />
 *   <ui-rich-text-view [value]="b" [inheritResourcePolicy]="true" />
 * </div>
 * ```
 *
 * Inheritance is opt-in per view, so an empty `allowedResourceHosts` keeps
 * exactly one meaning -- no policy -- rather than becoming ambiguous between
 * "none" and "whatever encloses me". A view that sets its own list always wins,
 * and the two lists are never merged: a strict view must not widen to a looser
 * ancestor.
 *
 * This is a DOM-ancestor relationship, not a content-projection one. Neither the
 * editor nor the view projects content, so a wrapper element is what makes an
 * enclosing policy reachable at all -- the same shape `[uiRichTextActions]` uses.
 */
@Directive({
    selector: '[uiRichTextResourcePolicy]',
    standalone: true,
    providers: [
        {
            provide: RichTextResourcePolicyHost,
            useExisting: RichTextResourcePolicyDirective,
        },
    ],
})
export class RichTextResourcePolicyDirective implements RichTextResourcePolicyHost {
    /** Hosts permitted beneath this element. Empty sets no policy. */
    readonly uiRichTextResourcePolicy = input<readonly string[]>([]);

    readonly allowedResourceHosts = (): readonly string[] => this.uiRichTextResourcePolicy();
}
