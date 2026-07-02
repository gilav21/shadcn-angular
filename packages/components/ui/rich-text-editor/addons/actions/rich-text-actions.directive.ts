import { Directive, DestroyRef, effect, inject, input, output, ViewContainerRef } from '@angular/core';
import { RichTextEditorAddonHost } from '../../rich-text-editor.host';
import { RichTextSanitizerService } from '../../rich-text-sanitizer.service';
import { RichTextMarkdownService } from '../../rich-text-markdown.service';
import {
    assertFlatParams, readActions, validateActionId, validateActionParams, writeAction,
} from './rich-text-actions.serializer';
import {
    RichTextActionsDialogComponent, type ActionsDialogConfirm,
} from './rich-text-actions-dialog.component';
import {
    ACTION_ATTRS,
    type ActionParams,
    type ActionTargetKind,
    type RichTextActionDefinition,
    type RichTextActionTrigger,
} from './rich-text-actions.types';

const ATTACH_ID = 'actions.attach';
const ATTACH_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

/**
 * Opt-in actions addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides; contributes the "Attach action"
 * toolbar button + `/action` slash command, widens the sanitizer allow-list
 * for `data-action-*` attributes, and teaches markdown to preserve action
 * spans. The base editor ships no action code.
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteActions]',
    standalone: true,
})
export class RichTextActionsDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly markdown = inject(RichTextMarkdownService);
    private readonly vcr = inject(ViewContainerRef);

    /** The registered action definitions. Empty/absent → no UI appears. */
    readonly uiRteActions = input<RichTextActionDefinition[]>([]);
    /** Contribute the toolbar button (default true). */
    readonly uiRteActionsToolbar = input(true);
    /** Contribute the `/action` slash command (default true). */
    readonly uiRteActionsSlashCommand = input(true);

    readonly actionAttached = output<{
        actionId: string; trigger: RichTextActionTrigger; params: ActionParams; targetKind: ActionTargetKind;
    }>();
    readonly actionRemoved = output<{
        actionId: string; trigger: RichTextActionTrigger; targetKind: ActionTargetKind;
    }>();

    protected readonly overlays: (() => void)[] = [];

    constructor() {
        const destroyRef = inject(DestroyRef);

        effect((onCleanup) => {
            if (this.uiRteActions().length === 0) return;
            onCleanup(this.sanitizer.registerAttributeRules([
                { tag: '*', attr: 'data-action-click', validate: validateActionId },
                { tag: '*', attr: 'data-action-hover', validate: validateActionId },
                { tag: '*', attr: 'data-action-click-params', requiresAttr: 'data-action-click', validate: validateActionParams },
                { tag: '*', attr: 'data-action-hover-params', requiresAttr: 'data-action-hover', validate: validateActionParams },
            ]));
        });

        effect((onCleanup) => {
            if (this.uiRteActions().length === 0) return;
            onCleanup(this.markdown.registerSpanSerializer({
                serialize: (el, inner) => {
                    if (!ACTION_ATTRS.some((a) => el.hasAttribute(a))) return null;
                    const clone = el.cloneNode(false) as HTMLElement;
                    clone.innerHTML = inner;
                    return clone.outerHTML;
                },
            }));
        });

        effect((onCleanup) => {
            if (this.uiRteActions().length === 0 || !this.uiRteActionsToolbar()) return;
            onCleanup(this.host.toolbarSlots.register({
                id: ATTACH_ID, icon: ATTACH_ICON, tooltip: 'Attach action', order: 500,
                isEnabled: () => this.canAttach(),
                onClick: () => this.openAttachFlow(),
            }));
        });

        effect((onCleanup) => {
            if (this.uiRteActions().length === 0 || !this.uiRteActionsSlashCommand()) return;
            onCleanup(this.host.commands.registerCommand({
                id: ATTACH_ID, label: 'Attach action',
                description: 'Attach a click or hover action to the selection',
                keywords: ['action', 'link', 'dialog', 'hover'], order: 220,
                when: (ctx) => ctx.hasSelection && !ctx.readonly,
                run: () => this.openAttachFlow(),
            }));
        });

        destroyRef.onDestroy(() => this.closeOverlays());
    }

    private canAttach(): boolean {
        if (this.host.disabled() || this.host.readonly()) return false;
        const sel = this.host.selection();
        return sel.kind !== 'none' || !!sel.closestWithAttrs(ACTION_ATTRS);
    }

    protected openAttachFlow(): void {
        this.host.saveSelection();
        const sel = this.host.selection();
        const existing = sel.closestWithAttrs(ACTION_ATTRS);
        const targetKind: ActionTargetKind = sel.kind === 'image' ? 'image' : 'text';
        const occupied = existing ? readActions(existing).map((a) => a.trigger) : [];
        const ref = this.vcr.createComponent(RichTextActionsDialogComponent);
        ref.setInput('definitions', this.uiRteActions());
        ref.setInput('context', {
            mode: existing ? 'edit' : 'create', targetKind,
            selectionText: sel.text, occupiedTriggers: occupied, prefill: null,
        });
        const teardown = (): void => { ref.destroy(); };
        this.overlays.push(teardown);
        ref.instance.dismiss.subscribe(() => this.closeOverlay(teardown));
        ref.instance.confirm.subscribe((payload: ActionsDialogConfirm) => {
            const applied = this.applyAction(payload.def, payload.trigger, payload.params, targetKind, existing);
            if (applied) this.closeOverlay(teardown);
        });
    }

    private closeOverlay(teardown: () => void): void {
        const i = this.overlays.indexOf(teardown);
        if (i !== -1) this.overlays.splice(i, 1);
        teardown();
    }

    protected closeOverlays(): void {
        for (const off of this.overlays.splice(0)) off();
    }

    private applyAction(
        def: RichTextActionDefinition, trigger: RichTextActionTrigger,
        params: ActionParams, targetKind: ActionTargetKind, existing: HTMLElement | null,
    ): boolean {
        try {
            assertFlatParams(params);
        } catch (err) {
            console.error('[rich-text-actions] refused to attach non-flat params:', err);
            return false;
        }
        if (targetKind === 'image') {
            const img = this.host.selection().imageElement;
            if (img) this.host.mutateContent(() => writeAction(img, trigger, def.id, params));
        } else if (existing) {
            this.host.mutateContent(() => writeAction(existing, trigger, def.id, params));
        } else {
            const doc = this.host.contentRoot.ownerDocument;
            this.host.wrapSelection(() => {
                const span = doc.createElement('span');
                writeAction(span, trigger, def.id, params);
                return span;
            });
        }
        this.actionAttached.emit({ actionId: def.id, trigger, params, targetKind });
        return true;
    }
}
