import { readActions } from './rich-text-actions.serializer';
import type { ActionParams, RichTextActionTrigger } from './rich-text-actions.types';

/** The event delivered to a handler when an action fires on rendered HTML. */
export interface RichTextActionEvent {
    actionId: string;
    trigger: RichTextActionTrigger;
    params: ActionParams;
    /** The actioned span/img the event resolved to. */
    element: HTMLElement;
    /** The originating DOM event. */
    domEvent: Event;
    /** Hover: `'start'` on enter, `'end'` on leave. Click: always `'start'`. */
    phase: 'start' | 'end';
}

export type RichTextActionHandler = (event: RichTextActionEvent) => void;

export interface BindRichTextActionsOptions {
    /** Map handlers per action id, plus an optional `'*'` catch-all. */
    handlers: Record<string, RichTextActionHandler>;
    /** `'tap-to-hover'` (default) maps first tap → hover start on touch; `'off'` delivers no hover on touch. */
    touchHoverBehavior?: 'tap-to-hover' | 'off';
    /** Add tabindex + role + class affordances to actioned elements. Default true. */
    a11yAffordances?: boolean;
    /** Class added to every actioned element (styling hook), or null for none. Default `'rte-action'`. */
    decorateClass?: string | null;
}

const CLICK_ATTR = 'data-action-click';
const HOVER_ATTR = 'data-action-hover';

/** Bind delegated click/hover action listeners to a container. Returns an unbind function. */
export function bindRichTextActions(
    container: HTMLElement, options: BindRichTextActionsOptions,
): () => void {
    const a11y = options.a11yAffordances ?? true;
    const decorateClass = options.decorateClass === undefined ? 'rte-action' : options.decorateClass;
    const touchHover = options.touchHoverBehavior ?? 'tap-to-hover';
    const decorated: HTMLElement[] = [];
    let tapHoverEl: HTMLElement | null = null;

    decorateExisting(container, { a11y, decorateClass, decorated });

    const onClick = (e: Event): void => dispatchClick(e, container, options);
    const onKeydown = (e: Event): void => handleKeydown(e as KeyboardEvent, container, options);
    const onOver = (e: Event): void => dispatchHover(e as MouseEvent, container, options, 'start');
    const onOut = (e: Event): void => dispatchHover(e as MouseEvent, container, options, 'end');
    const onFocusIn = (e: Event): void => dispatchFocusHover(e, container, options, 'start');
    const onFocusOut = (e: Event): void => dispatchFocusHover(e, container, options, 'end');
    const onTouchEnd = (e: Event): void => { tapHoverEl = handleTouch(e, container, options, touchHover, tapHoverEl); };

    container.addEventListener('click', onClick);
    container.addEventListener('keydown', onKeydown);
    container.addEventListener('mouseover', onOver);
    container.addEventListener('mouseout', onOut);
    container.addEventListener('focusin', onFocusIn);
    container.addEventListener('focusout', onFocusOut);
    container.addEventListener('touchend', onTouchEnd);

    return () => {
        container.removeEventListener('click', onClick);
        container.removeEventListener('keydown', onKeydown);
        container.removeEventListener('mouseover', onOver);
        container.removeEventListener('mouseout', onOut);
        container.removeEventListener('focusin', onFocusIn);
        container.removeEventListener('focusout', onFocusOut);
        container.removeEventListener('touchend', onTouchEnd);
        for (const el of decorated) revertDecoration(el, decorateClass);
    };
}

function decorateExisting(
    container: HTMLElement,
    ctx: { a11y: boolean; decorateClass: string | null; decorated: HTMLElement[] },
): void {
    const selector = `[${CLICK_ATTR}],[${HOVER_ATTR}]`;
    for (const el of Array.from(container.querySelectorAll<HTMLElement>(selector))) {
        if (ctx.decorateClass) {
            el.classList.add(ctx.decorateClass);
            if (el.hasAttribute(CLICK_ATTR)) el.classList.add(`${ctx.decorateClass}-click`);
            if (el.hasAttribute(HOVER_ATTR)) el.classList.add(`${ctx.decorateClass}-hover`);
        }
        if (ctx.a11y) {
            el.setAttribute('tabindex', '0');
            if (el.hasAttribute(CLICK_ATTR)) el.setAttribute('role', 'button');
        }
        ctx.decorated.push(el);
    }
}

function revertDecoration(el: HTMLElement, decorateClass: string | null): void {
    if (decorateClass) {
        el.classList.remove(decorateClass, `${decorateClass}-click`, `${decorateClass}-hover`);
        if (el.className === '') el.removeAttribute('class');
    }
    el.removeAttribute('tabindex');
    el.removeAttribute('role');
}

function actionedAncestor(target: EventTarget | null, container: HTMLElement, attr: string): HTMLElement | null {
    let el = target instanceof HTMLElement ? target : null;
    while (el && container.contains(el)) {
        if (el.hasAttribute(attr)) return el;
        el = el.parentElement;
    }
    return null;
}

function paramsFor(el: HTMLElement, trigger: RichTextActionTrigger): ActionParams {
    return readActions(el).find((a) => a.trigger === trigger)?.params ?? {};
}

function deliver(options: BindRichTextActionsOptions, event: RichTextActionEvent): void {
    options.handlers[event.actionId]?.(event);
    options.handlers['*']?.(event);
}

function emit(
    options: BindRichTextActionsOptions, el: HTMLElement, attr: string,
    trigger: RichTextActionTrigger, domEvent: Event, phase: 'start' | 'end',
): void {
    const id = el.getAttribute(attr);
    if (!id) return;
    deliver(options, { actionId: id, trigger, params: paramsFor(el, trigger), element: el, domEvent, phase });
}

function dispatchClick(e: Event, container: HTMLElement, options: BindRichTextActionsOptions): void {
    const el = actionedAncestor(e.target, container, CLICK_ATTR);
    if (el) emit(options, el, CLICK_ATTR, 'click', e, 'start');
}

function handleKeydown(e: KeyboardEvent, container: HTMLElement, options: BindRichTextActionsOptions): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = actionedAncestor(e.target, container, CLICK_ATTR);
    if (!el) return;
    e.preventDefault();
    emit(options, el, CLICK_ATTR, 'click', e, 'start');
}

function dispatchHover(
    e: MouseEvent, container: HTMLElement, options: BindRichTextActionsOptions, phase: 'start' | 'end',
): void {
    const el = actionedAncestor(e.target, container, HOVER_ATTR);
    if (!el) return;
    const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (related && el.contains(related)) return;
    emit(options, el, HOVER_ATTR, 'hover', e, phase);
}

function dispatchFocusHover(
    e: Event, container: HTMLElement, options: BindRichTextActionsOptions, phase: 'start' | 'end',
): void {
    const el = actionedAncestor(e.target, container, HOVER_ATTR);
    if (el) emit(options, el, HOVER_ATTR, 'hover', e, phase);
}

/**
 * Handle a touch tap. Returns the element currently held open by tap-to-hover
 * (or null). `'off'` lets the browser's synthetic click drive click actions.
 * On tap-to-hover: the first tap on a hover element shows it (and
 * `preventDefault`s the synthetic click); a tap elsewhere closes it (hover
 * `end`); a second tap on the held element (or a tap on a click-only element)
 * fires the click. Emitting always `preventDefault`s to avoid a synthetic
 * double-fire.
 */
function handleTouch(
    e: Event, container: HTMLElement, options: BindRichTextActionsOptions,
    touchHover: 'tap-to-hover' | 'off', current: HTMLElement | null,
): HTMLElement | null {
    if (touchHover === 'off') return null;
    const hoverEl = actionedAncestor(e.target, container, HOVER_ATTR);
    let next = current;
    if (current && current !== hoverEl) {
        emit(options, current, HOVER_ATTR, 'hover', e, 'end');
        next = null;
    }
    if (hoverEl && next !== hoverEl) {
        e.preventDefault();
        emit(options, hoverEl, HOVER_ATTR, 'hover', e, 'start');
        return hoverEl;
    }
    const clickEl = actionedAncestor(e.target, container, CLICK_ATTR);
    if (clickEl) {
        e.preventDefault();
        emit(options, clickEl, CLICK_ATTR, 'click', e, 'start');
    }
    return next;
}
