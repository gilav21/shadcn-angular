import {
    Directive, DestroyRef, afterNextRender, effect, inject, input, output, signal,
    ViewContainerRef, type ComponentRef,
} from '@angular/core';
import { RichTextEditorAddonHost, RichTextSanitizerService, RichTextMarkdownService } from '../..';
import {
    applyStarterStyle, assertFlatParams, computeSeedStyleString, readActions, removeAction,
    stripStyleIfMatches, validateActionId, validateActionParams, writeAction, writeCombined,
} from './rich-text-actions.serializer';
import {
    RichTextActionsDialogComponent, type ActionsDialogConfirm,
} from './rich-text-actions-dialog.component';
import {
    RichTextActionsPopoverComponent, type PopoverActionRow,
} from './rich-text-actions-popover.component';
import {
    ACTION_ATTRS,
    type ActionParams,
    type ActionTargetKind,
    type RichTextActionDefinition,
    type RichTextActionTrigger,
} from './rich-text-actions.types';
import { RICH_TEXT_ACTIONS_LOCALES, type RichTextActionsLocale } from './rich-text-actions.locales';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';

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
    /** Locale for the addon UI: a registry key (`'en'`/`'he'`) or a full dictionary. */
    readonly uiRteActionsLocale = input<LocaleInput<RichTextActionsLocale>>();
    /** Global default starter styles seeded onto every newly-created action span. */
    readonly uiRteActionsStyle = input<Record<string, string>>({});

    private readonly i18n = createLocaleBindings(this.uiRteActionsLocale, RICH_TEXT_ACTIONS_LOCALES);

    readonly actionAttached = output<{
        actionId: string; trigger: RichTextActionTrigger; params: ActionParams; targetKind: ActionTargetKind;
    }>();
    readonly actionRemoved = output<{
        actionId: string; trigger: RichTextActionTrigger; targetKind: ActionTargetKind;
    }>();

    protected readonly overlays: (() => void)[] = [];
    private popoverRef?: ComponentRef<RichTextActionsPopoverComponent>;
    private popoverTarget: HTMLElement | null = null;
    private readonly refreshPopoverBound = (): void => this.refreshPopover();
    private readonly outsidePointerBound = (e: Event): void => this.onOutsidePointer(e);
    private readonly viewReady = signal(false);

    constructor() {
        afterNextRender(() => this.viewReady.set(true));
        this.registerBaseHooks();
        this.registerViewHooks();
        inject(DestroyRef).onDestroy(() => this.closeOverlays());
    }

    private registerBaseHooks(): void {
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
    }

    private registerViewHooks(): void {
        effect((onCleanup) => {
            if (!this.viewReady() || this.uiRteActions().length === 0) return;
            onCleanup(this.injectVisualizationStyles());
        });

        effect((onCleanup) => {
            if (!this.viewReady() || this.uiRteActions().length === 0) return;
            const root = this.host.contentRoot;
            const doc = root.ownerDocument;
            root.addEventListener('mouseup', this.refreshPopoverBound);
            root.addEventListener('keyup', this.refreshPopoverBound);
            doc.addEventListener('mousedown', this.outsidePointerBound);
            onCleanup(() => {
                root.removeEventListener('mouseup', this.refreshPopoverBound);
                root.removeEventListener('keyup', this.refreshPopoverBound);
                doc.removeEventListener('mousedown', this.outsidePointerBound);
                this.hidePopover();
            });
        });
    }

    private canAttach(): boolean {
        if (this.host.disabled() || this.host.readonly()) return false;
        const sel = this.host.selection();
        return sel.kind !== 'none' || !!sel.closestWithAttrs(ACTION_ATTRS);
    }

    protected openAttachFlow(): void {
        this.host.saveSelection();
        const sel = this.host.selection();
        const targetKind: ActionTargetKind = sel.kind === 'image' ? 'image' : 'text';
        // Capture the target now — the dialog steals focus, collapsing the
        // live selection, so a confirm-time re-read would return nothing.
        const target: ApplyTarget = {
            kind: targetKind,
            existing: sel.closestWithAttrs(ACTION_ATTRS),
            image: sel.kind === 'image' ? sel.imageElement : null,
        };
        const occupied = target.existing ? readActions(target.existing).map((a) => a.trigger) : [];
        const ref = this.vcr.createComponent(RichTextActionsDialogComponent);
        ref.setInput('definitions', this.uiRteActions());
        ref.setInput('locale', this.i18n.t());
        ref.setInput('context', {
            mode: target.existing ? 'edit' : 'create', targetKind,
            selectionText: sel.text, occupiedTriggers: occupied, prefill: null,
        });
        const teardown = (): void => { ref.destroy(); };
        this.overlays.push(teardown);
        ref.instance.dismiss.subscribe(() => this.closeOverlay(teardown));
        ref.instance.pick.subscribe((def: RichTextActionDefinition) => this.onPick(def, ref.instance, teardown, target));
        ref.instance.confirm.subscribe((payload: ActionsDialogConfirm) => {
            const applied = payload.combinedParams
                ? this.applyCombined(payload.def, payload.combinedParams, target)
                : this.applyAction(payload.def, payload.trigger, payload.params, target);
            if (applied) this.closeOverlay(teardown);
        });
    }

    private onPick(
        def: RichTextActionDefinition, dialog: RichTextActionsDialogComponent,
        teardown: () => void, target: ApplyTarget,
    ): void {
        this.warnOnMultipleTiers(def);
        this.warnOnCombinedMisuse(def);
        if (!def.resolveParams) return;
        const trigger = def.triggers[0];
        dialog.setBusy(true);
        def.resolveParams({
            mode: target.existing ? 'edit' : 'create', trigger,
            currentParams: {}, selectionText: this.host.selection().text,
            targetKind: target.kind, targetElement: target.existing,
        })
            .then((params) => {
                this.closeOverlay(teardown);
                if (params !== null) this.applyAction(def, trigger, params, target);
            })
            .catch((err: unknown) => {
                this.closeOverlay(teardown);
                console.error('[rich-text-actions] resolveParams rejected:', err);
            });
    }

    private warnOnMultipleTiers(def: RichTextActionDefinition): void {
        const tiers = [def.resolveParams, def.formComponent, def.fields?.length].filter(Boolean).length;
        if (tiers > 1) {
            console.error(
                `[rich-text-actions] action "${def.id}" declares multiple param tiers; ` +
                'precedence is resolveParams > formComponent > fields.',
            );
        }
    }

    private warnOnCombinedMisuse(def: RichTextActionDefinition): void {
        if (def.combined && def.triggers.length < 2) {
            console.error(
                `[rich-text-actions] action "${def.id}" is combined but declares fewer than two triggers; ` +
                'treating as single-trigger.',
            );
        }
        if (def.combined && def.paramsMode === 'separate' && (def.formComponent || def.resolveParams)) {
            console.error(
                `[rich-text-actions] action "${def.id}" combined+separate supports tier-1 fields only; ` +
                'falling back to shared.',
            );
        }
    }

    private closeOverlay(teardown: () => void): void {
        const i = this.overlays.indexOf(teardown);
        if (i === -1) return;
        this.overlays.splice(i, 1);
        teardown();
    }

    protected closeOverlays(): void {
        for (const off of this.overlays.splice(0)) off();
    }

    private refreshPopover(): void {
        if (this.host.disabled() || this.host.readonly()) {
            this.hidePopover();
            return;
        }
        const el = this.host.selection().closestWithAttrs(ACTION_ATTRS);
        if (!el) {
            this.hidePopover();
            return;
        }
        if (el === this.popoverTarget) return;
        this.showPopover(el);
    }

    private showPopover(el: HTMLElement): void {
        this.hidePopover();
        this.popoverTarget = el;
        const rows = this.buildPopoverRows(el);
        const ref = this.vcr.createComponent(RichTextActionsPopoverComponent);
        ref.setInput('actions', rows);
        ref.setInput('locale', this.i18n.t());
        ref.setInput('canAdd', rows.length < 2);
        this.positionPopover(ref, el);
        ref.instance.edit.subscribe((trigger: RichTextActionTrigger) => this.editAction(el, trigger));
        ref.instance.remove.subscribe((trigger: RichTextActionTrigger) => this.removeTrigger(el, trigger));
        ref.instance.add.subscribe(() => { this.hidePopover(); this.openAttachFlow(); });
        this.popoverRef = ref;
    }

    private buildPopoverRows(el: HTMLElement): PopoverActionRow[] {
        const defs = this.uiRteActions();
        return readActions(el).map((a) => {
            const def = defs.find((d) => d.id === a.id);
            return { trigger: a.trigger, id: a.id, label: def?.label ?? a.id, available: !!def };
        });
    }

    private positionPopover(ref: ComponentRef<RichTextActionsPopoverComponent>, el: HTMLElement): void {
        const host = ref.location.nativeElement as HTMLElement & { showPopover?: () => void };
        const rect = el.getBoundingClientRect();
        host.style.position = 'fixed';
        host.style.inset = 'auto';
        host.style.margin = '0';
        host.style.left = `${Math.round(rect.left)}px`;
        host.style.top = `${Math.round(rect.bottom + 4)}px`;
        // Render in the native top layer so the popover sits above any modal
        // the editor lives inside; fall back to a high z-index otherwise.
        if (typeof host.showPopover === 'function') {
            host.setAttribute('popover', 'manual');
            host.showPopover();
        } else {
            host.style.zIndex = '9999';
        }
    }

    private hidePopover(): void {
        this.popoverRef?.destroy();
        this.popoverRef = undefined;
        this.popoverTarget = null;
    }

    private onOutsidePointer(event: Event): void {
        if (!this.popoverRef) return;
        const node = event.target as Node | null;
        const popoverEl = this.popoverRef.location.nativeElement as HTMLElement;
        if (node && (popoverEl.contains(node) || this.popoverTarget?.contains(node))) return;
        this.hidePopover();
    }

    private editAction(el: HTMLElement, trigger: RichTextActionTrigger): void {
        const action = readActions(el).find((a) => a.trigger === trigger);
        const def = action ? this.uiRteActions().find((d) => d.id === action.id) : undefined;
        if (!action || !def) return;
        this.hidePopover();
        const target: ApplyTarget = { kind: 'text', existing: el, image: null };
        const ref = this.vcr.createComponent(RichTextActionsDialogComponent);
        ref.setInput('definitions', this.uiRteActions());
        ref.setInput('locale', this.i18n.t());
        ref.setInput('context', {
            mode: 'edit', targetKind: 'text', selectionText: el.textContent ?? '',
            occupiedTriggers: readActions(el).map((a) => a.trigger),
            prefill: { def, trigger, params: action.params },
        });
        const teardown = (): void => { ref.destroy(); };
        this.overlays.push(teardown);
        ref.instance.dismiss.subscribe(() => this.closeOverlay(teardown));
        ref.instance.confirm.subscribe((payload: ActionsDialogConfirm) => {
            const applied = payload.combinedParams
                ? this.applyCombined(payload.def, payload.combinedParams, target)
                : this.applyAction(payload.def, payload.trigger, payload.params, target);
            if (applied) this.closeOverlay(teardown);
        });
    }

    private removeTrigger(el: HTMLElement, trigger: RichTextActionTrigger): void {
        const removedId = el.getAttribute(`data-action-${trigger}`) ?? '';
        this.hidePopover();
        const def = this.uiRteActions().find((d) => d.id === removedId);
        const seed = def ? computeSeedStyleString(el.ownerDocument, this.mergedSeed(def)) : '';
        this.host.mutateContent(() => {
            removeAction(el, trigger);
            const stillActioned = ACTION_ATTRS.some((a) => el.hasAttribute(a));
            if (stillActioned) return;
            stripStyleIfMatches(el, seed);
            if (el.tagName === 'SPAN' && el.attributes.length === 0) {
                const parent = el.parentNode;
                while (el.firstChild) parent?.insertBefore(el.firstChild, el);
                el.remove();
            }
        });
        this.actionRemoved.emit({ actionId: removedId, trigger, targetKind: 'text' });
    }

    private mergedSeed(def: RichTextActionDefinition): Record<string, string> {
        return { ...this.uiRteActionsStyle(), ...(def.style ?? {}) };
    }

    private injectVisualizationStyles(): () => void {
        const doc = this.host.contentRoot.ownerDocument;
        const existing = doc.querySelector('style[data-rte-actions-style]') as HTMLStyleElement | null;
        if (existing) {
            existing.dataset['refcount'] = String(Number(existing.dataset['refcount'] ?? '1') + 1);
            return () => this.releaseVisualizationStyles(doc);
        }
        const style = doc.createElement('style');
        style.dataset['rteActionsStyle'] = '';
        style.dataset['refcount'] = '1';
        style.textContent =
            // A dotted BOTTOM BORDER (not text-decoration) marks actioned runs — using
            // text-decoration here makes the browser report the run as already underlined,
            // so the editor's underline command toggles off and never applies (issue: the
            // affordance must not collide with the user's own underline formatting).
            'ui-rich-text-editor [data-action-click],ui-rich-text-editor [data-action-hover]{' +
            'border-bottom:1px dotted currentColor;' +
            'background:color-mix(in srgb,currentColor 6%,transparent);}' +
            'ui-rich-text-editor img[data-action-click],ui-rich-text-editor img[data-action-hover]{' +
            'outline:2px dashed currentColor;outline-offset:2px;}';
        doc.head.appendChild(style);
        return () => this.releaseVisualizationStyles(doc);
    }

    private releaseVisualizationStyles(doc: Document): void {
        const style = doc.querySelector('style[data-rte-actions-style]') as HTMLStyleElement | null;
        if (!style) return;
        const next = Number(style.dataset['refcount'] ?? '1') - 1;
        if (next <= 0) style.remove();
        else style.dataset['refcount'] = String(next);
    }

    private applyAction(
        def: RichTextActionDefinition, trigger: RichTextActionTrigger,
        params: ActionParams, target: ApplyTarget,
    ): boolean {
        try {
            assertFlatParams(params);
        } catch (err) {
            console.error('[rich-text-actions] refused to attach non-flat params:', err);
            return false;
        }
        const el = target.kind === 'image' ? target.image : target.existing;
        if (el) {
            this.host.mutateContent(() => writeAction(el, trigger, def.id, params));
        } else if (target.kind === 'image') {
            console.error('[rich-text-actions] lost the image target before applying the action.');
            return false;
        } else {
            const doc = this.host.contentRoot.ownerDocument;
            const seed = this.mergedSeed(def);
            const created = this.host.wrapSelection(() => {
                const span = doc.createElement('span');
                writeAction(span, trigger, def.id, params);
                applyStarterStyle(span, seed);
                return span;
            });
            if (created.length === 0) {
                console.error('[rich-text-actions] lost the text selection before applying the action.');
                return false;
            }
        }
        this.actionAttached.emit({ actionId: def.id, trigger, params, targetKind: target.kind });
        return true;
    }

    private applyCombined(
        def: RichTextActionDefinition, params: { click: ActionParams; hover: ActionParams }, target: ApplyTarget,
    ): boolean {
        try {
            assertFlatParams(params.click);
            assertFlatParams(params.hover);
        } catch (err) {
            console.error('[rich-text-actions] refused to attach non-flat combined params:', err);
            return false;
        }
        const el = target.kind === 'image' ? target.image : target.existing;
        if (el) {
            this.host.mutateContent(() => writeCombined(el, def.id, params));
        } else if (target.kind === 'image') {
            console.error('[rich-text-actions] lost the image target before applying the action.');
            return false;
        } else {
            const doc = this.host.contentRoot.ownerDocument;
            const seed = this.mergedSeed(def);
            const created = this.host.wrapSelection(() => {
                const span = doc.createElement('span');
                writeCombined(span, def.id, params);
                applyStarterStyle(span, seed);
                return span;
            });
            if (created.length === 0) {
                console.error('[rich-text-actions] lost the text selection before applying the combined action.');
                return false;
            }
        }
        this.actionAttached.emit({ actionId: def.id, trigger: 'click', params: params.click, targetKind: target.kind });
        this.actionAttached.emit({ actionId: def.id, trigger: 'hover', params: params.hover, targetKind: target.kind });
        return true;
    }
}

/** The DOM target captured when the attach flow opens. */
interface ApplyTarget {
    kind: ActionTargetKind;
    /** An existing action element the caret sits inside, or null. */
    existing: HTMLElement | null;
    /** The selected image, when `kind === 'image'`. */
    image: HTMLImageElement | null;
}
