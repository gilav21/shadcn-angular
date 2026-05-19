import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
    DialogComponent,
    DialogContentComponent,
    DialogDescriptionComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
} from '../dialog.component';
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
    open = model(false);
    allowSaveMapping = input(false);
    mappingSchema = input<ShortcutOverrideSchema | null>(null);
    replaceOnSchemaLoad = input(true);
    mappingSave = output<ShortcutOverrideSchema>();

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
        }, { allowSignalWrites: true });
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

    onSearchInput(event: Event): void {
        this.search.set((event.target as HTMLInputElement).value ?? '');
    }

    saveMappingSchema(): void {
        this.mappingSave.emit(this.shortcutBindings.exportOverrideSchema());
    }

    startCaptureForComponent(actionId: string, componentName: string, button: HTMLButtonElement): void {
        this.capturingActionKey.set(this.captureComponentKey(actionId, componentName));
        button.focus();
    }

    startCaptureForInstance(actionId: string, componentId: string, button: HTMLButtonElement): void {
        this.capturingActionKey.set(this.captureInstanceKey(actionId, componentId));
        button.focus();
    }

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

    resetComponent(actionId: string, componentName: string): void {
        this.shortcutBindings.clearShortcutOverrideForAllInstances(actionId, componentName);
        this.capturingActionKey.set(null);
        this.bumpVersion();
    }

    resetInstance(actionId: string, componentId: string): void {
        this.shortcutBindings.clearShortcutOverrideForInstance(actionId, componentId);
        this.capturingActionKey.set(null);
        this.bumpVersion();
    }

    isComponentOverridden(actionId: string, componentName: string): boolean {
        this.overrideVersion();
        return this.shortcutBindings.hasShortcutOverrideForAllInstances(actionId, componentName);
    }

    isInstanceOverridden(actionId: string, componentId: string): boolean {
        this.overrideVersion();
        return this.shortcutBindings.hasShortcutOverrideForInstance(actionId, componentId);
    }

    isConflicting(actionId: string): boolean {
        return this.conflictActionIds().has(actionId);
    }

    format(shortcut: string): string {
        return this.shortcutBindings.formatShortcutForDisplay(shortcut);
    }

    actionKey(actionId: string, componentName: string): string {
        return `${componentName}::${actionId}`;
    }

    groupValue(componentName: string): string {
        return `group::${componentName}`;
    }

    actionValue(actionId: string, componentName: string): string {
        return `action::${this.actionKey(actionId, componentName)}`;
    }

    openActionValuesForGroup(componentName: string): string[] {
        return this.searchOpenActionValuesByGroup().get(componentName) ?? [];
    }

    captureComponentKey(actionId: string, componentName: string): string {
        return `component::${componentName}::${actionId}`;
    }

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
