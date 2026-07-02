import type { ActionParams, RichTextActionTrigger } from './rich-text-actions.types';

const ID_PATTERN = /^\w[\w.-]*$/;
const MAX_PARAMS_LENGTH = 4096;
const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean']);

function idAttr(trigger: RichTextActionTrigger): string {
    return `data-action-${trigger}`;
}

function paramsAttr(trigger: RichTextActionTrigger): string {
    return `data-action-${trigger}-params`;
}

function isFlatParamsObject(value: unknown): value is ActionParams {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value as Record<string, unknown>).every((v) => PRIMITIVE_TYPES.has(typeof v));
}

/** Return the id if it is a valid action id, else null. */
export function validateActionId(value: string): string | null {
    return ID_PATTERN.test(value) ? value : null;
}

/** Parse, shape-check and canonicalize params JSON; return canonical string or null. */
export function validateActionParams(value: string): string | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return null;
    }
    if (!isFlatParamsObject(parsed)) return null;
    const canonical = JSON.stringify(parsed);
    return canonical.length <= MAX_PARAMS_LENGTH ? canonical : null;
}

/** Assert params are a flat object of primitives (dev-facing guard before serialization). */
export function assertFlatParams(params: unknown): asserts params is ActionParams {
    if (!isFlatParamsObject(params)) {
        throw new Error('Action params must be a flat object of string | number | boolean values.');
    }
}

/** Write an action (id + params) for a trigger onto an element. */
export function writeAction(
    el: HTMLElement, trigger: RichTextActionTrigger, id: string, params: ActionParams,
): void {
    assertFlatParams(params);
    el.setAttribute(idAttr(trigger), id);
    if (Object.keys(params).length > 0) {
        el.setAttribute(paramsAttr(trigger), JSON.stringify(params));
    } else {
        el.removeAttribute(paramsAttr(trigger));
    }
}

/** Remove one trigger's action (id + params) from an element. */
export function removeAction(el: HTMLElement, trigger: RichTextActionTrigger): void {
    el.removeAttribute(idAttr(trigger));
    el.removeAttribute(paramsAttr(trigger));
}

/** Read all actions present on an element, in click-then-hover order. */
export function readActions(
    el: HTMLElement,
): { trigger: RichTextActionTrigger; id: string; params: ActionParams }[] {
    const triggers: RichTextActionTrigger[] = ['click', 'hover'];
    const out: { trigger: RichTextActionTrigger; id: string; params: ActionParams }[] = [];
    for (const trigger of triggers) {
        const id = el.getAttribute(idAttr(trigger));
        if (!id) continue;
        out.push({ trigger, id, params: parseParams(el.getAttribute(paramsAttr(trigger))) });
    }
    return out;
}

function parseParams(raw: string | null): ActionParams {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        return isFlatParamsObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}
