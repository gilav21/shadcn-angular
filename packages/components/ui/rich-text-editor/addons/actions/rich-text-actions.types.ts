import type { Signal, Type, WritableSignal } from '@angular/core';

/** The DOM trigger an action responds to. */
export type RichTextActionTrigger = 'click' | 'hover';

/** Which kind of element an action attaches to. */
export type ActionTargetKind = 'text' | 'image';

/** Flat params object — the only shape that serializes into the HTML. */
export type ActionParams = Record<string, string | number | boolean>;

/** The attribute names carrying an action id, one per trigger. */
export const ACTION_ATTRS = ['data-action-click', 'data-action-hover'] as const;

/** A declarative form field (tier 1). The addon generates a form from these. */
export interface RichTextActionField {
    /** Param key written into the serialized params object. */
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select';
    required?: boolean;
    placeholder?: string;
    description?: string;
    /** Options for a `'select'` field. */
    options?: { value: string; label: string }[];
    defaultValue?: string | number | boolean;
    /** Return an error message, or null when valid. */
    validate?: (value: unknown) => string | null;
}

/** Context passed to a custom form component or an external `resolveParams` flow. */
export interface RichTextActionParamsContext {
    mode: 'create' | 'edit';
    trigger: RichTextActionTrigger;
    currentParams: ActionParams;
    /** The selected text, or '' for an image target. */
    selectionText: string;
    targetKind: ActionTargetKind;
    /** The element being edited (edit mode), or null when creating from a selection. */
    targetElement: HTMLElement | null;
}

/** Contract a tier-2 custom form component implements. */
export interface RichTextActionParamsForm {
    /** Set by the addon before render. */
    context: RichTextActionParamsContext;
    /** Two-way params state the addon reads on Apply. */
    readonly params: WritableSignal<ActionParams>;
    /** Gates the Apply button. */
    readonly valid: Signal<boolean>;
}

/**
 * A premade action a developer registers. Precedence for gathering params:
 * `resolveParams` > `formComponent` > `fields` > none.
 */
export interface RichTextActionDefinition {
    /** Unique id, serialized into the HTML. Dot-namespaced like slash commands. */
    id: string;
    label: string;
    description?: string;
    /** Lucide icon name shown in the picker. */
    icon?: string;
    triggers: RichTextActionTrigger[];
    /** Which targets the action may attach to. Default: both. */
    targets?: ActionTargetKind[];
    /** Starter inline styles seeded onto a newly-created action span. Merged over the directive's `uiRteActionsStyle`. */
    style?: Record<string, string>;
    /** Tier 1 — declarative fields; the addon generates the form. */
    fields?: RichTextActionField[];
    /** Tier 2 — a custom Angular form component rendered inside the addon dialog. */
    formComponent?: Type<RichTextActionParamsForm>;
    /** Tier 3 — a fully external flow; no addon dialog is shown. */
    resolveParams?: (ctx: RichTextActionParamsContext) => Promise<ActionParams | null>;
}
