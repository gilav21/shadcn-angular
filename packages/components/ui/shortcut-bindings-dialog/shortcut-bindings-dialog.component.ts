import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { createLocaleBindings, interpolate, type LocaleInput } from '../../lib/i18n';
import { SHORTCUT_BINDINGS_DIALOG_LOCALES, type ShortcutBindingsDialogLocale } from './shortcut-bindings-dialog.locales';
import {
    DialogComponent,
    DialogContentComponent,
    DialogDescriptionComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
} from '../dialog';
import { ScrollAreaComponent } from '../scroll-area';
import { ButtonComponent } from '../button';
import { BadgeComponent } from '../badge';
import { ShortcutBindingService, ShortcutBindingView, ShortcutCatalogItem, ShortcutOverrideSchema } from '../../lib/shortcut-binding.service';
import { AccordionComponent, AccordionContentComponent, AccordionItemComponent, AccordionTriggerComponent } from '../accordion';

interface ShortcutDialogInstance {
    componentId: string;
    displayName: string;
    defaultShortcut: string;
    effectiveShortcut: string;
}

interface ShortcutDialogBinding extends ShortcutCatalogItem {
    instances: ShortcutDialogInstance[];
}

interface ShortcutDialogGroup {
    componentName: string;
    bindings: ShortcutDialogBinding[];
    activeBindings: number;
}

@Component({
    selector: 'ui-shortcut-bindings-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogComponent,
        DialogContentComponent,
        DialogHeaderComponent,
        DialogTitleComponent,
        DialogDescriptionComponent,
        ScrollAreaComponent,
        ButtonComponent,
        BadgeComponent,
        AccordionComponent,
        AccordionItemComponent,
        AccordionTriggerComponent,
        AccordionContentComponent,
    ],
    templateUrl: './shortcut-bindings-dialog.component.html',
})
export class ShortcutBindingsDialogComponent {
    /**
     * Two-way visibility of the underlying `ui-dialog`. The catalog is read from the
     * global {@link ShortcutBindingService} on every change-detection pass, so it is
     * already current when the dialog opens — no refresh call is needed.
     */
    readonly open = model(false);
    /**
     * Shows the "Save Changes" button that emits {@link mappingSave}. Off by default,
     * because rebinds are applied to the service immediately and only need exporting
     * if the host persists them.
     */
    readonly allowSaveMapping = input(false);
    /**
     * Overrides to import into {@link ShortcutBindingService} — applied by an effect
     * whenever the JSON serialization differs from the last import, so a schema
     * rebuilt with identical contents is a no-op and does not clobber live rebinds.
     */
    readonly mappingSchema = input<ShortcutOverrideSchema | null>(null);
    /**
     * How {@link mappingSchema} is imported: `true` (default) discards existing
     * overrides and installs the schema wholesale, `false` merges it over them.
     */
    readonly replaceOnSchemaLoad = input(true);
    /**
     * Emits the full exported override schema when the user presses "Save Changes"
     * (requires {@link allowSaveMapping}). Nothing is persisted by the component —
     * store the payload and feed it back through {@link mappingSchema} on startup.
     */
    readonly mappingSave = output<ShortcutOverrideSchema>();

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<ShortcutBindingsDialogLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, SHORTCUT_BINDINGS_DIALOG_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    /** Locale code to forward to the nested `<ui-dialog-content>` (which has its own dictionary shape). */
    protected readonly dialogLocaleCode = computed(() => {
        const loc = this.locale();
        if (!loc) return undefined;
        return typeof loc === 'string' ? loc : loc.code;
    });

    /** Interpolated aria-label for the "rebind all instances" capture button. */
    rebindAllAriaLabel(bindingDescription: string): string {
        return interpolate(this.t().rebindAllInstances, { binding: bindingDescription });
    }

    /** Interpolated aria-label for the per-instance rebind button. */
    rebindInstanceAriaLabel(instanceName: string, bindingDescription: string): string {
        return interpolate(this.t().rebindInstance, { name: instanceName, binding: bindingDescription });
    }

    private readonly shortcutBindings = inject(ShortcutBindingService);
    private readonly overrideVersion = signal(0);
    private readonly lastAppliedMappingSchema = signal<string | null>(null);

    search = signal('');
    capturingActionKey = signal<string | null>(null);
    private readonly searchOpenActionValuesByGroup = computed(() => {
        if (!this.searchActive()) {
            return new Map<string, string[]>();
        }

        const map = new Map<string, string[]>();
        for (const group of this.groupedBindings()) {
            map.set(
                group.componentName,
                group.bindings.map(binding => this.actionValue(binding.actionId, binding.componentName)),
            );
        }
        return map;
    });

    constructor() {
        effect(() => {
            const schema = this.mappingSchema();
            if (!schema) {
                return;
            }

            const serialized = JSON.stringify(schema);
            if (serialized === this.lastAppliedMappingSchema()) {
                return;
            }

            this.shortcutBindings.importOverrideSchema(schema, this.replaceOnSchemaLoad());
            this.lastAppliedMappingSchema.set(serialized);
            this.bumpVersion();
        });
    }

    bindings = computed(() => {
        this.overrideVersion();
        return this.shortcutBindings.getShortcutCatalog();
    });

    bindingViews = computed(() => {
        this.overrideVersion();
        return this.shortcutBindings.getShortcutBindingViews();
    });

    filteredBindings = computed(() => {
        const query = this.search().trim().toLowerCase();
        const sorted = [...this.bindings()].sort((a, b) => {
            const categoryA = (a.category ?? '').toLowerCase();
            const categoryB = (b.category ?? '').toLowerCase();
            if (categoryA !== categoryB) {
                return categoryA.localeCompare(categoryB);
            }
            return a.description.localeCompare(b.description);
        });

        if (!query) {
            return sorted;
        }

        return sorted.filter(binding => {
            const haystack = [
                binding.description,
                binding.actionId,
                binding.componentName,
                binding.category ?? '',
                this.format(binding.effectiveShortcut),
                this.format(binding.defaultShortcut),
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    });

    groupedBindings = computed((): ShortcutDialogGroup[] => {
        const groups = new Map<string, ShortcutDialogBinding[]>();
        const viewsByActionKey = this.createViewsByActionKey(this.bindingViews());

        for (const binding of this.filteredBindings()) {
            const key = this.actionKey(binding.actionId, binding.componentName);
            const instances = this.mapInstancesForBinding(
                binding,
                viewsByActionKey.get(key) ?? [],
            );
            const item: ShortcutDialogBinding = {
                ...binding,
                instances,
            };

            if (!groups.has(binding.componentName)) {
                groups.set(binding.componentName, []);
            }
            groups.get(binding.componentName)?.push(item);
        }

        return Array.from(groups.entries())
            .map(([componentName, bindings]) => ({
                componentName,
                bindings,
                activeBindings: bindings.filter(binding => binding.instances.length > 0).length,
            }))
            .sort((a, b) => a.componentName.localeCompare(b.componentName));
    });

    searchActive = computed(() => this.search().trim().length > 0);

    openGroupValues = computed(() => {
        if (!this.searchActive()) {
            return [];
        }
        return this.groupedBindings().map(group => this.groupValue(group.componentName));
    });

    conflictActionIds = computed(() => {
        this.overrideVersion();
        const ids = new Set<string>();
        for (const conflict of this.shortcutBindings.getConflicts()) {
            for (const actionId of conflict.actionIds) {
                ids.add(actionId);
            }
        }
        return ids;
    });

    /**
     * `(input)` handler for the filter box. Matching is case-insensitive across
     * description, action id, component name, category and both formatted shortcuts;
     * while a query is present every matching group and action is force-expanded.
     */
    onSearchInput(event: Event): void {
        this.search.set((event.target as HTMLInputElement).value ?? '');
    }

    /**
     * Exports the service's current overrides and emits them on {@link mappingSave}.
     * Only overrides travel — actions still on their defaults are omitted.
     */
    saveMappingSchema(): void {
        this.mappingSave.emit(this.shortcutBindings.exportOverrideSchema());
    }

    /**
     * Arms key capture for every instance of `componentName` and focuses `button` so
     * the next keystroke lands on {@link onComponentCaptureKeydown}. Only one capture
     * can be armed at a time — arming this one cancels any pending instance capture.
     */
    startCaptureForComponent(actionId: string, componentName: string, button: HTMLButtonElement): void {
        this.capturingActionKey.set(this.captureComponentKey(actionId, componentName));
        button.focus();
    }

    /**
     * Arms key capture for a single live instance (`componentId`, e.g. `data-table-2`)
     * and focuses `button`; the next keystroke is handled by
     * {@link onInstanceCaptureKeydown}. Counterpart of
     * {@link startCaptureForComponent}, and mutually exclusive with it.
     */
    startCaptureForInstance(actionId: string, componentId: string, button: HTMLButtonElement): void {
        this.capturingActionKey.set(this.captureInstanceKey(actionId, componentId));
        button.focus();
    }

    /**
     * Consumes the captured keystroke and rebinds `actionId` across all instances of
     * `componentName`. Ignored unless this button armed the capture; `Escape` cancels;
     * bare modifier presses are skipped so the user can build a chord. A successful
     * capture is applied immediately — it does not wait for {@link saveMappingSchema} —
     * and may produce a conflict badge (see {@link isConflicting}) rather than being
     * rejected.
     */
    onComponentCaptureKeydown(event: KeyboardEvent, actionId: string, componentName: string): void {
        if (this.capturingActionKey() !== this.captureComponentKey(actionId, componentName)) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.capturingActionKey.set(null);
            return;
        }

        const shortcut = this.shortcutBindings.shortcutFromEvent(event);
        if (!shortcut) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.shortcutBindings.setShortcutOverrideForAllInstances(actionId, shortcut, componentName);
        this.capturingActionKey.set(null);
        this.bumpVersion();
    }

    /**
     * Per-instance twin of {@link onComponentCaptureKeydown}: applies the captured
     * chord to `componentId` alone, leaving sibling instances on the component-wide
     * binding. `Escape` cancels, bare modifiers are ignored.
     */
    onInstanceCaptureKeydown(event: KeyboardEvent, actionId: string, componentId: string): void {
        if (this.capturingActionKey() !== this.captureInstanceKey(actionId, componentId)) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.capturingActionKey.set(null);
            return;
        }

        const shortcut = this.shortcutBindings.shortcutFromEvent(event);
        if (!shortcut) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.shortcutBindings.setShortcutOverrideForInstance(actionId, shortcut, componentId);
        this.capturingActionKey.set(null);
        this.bumpVersion();
    }

    /**
     * Drops the component-wide override for `actionId`, returning every instance of
     * `componentName` to its declared default, and cancels any armed capture. The
     * "Reset all" button is disabled unless {@link isComponentOverridden} is `true`.
     */
    resetComponent(actionId: string, componentName: string): void {
        this.shortcutBindings.clearShortcutOverrideForAllInstances(actionId, componentName);
        this.capturingActionKey.set(null);
        this.bumpVersion();
    }

    /**
     * Drops the override for one instance only; the instance then falls back to the
     * component-wide binding if one exists, otherwise to its default. See
     * {@link resetComponent} to clear the component-wide layer as well.
     */
    resetInstance(actionId: string, componentId: string): void {
        this.shortcutBindings.clearShortcutOverrideForInstance(actionId, componentId);
        this.capturingActionKey.set(null);
        this.bumpVersion();
    }

    /**
     * Whether a component-wide override is in force for `actionId` — drives the
     * enabled state of "Reset all". Instance-level overrides do not count; use
     * {@link isInstanceOverridden} for those.
     */
    isComponentOverridden(actionId: string, componentName: string): boolean {
        this.overrideVersion();
        return this.shortcutBindings.hasShortcutOverrideForAllInstances(actionId, componentName);
    }

    /**
     * Whether this specific instance carries its own override — drives the per-row
     * "Reset" button. An instance inheriting a component-wide override reports `false`.
     */
    isInstanceOverridden(actionId: string, componentId: string): boolean {
        this.overrideVersion();
        return this.shortcutBindings.hasShortcutOverrideForInstance(actionId, componentId);
    }

    /**
     * Whether `actionId` currently shares its effective chord with another action —
     * renders the destructive "conflict" badge. Conflicts are reported, never blocked,
     * so a rebind that collides still takes effect.
     */
    isConflicting(actionId: string): boolean {
        return this.conflictActionIds().has(actionId);
    }

    /**
     * Renders a stored chord (e.g. `mod+k`) as platform-appropriate display text —
     * `Cmd+K` on macOS, `Ctrl+K` elsewhere — returning the raw string unchanged if it
     * cannot be parsed. The search index matches on this text too.
     */
    format(shortcut: string): string {
        return this.shortcutBindings.formatShortcutForDisplay(shortcut);
    }

    /**
     * `componentName::actionId` — the identity used to `track` action rows and to
     * bucket binding views by action. Not a DOM value; see {@link actionValue}.
     */
    actionKey(actionId: string, componentName: string): string {
        return `${componentName}::${actionId}`;
    }

    /**
     * Accordion `value` for a component group (`group::<componentName>`), namespaced so
     * it can never collide with an {@link actionValue} in the nested accordion.
     */
    groupValue(componentName: string): string {
        return `group::${componentName}`;
    }

    /**
     * Accordion `value` for one action row — {@link actionKey} prefixed with `action::`.
     */
    actionValue(actionId: string, componentName: string): string {
        return `action::${this.actionKey(actionId, componentName)}`;
    }

    /**
     * Action rows to force open inside one group while a search is active. Returns an
     * empty array with no query, which lets the nested accordion fall back to
     * user-controlled expansion.
     */
    openActionValuesForGroup(componentName: string): string[] {
        return this.searchOpenActionValuesByGroup().get(componentName) ?? [];
    }

    /**
     * Token identifying an armed component-wide capture; compare against
     * `capturingActionKey()` to know whether a given "All" button is listening.
     */
    captureComponentKey(actionId: string, componentName: string): string {
        return `component::${componentName}::${actionId}`;
    }

    /**
     * Instance-scoped counterpart of {@link captureComponentKey}; the distinct
     * `instance::` prefix is what keeps the two capture modes from matching each other.
     */
    captureInstanceKey(actionId: string, componentId: string): string {
        return `instance::${componentId}::${actionId}`;
    }

    private mapInstancesForBinding(binding: ShortcutCatalogItem, views: ShortcutBindingView[]): ShortcutDialogInstance[] {
        const unique = new Map<string, ShortcutBindingView>();
        for (const view of views) {
            if (!unique.has(view.componentId)) {
                unique.set(view.componentId, view);
            }
        }

        return Array.from(unique.values())
            .sort((a, b) => this.instanceSortValue(a.componentId) - this.instanceSortValue(b.componentId))
            .map(view => ({
                componentId: view.componentId,
                displayName: this.instanceDisplayName(view.componentId, binding.componentName),
                defaultShortcut: view.defaultShortcut,
                effectiveShortcut: view.effectiveShortcut,
            }));
    }

    private createViewsByActionKey(views: ShortcutBindingView[]): Map<string, ShortcutBindingView[]> {
        const map = new Map<string, ShortcutBindingView[]>();
        for (const view of views) {
            const componentName = this.componentNameFromId(view.componentId);
            const key = this.actionKey(view.actionId, componentName);
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key)?.push(view);
        }
        return map;
    }

    private componentNameFromId(componentId: string): string {
        return componentId.replace(/-\d+$/, '');
    }

    private instanceSortValue(componentId: string): number {
        const match = new RegExp(/-(\d+)$/).exec(componentId);
        if (!match) {
            return Number.MAX_SAFE_INTEGER;
        }
        return Number(match[1]);
    }

    private instanceDisplayName(componentId: string, componentName: string): string {
        const index = this.instanceSortValue(componentId);
        if (index === Number.MAX_SAFE_INTEGER) {
            return componentId;
        }
        return `${componentName} #${index}`;
    }

    private bumpVersion(): void {
        this.overrideVersion.update(value => value + 1);
    }
}
