import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ShortcutScope = 'component' | 'global';

export interface ShortcutRegistration {
    actionId: string;
    description: string;
    defaultShortcut: string;
    handler: (event: KeyboardEvent) => void;
    when?: () => boolean;
    preventDefault?: boolean;
    stopPropagation?: boolean;
    category?: string;
    scope?: ShortcutScope;
    priority?: number;
}

export interface ShortcutDefinition {
    actionId: string;
    description: string;
    defaultShortcut: string;
    category?: string;
    scope?: ShortcutScope;
}

export interface ShortcutDispatchContext {
    componentId?: string;
}

export interface ShortcutBindingView {
    actionId: string;
    description: string;
    category?: string;
    componentId: string;
    defaultShortcut: string;
    effectiveShortcut: string;
    scope: ShortcutScope;
}

export interface ShortcutComponentHandle {
    componentId: string;
    dispatch: (event: KeyboardEvent) => boolean;
    unregister: () => void;
}

export interface ShortcutConflict {
    shortcut: string;
    actionIds: string[];
}

export type ShortcutOverrideSchema = Record<string, string>;

export interface ShortcutCatalogItem {
    actionId: string;
    description: string;
    category?: string;
    componentName: string;
    defaultShortcut: string;
    effectiveShortcut: string;
    scope: ShortcutScope;
    activeInstanceCount: number;
    activeComponentIds: string[];
}

interface InternalShortcutRegistration extends ShortcutRegistration {
    componentId: string;
    componentName: string;
    registrationOrder: number;
}

interface ParsedShortcut {
    key: string;
    ctrl: boolean;
    meta: boolean;
    alt: boolean;
    shift: boolean;
    mod: boolean;
}

const STORAGE_KEY = 'ui-shortcut-binding-overrides';

@Injectable({ providedIn: 'root' })
export class ShortcutBindingService {
    private readonly document = inject(DOCUMENT);

    private readonly registrations = new Map<string, InternalShortcutRegistration>();
    private readonly overrides = new Map<string, string>();
    private readonly definitions = new Map<string, ShortcutCatalogItem>();
    private readonly handledEvents = new WeakSet<KeyboardEvent>();
    private readonly componentInstanceCounters = new Map<string, number>();
    private readonly componentReusableInstanceNumbers = new Map<string, number[]>();
    private readonly version = signal(0);
    private nextOrder = 0;

    constructor() {
        this.restoreOverridesFromStorage();
    }

    registerShortcut(componentId: string, registration: ShortcutRegistration): () => void {
        const componentName = this.deriveComponentName(componentId);
        this.upsertDefinition(componentName, registration);
        const key = this.composeRegistrationKey(componentId, registration.actionId);
        this.registrations.set(key, {
            ...registration,
            componentId,
            componentName,
            registrationOrder: this.nextOrder++,
        });
        this.bumpVersion();

        return () => {
            if (this.registrations.delete(key)) {
                if (!this.hasRegistrationsForComponent(componentId)) {
                    this.releaseComponentId(componentId);
                }
                this.bumpVersion();
            }
        };
    }

    registerShortcuts(componentId: string, registrations: ShortcutRegistration[]): () => void {
        const cleanups = registrations.map(registration => this.registerShortcut(componentId, registration));
        return () => {
            cleanups.forEach(cleanup => cleanup());
        };
    }

    registerComponent(componentName: string, registrations: ShortcutRegistration[]): ShortcutComponentHandle {
        const componentId = this.createComponentId(componentName);
        this.defineShortcuts(componentName, registrations.map(registration => ({
            actionId: registration.actionId,
            description: registration.description,
            defaultShortcut: registration.defaultShortcut,
            category: registration.category,
            scope: registration.scope,
        })));
        const unregister = this.registerShortcuts(componentId, registrations);
        return {
            componentId,
            dispatch: (event: KeyboardEvent) => this.dispatch(event, { componentId }),
            unregister,
        };
    }

    defineShortcuts(componentName: string, definitions: ShortcutDefinition[]): void {
        let changed = false;
        for (const definition of definitions) {
            const didChange = this.upsertDefinition(componentName, definition);
            changed = changed || didChange;
        }
        if (changed) {
            this.bumpVersion();
        }
    }

    unregisterComponent(componentId: string): void {
        let removed = false;
        for (const [key, registration] of this.registrations.entries()) {
            if (registration.componentId === componentId) {
                this.registrations.delete(key);
                removed = true;
            }
        }
        if (removed) {
            this.releaseComponentId(componentId);
            this.bumpVersion();
        }
    }

    dispatch(event: KeyboardEvent, context?: ShortcutDispatchContext): boolean {
        if (this.handledEvents.has(event)) {
            return false;
        }

        const ordered = Array.from(this.registrations.values()).sort((a, b) => {
            const byScope = this.scopeWeight(b, context) - this.scopeWeight(a, context);
            if (byScope !== 0) {
                return byScope;
            }
            const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
            if (byPriority !== 0) {
                return byPriority;
            }
            return a.registrationOrder - b.registrationOrder;
        });

        for (const registration of ordered) {
            if (!this.matchesContext(registration, context)) {
                continue;
            }

            if (registration.when && !registration.when()) {
                continue;
            }

            const effectiveShortcut = this.getEffectiveShortcut(
                registration.actionId,
                registration.defaultShortcut,
                registration.componentName,
                registration.componentId,
            );
            if (!this.matchesShortcut(event, effectiveShortcut)) {
                continue;
            }

            if (registration.preventDefault !== false) {
                event.preventDefault();
            }
            if (registration.stopPropagation) {
                event.stopPropagation();
            }
            registration.handler(event);
            this.handledEvents.add(event);
            return true;
        }

        return false;
    }

    setShortcutOverride(actionId: string, shortcut: string): void {
        this.setShortcutOverrideForComponent(actionId, shortcut);
    }

    setShortcutOverrideForComponent(actionId: string, shortcut: string, componentName?: string): void {
        const normalized = this.normalizeShortcut(shortcut);
        if (!normalized) {
            return;
        }
        const key = this.composeComponentOverrideKey(actionId, componentName);
        this.overrides.set(key, normalized);
        this.persistOverridesToStorage();
        this.bumpVersion();
    }

    setShortcutOverrideForAllInstances(actionId: string, shortcut: string, componentName: string): void {
        const normalized = this.normalizeShortcut(shortcut);
        if (!normalized) {
            return;
        }

        const normalizedComponentName = componentName.trim().toLowerCase();
        const componentKey = this.composeComponentOverrideKey(actionId, normalizedComponentName);
        this.overrides.set(componentKey, normalized);

        for (const key of Array.from(this.overrides.keys())) {
            if (this.isInstanceOverrideKeyForComponentAction(key, actionId, normalizedComponentName)) {
                this.overrides.delete(key);
            }
        }

        this.persistOverridesToStorage();
        this.bumpVersion();
    }

    setShortcutOverrideForInstance(actionId: string, shortcut: string, componentId: string): void {
        const normalized = this.normalizeShortcut(shortcut);
        if (!normalized) {
            return;
        }
        const key = this.composeInstanceOverrideKey(componentId, actionId);
        this.overrides.set(key, normalized);
        this.persistOverridesToStorage();
        this.bumpVersion();
    }

    clearShortcutOverride(actionId: string): void {
        this.clearShortcutOverrideForComponent(actionId);
    }

    clearShortcutOverrideForComponent(actionId: string, componentName?: string): void {
        const key = this.composeComponentOverrideKey(actionId, componentName);
        let changed = this.overrides.delete(key);
        if (!componentName) {
            changed = this.overrides.delete(actionId) || changed;
        }
        if (!changed) {
            return;
        }
        this.persistOverridesToStorage();
        this.bumpVersion();
    }

    clearShortcutOverrideForAllInstances(actionId: string, componentName: string): void {
        const normalizedComponentName = componentName.trim().toLowerCase();
        const componentKey = this.composeComponentOverrideKey(actionId, normalizedComponentName);
        let changed = this.overrides.delete(componentKey);

        for (const key of Array.from(this.overrides.keys())) {
            if (this.isInstanceOverrideKeyForComponentAction(key, actionId, normalizedComponentName)) {
                changed = this.overrides.delete(key) || changed;
            }
        }

        if (!changed) {
            return;
        }

        this.persistOverridesToStorage();
        this.bumpVersion();
    }

    clearShortcutOverrideForInstance(actionId: string, componentId: string): void {
        const key = this.composeInstanceOverrideKey(componentId, actionId);
        if (!this.overrides.delete(key)) {
            return;
        }
        this.persistOverridesToStorage();
        this.bumpVersion();
    }

    clearAllShortcutOverrides(): void {
        if (this.overrides.size === 0) {
            return;
        }
        this.overrides.clear();
        this.persistOverridesToStorage();
        this.bumpVersion();
    }

    getShortcutOverride(actionId: string): string | null {
        return this.getShortcutOverrideForComponent(actionId);
    }

    hasShortcutOverride(actionId: string): boolean {
        return this.overrides.has(actionId);
    }

    exportOverrideSchema(): ShortcutOverrideSchema {
        const schema: ShortcutOverrideSchema = {};
        const keys = Array.from(this.overrides.keys()).sort((a, b) => a.localeCompare(b));
        for (const key of keys) {
            const value = this.overrides.get(key);
            if (value) {
                schema[key] = value;
            }
        }
        return schema;
    }

    importOverrideSchema(schema: ShortcutOverrideSchema, replace = true): void {
        if (!schema || typeof schema !== 'object') {
            return;
        }

        const next = this.buildNextOverrides(schema, replace);

        if (replace && this.areOverridesUnchanged(next)) {
            return;
        }

        this.overrides.clear();
        for (const [key, value] of next.entries()) {
            this.overrides.set(key, value);
        }
        this.persistOverridesToStorage();
        this.bumpVersion();
    }

    private buildNextOverrides(schema: ShortcutOverrideSchema, replace: boolean): Map<string, string> {
        const next = new Map<string, string>();
        if (!replace) {
            for (const [key, value] of this.overrides.entries()) {
                next.set(key, value);
            }
        }
        for (const [key, value] of Object.entries(schema)) {
            const normalized = this.normalizeShortcut(value);
            if (normalized) {
                next.set(key, normalized);
            }
        }
        return next;
    }

    private areOverridesUnchanged(next: Map<string, string>): boolean {
        if (next.size !== this.overrides.size) {
            return false;
        }
        for (const [key, value] of next.entries()) {
            if (this.overrides.get(key) !== value) {
                return false;
            }
        }
        return true;
    }

    hasShortcutOverrideForComponent(actionId: string, componentName?: string): boolean {
        return this.overrides.has(this.composeComponentOverrideKey(actionId, componentName));
    }

    hasShortcutOverrideForInstance(actionId: string, componentId: string): boolean {
        return this.overrides.has(this.composeInstanceOverrideKey(componentId, actionId));
    }

    hasShortcutOverrideForAllInstances(actionId: string, componentName: string): boolean {
        const normalizedComponentName = componentName.trim().toLowerCase();
        if (this.overrides.has(this.composeComponentOverrideKey(actionId, normalizedComponentName))) {
            return true;
        }
        for (const key of this.overrides.keys()) {
            if (this.isInstanceOverrideKeyForComponentAction(key, actionId, normalizedComponentName)) {
                return true;
            }
        }
        return false;
    }

    getShortcutOverrideForComponent(actionId: string, componentName?: string): string | null {
        const scoped = this.overrides.get(this.composeComponentOverrideKey(actionId, componentName));
        if (scoped) {
            return scoped;
        }
        return this.overrides.get(actionId) ?? null;
    }

    getShortcutOverrideForInstance(actionId: string, componentId: string): string | null {
        const scoped = this.overrides.get(this.composeInstanceOverrideKey(componentId, actionId));
        if (scoped) {
            return scoped;
        }
        const componentName = this.deriveComponentName(componentId);
        return this.getShortcutOverrideForComponent(actionId, componentName);
    }

    getShortcutBindingViews(): ShortcutBindingView[] {
        this.version();
        return Array.from(this.registrations.values())
            .sort((a, b) => a.registrationOrder - b.registrationOrder)
            .map(registration => ({
                actionId: registration.actionId,
                description: registration.description,
                category: registration.category,
                componentId: registration.componentId,
                defaultShortcut: registration.defaultShortcut,
                effectiveShortcut: this.getEffectiveShortcut(
                    registration.actionId,
                    registration.defaultShortcut,
                    registration.componentName,
                    registration.componentId,
                ),
                scope: registration.scope ?? 'component',
            }));
    }

    getShortcutCatalog(): ShortcutCatalogItem[] {
        this.version();
        const catalog = new Map<string, ShortcutCatalogItem>();

        for (const [actionId, definition] of this.definitions.entries()) {
            catalog.set(actionId, {
                ...definition,
                effectiveShortcut: this.getEffectiveShortcut(actionId, definition.defaultShortcut, definition.componentName),
                activeInstanceCount: 0,
                activeComponentIds: [],
            });
        }

        for (const registration of this.registrations.values()) {
            const existing = catalog.get(registration.actionId);
            if (!existing) {
                catalog.set(registration.actionId, {
                    actionId: registration.actionId,
                    description: registration.description,
                    category: registration.category,
                    componentName: registration.componentName,
                    defaultShortcut: registration.defaultShortcut,
                    effectiveShortcut: this.getEffectiveShortcut(
                        registration.actionId,
                        registration.defaultShortcut,
                        registration.componentName,
                    ),
                    scope: registration.scope ?? 'component',
                    activeInstanceCount: 1,
                    activeComponentIds: [registration.componentId],
                });
                continue;
            }

            if (!existing.activeComponentIds.includes(registration.componentId)) {
                existing.activeComponentIds.push(registration.componentId);
                existing.activeInstanceCount = existing.activeComponentIds.length;
            }
        }

        return Array.from(catalog.values())
            .sort((a, b) => {
                const catA = (a.category ?? '').toLowerCase();
                const catB = (b.category ?? '').toLowerCase();
                if (catA !== catB) {
                    return catA.localeCompare(catB);
                }
                return a.description.localeCompare(b.description);
            });
    }

    getConflicts(): ShortcutConflict[] {
        const grouped = new Map<string, Set<string>>();
        for (const item of this.getShortcutCatalog()) {
            const normalized = this.normalizeShortcut(item.effectiveShortcut);
            if (!normalized) {
                continue;
            }
            if (!grouped.has(normalized)) {
                grouped.set(normalized, new Set());
            }
            grouped.get(normalized)?.add(item.actionId);
        }

        return Array.from(grouped.entries())
            .filter(([, actionIds]) => actionIds.size > 1)
            .map(([shortcut, actionIds]) => ({
                shortcut,
                actionIds: Array.from(actionIds).sort((a, b) => a.localeCompare(b)),
            }));
    }

    shortcutFromEvent(event: KeyboardEvent): string | null {
        const key = this.normalizeEventKey(event.key);
        if (!key || this.isModifierKey(key)) {
            return null;
        }
        const parts: string[] = [];
        if (event.ctrlKey) {
            parts.push('ctrl');
        }
        if (event.metaKey) {
            parts.push('meta');
        }
        if (event.altKey) {
            parts.push('alt');
        }
        if (event.shiftKey) {
            parts.push('shift');
        }
        parts.push(key);
        return this.normalizeShortcut(parts.join('+'));
    }

    formatShortcutForDisplay(shortcut: string): string {
        const parsed = this.parseShortcut(shortcut);
        if (!parsed) {
            return shortcut;
        }

        const parts: string[] = [];
        const isMac = this.isMacPlatform();

        if (parsed.mod) {
            parts.push(isMac ? 'Cmd' : 'Ctrl');
        }
        if (parsed.ctrl) {
            parts.push('Ctrl');
        }
        if (parsed.meta) {
            parts.push('Cmd');
        }
        if (parsed.alt) {
            parts.push('Alt');
        }
        if (parsed.shift) {
            parts.push('Shift');
        }
        parts.push(this.formatKeyForDisplay(parsed.key));

        return parts.join('+');
    }

    private matchesContext(registration: InternalShortcutRegistration, context?: ShortcutDispatchContext): boolean {
        if (!context?.componentId) {
            return registration.scope === 'global';
        }

        if (registration.scope === 'global') {
            return true;
        }

        return registration.componentId === context.componentId;
    }

    private scopeWeight(registration: InternalShortcutRegistration, context?: ShortcutDispatchContext): number {
        if (!context?.componentId) {
            return registration.scope === 'global' ? 2 : 0;
        }

        if (registration.scope === 'global') {
            return 1;
        }

        return registration.componentId === context.componentId ? 2 : 0;
    }

    private getEffectiveShortcut(
        actionId: string,
        defaultShortcut: string,
        componentName?: string,
        componentId?: string,
    ): string {
        if (componentId) {
            return this.getShortcutOverrideForInstance(actionId, componentId) ?? defaultShortcut;
        }
        return this.getShortcutOverrideForComponent(actionId, componentName) ?? defaultShortcut;
    }

    private matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
        const parsed = this.parseShortcut(shortcut);
        if (!parsed) {
            return false;
        }

        if (this.normalizeEventKey(event.key) !== parsed.key) {
            return false;
        }

        const isMac = this.isMacPlatform();
        const ctrlRequired = parsed.ctrl || (parsed.mod && !isMac);
        const metaRequired = parsed.meta || (parsed.mod && isMac);

        return event.ctrlKey === ctrlRequired
            && event.metaKey === metaRequired
            && event.altKey === parsed.alt
            && event.shiftKey === parsed.shift;
    }

    private parseShortcut(shortcut: string): ParsedShortcut | null {
        const normalized = this.normalizeShortcut(shortcut);
        if (!normalized) {
            return null;
        }

        const tokens = normalized.split('+');
        let key = '';
        let ctrl = false;
        let meta = false;
        let alt = false;
        let shift = false;
        let mod = false;

        for (const token of tokens) {
            if (token === 'ctrl') {
                ctrl = true;
                continue;
            }
            if (token === 'meta') {
                meta = true;
                continue;
            }
            if (token === 'alt') {
                alt = true;
                continue;
            }
            if (token === 'shift') {
                shift = true;
                continue;
            }
            if (token === 'mod') {
                mod = true;
                continue;
            }
            key = token;
        }

        if (!key) {
            return null;
        }

        return { key, ctrl, meta, alt, shift, mod };
    }

    private normalizeShortcut(shortcut: string): string | null {
        if (!shortcut || typeof shortcut !== 'string') {
            return null;
        }

        const rawTokens = shortcut
            .split('+')
            .map(token => token.trim().toLowerCase())
            .filter(Boolean);

        if (rawTokens.length === 0) {
            return null;
        }

        const tokens = rawTokens.map(token => {
            if (token === 'control' || token === 'ctl') return 'ctrl';
            if (token === 'command' || token === 'cmd' || token === '⌘' || token === 'super') return 'meta';
            if (token === 'option' || token === 'opt') return 'alt';
            if (token === 'primary' || token === 'cmdorctrl' || token === 'cmd/ctrl' || token === 'ctrl/cmd') return 'mod';
            if (token === 'spacebar') return 'space';
            return token;
        });

        let key = '';
        const modifiers: string[] = [];

        for (const token of tokens) {
            if (token === 'ctrl' || token === 'meta' || token === 'alt' || token === 'shift' || token === 'mod') {
                if (!modifiers.includes(token)) {
                    modifiers.push(token);
                }
                continue;
            }

            key = this.normalizeEventKey(token);
        }

        if (!key) {
            return null;
        }

        return [...modifiers, key].join('+');
    }

    private normalizeEventKey(key: string): string {
        if (!key) {
            return '';
        }

        const lowered = key.toLowerCase();
        if (lowered === ' ') return 'space';
        if (lowered === 'spacebar') return 'space';
        if (lowered === 'esc') return 'escape';
        return lowered;
    }

    private isModifierKey(key: string): boolean {
        return key === 'shift' || key === 'control' || key === 'ctrl' || key === 'alt' || key === 'meta';
    }

    private formatKeyForDisplay(key: string): string {
        if (key === 'space') {
            return 'Space';
        }
        if (key.length === 1) {
            return key.toUpperCase();
        }
        return key.charAt(0).toUpperCase() + key.slice(1);
    }

    private composeRegistrationKey(componentId: string, actionId: string): string {
        return `${componentId}::${actionId}`;
    }

    private upsertDefinition(componentName: string, definition: ShortcutDefinition): boolean {
        const normalizedComponentName = componentName.trim().toLowerCase();
        const previous = this.definitions.get(definition.actionId);
        const normalizedDefaultShortcut = this.normalizeShortcut(definition.defaultShortcut) ?? definition.defaultShortcut;
        const next: ShortcutCatalogItem = {
            actionId: definition.actionId,
            description: definition.description,
            category: definition.category,
            componentName: normalizedComponentName,
            defaultShortcut: normalizedDefaultShortcut,
            effectiveShortcut: this.getEffectiveShortcut(definition.actionId, normalizedDefaultShortcut, normalizedComponentName),
            scope: definition.scope ?? 'component',
            activeInstanceCount: previous?.activeInstanceCount ?? 0,
            activeComponentIds: previous?.activeComponentIds ?? [],
        };
        const changed = previous?.description !== next.description
            || previous.category !== next.category
            || previous.componentName !== next.componentName
            || previous.defaultShortcut !== next.defaultShortcut
            || previous.scope !== next.scope;
        this.definitions.set(definition.actionId, next);
        return changed;
    }

    private createComponentId(componentName: string): string {
        const normalizedName = componentName.trim().toLowerCase().replaceAll(/\s+/g, '-');
        const reusable = this.componentReusableInstanceNumbers.get(normalizedName);
        if (reusable && reusable.length > 0) {
            const reused = reusable.shift();
            if (typeof reused === 'number') {
                return `${normalizedName}-${reused}`;
            }
        }
        const current = this.componentInstanceCounters.get(normalizedName) ?? 0;
        const next = current + 1;
        this.componentInstanceCounters.set(normalizedName, next);
        return `${normalizedName}-${next}`;
    }

    private deriveComponentName(componentId: string): string {
        return componentId.replace(/-\d+$/, '');
    }

    private composeComponentOverrideKey(actionId: string, componentName?: string): string {
        if (!componentName) {
            return actionId;
        }
        return `${componentName.trim().toLowerCase()}::${actionId}`;
    }

    private composeInstanceOverrideKey(componentId: string, actionId: string): string {
        return `${componentId.trim().toLowerCase()}::${actionId}`;
    }

    private isInstanceOverrideKeyForComponentAction(key: string, actionId: string, componentName: string): boolean {
        if (!key.endsWith(`::${actionId}`)) {
            return false;
        }
        const componentId = key.slice(0, key.length - (`::${actionId}`).length);
        if (!/-\d+$/.test(componentId)) {
            return false;
        }
        return this.deriveComponentName(componentId) === componentName;
    }

    private hasRegistrationsForComponent(componentId: string): boolean {
        for (const registration of this.registrations.values()) {
            if (registration.componentId === componentId) {
                return true;
            }
        }
        return false;
    }

    private releaseComponentId(componentId: string): void {
        const normalizedName = this.deriveComponentName(componentId);
        const match = new RegExp(/-(\d+)$/).exec(componentId);
        if (!match) {
            return;
        }

        const number = Number(match[1]);
        if (!Number.isInteger(number) || number <= 0) {
            return;
        }

        const reusable = this.componentReusableInstanceNumbers.get(normalizedName) ?? [];
        if (!reusable.includes(number)) {
            reusable.push(number);
            reusable.sort((a, b) => a - b);
            this.componentReusableInstanceNumbers.set(normalizedName, reusable);
        }
    }

    private restoreOverridesFromStorage(): void {
        const storage = this.document.defaultView?.localStorage;
        if (!storage) {
            return;
        }

        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw) as Record<string, string>;
            for (const [actionId, shortcut] of Object.entries(parsed)) {
                const normalized = this.normalizeShortcut(shortcut);
                if (normalized) {
                    this.overrides.set(actionId, normalized);
                }
            }
        } catch {
            this.overrides.clear();
        }
    }

    private persistOverridesToStorage(): void {
        const storage = this.document.defaultView?.localStorage;
        if (!storage) {
            return;
        }

        const payload: Record<string, string> = {};
        for (const [actionId, shortcut] of this.overrides.entries()) {
            payload[actionId] = shortcut;
        }

        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore write failures (private mode, quota, etc.).
        }
    }

    private isMacPlatform(): boolean {
        const userAgent = this.document.defaultView?.navigator?.userAgent?.toLowerCase() ?? '';
        return userAgent.includes('macintosh') || userAgent.includes('iphone') || userAgent.includes('ipad');
    }

    private bumpVersion(): void {
        this.version.update(current => current + 1);
    }
}
