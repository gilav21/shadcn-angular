import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
    DialogComponent,
    DialogContentComponent,
    DialogDescriptionComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
} from './dialog.component';
import { ScrollAreaComponent } from './scroll-area.component';
import { ButtonComponent } from './button';
import { BadgeComponent } from './badge';
import { ShortcutBindingService, ShortcutBindingView, ShortcutCatalogItem, ShortcutOverrideSchema } from '../lib/shortcut-binding.service';
import { AccordionComponent, AccordionContentComponent, AccordionItemComponent, AccordionTriggerComponent } from './accordion';

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
    template: `
    <ui-dialog [(open)]="open">
      <ui-dialog-content class="max-w-[calc(100vw-2rem)] sm:max-w-4xl p-0 overflow-hidden">
        <ui-dialog-header class="px-5 pt-5 pb-4 border-b">
          <ui-dialog-title>Keyboard Shortcuts</ui-dialog-title>
          <ui-dialog-description>
            Browse available shortcuts and rebind actions for this app.
          </ui-dialog-description>
          <div class="pt-3">
            <input
              type="text"
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              [value]="search()"
              placeholder="Search actions, categories, components, or keys..."
              (input)="onSearchInput($event)"
            />
          </div>
          @if (allowSaveMapping()) {
            <div class="pt-3 flex justify-end">
              <ui-button type="button" size="sm" variant="secondary" (click)="saveMappingSchema()">
                Save Changes
              </ui-button>
            </div>
          }
        </ui-dialog-header>

        <ui-scroll-area [class]="'h-[60vh] sm:h-[70vh] px-3 sm:px-5 py-3 sm:py-4'">
          <div class="space-y-3 pr-3">
            <ui-accordion type="multiple" class="flex flex-col gap-2" [openValues]="searchActive() ? openGroupValues() : null">
              @for (group of groupedBindings(); track group.componentName) {
                <ui-accordion-item [value]="groupValue(group.componentName)" class="rounded-lg border bg-card/60 px-3">
                  <ui-accordion-trigger class="py-2.5 text-left hover:no-underline">
                    <div class="min-w-0 space-y-0.5">
                      <h3 class="text-sm font-semibold tracking-tight capitalize">{{ group.componentName }}</h3>
                      <p class="text-xs text-muted-foreground">
                        {{ group.activeBindings }} active action{{ group.activeBindings === 1 ? '' : 's' }} / {{ group.bindings.length }} total
                      </p>
                    </div>
                  </ui-accordion-trigger>
                  <ui-accordion-content class="pt-1 pb-3">
                    <ui-accordion type="multiple" class="flex flex-col gap-2" [openValues]="searchActive() ? openActionValuesForGroup(group.componentName) : null">
                      @for (binding of group.bindings; track actionKey(binding.actionId, binding.componentName)) {
                        <ui-accordion-item [value]="actionValue(binding.actionId, binding.componentName)" class="rounded-md border bg-background px-3">
                          <ui-accordion-trigger class="py-2.5 hover:no-underline">
                            <div class="flex w-full items-start justify-between gap-3">
                              <div class="min-w-0 space-y-1 text-left">
                                <div class="flex items-center gap-2">
                                  <p class="text-sm font-medium leading-5">{{ binding.description }}</p>
                                  @if (binding.category) {
                                    <ui-badge variant="secondary">{{ binding.category }}</ui-badge>
                                  }
                                  @if (isConflicting(binding.actionId)) {
                                    <ui-badge variant="destructive">Conflict</ui-badge>
                                  }
                                </div>
                                <p class="text-xs text-muted-foreground leading-4">
                                  <span class="font-medium">Action:</span> {{ binding.actionId }}
                                </p>
                                <p class="text-xs text-muted-foreground leading-4">
                                  {{ binding.instances.length }} active instance{{ binding.instances.length === 1 ? '' : 's' }}
                                </p>
                              </div>

                              <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                                <button
                                  type="button"
                                  class="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent"
                                  [class.border-primary]="capturingActionKey() === captureComponentKey(binding.actionId, binding.componentName)"
                                  [attr.aria-label]="'Rebind all instances of ' + binding.description"
                                  (click)="startCaptureForComponent(binding.actionId, binding.componentName, captureAllBtn)"
                                  (keydown)="onComponentCaptureKeydown($event, binding.actionId, binding.componentName)"
                                  #captureAllBtn
                                >
                                  @if (capturingActionKey() === captureComponentKey(binding.actionId, binding.componentName)) {
                                    Press keys...
                                  } @else {
                                    All: {{ format(binding.effectiveShortcut) }}
                                  }
                                </button>

                                <ui-button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  class="h-8 px-2 text-[11px]"
                                  [disabled]="!isComponentOverridden(binding.actionId, binding.componentName)"
                                  (click)="resetComponent(binding.actionId, binding.componentName)"
                                >
                                  Reset all
                                </ui-button>
                              </div>
                            </div>
                          </ui-accordion-trigger>
                          <ui-accordion-content class="pt-1 pb-3">
                            @if (binding.instances.length > 0) {
                              <div class="space-y-2">
                                @for (instance of binding.instances; track instance.componentId) {
                                  <div class="rounded-md border border-dashed p-2.5">
                                    <div class="flex items-center justify-between gap-3">
                                      <div class="min-w-0">
                                        <p class="text-xs font-medium">{{ instance.displayName }}</p>
                                        <p class="text-[11px] text-muted-foreground">
                                          Default: {{ format(instance.defaultShortcut) }}
                                        </p>
                                      </div>

                                      <div class="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          class="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent"
                                          [class.border-primary]="capturingActionKey() === captureInstanceKey(binding.actionId, instance.componentId)"
                                          [attr.aria-label]="'Rebind instance ' + instance.displayName + ' for ' + binding.description"
                                          (click)="startCaptureForInstance(binding.actionId, instance.componentId, captureInstanceBtn)"
                                          (keydown)="onInstanceCaptureKeydown($event, binding.actionId, instance.componentId)"
                                          #captureInstanceBtn
                                        >
                                          @if (capturingActionKey() === captureInstanceKey(binding.actionId, instance.componentId)) {
                                            Press keys...
                                          } @else {
                                            {{ format(instance.effectiveShortcut) }}
                                          }
                                        </button>

                                        <ui-button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          class="h-8 px-2 text-[11px]"
                                          [disabled]="!isInstanceOverridden(binding.actionId, instance.componentId)"
                                          (click)="resetInstance(binding.actionId, instance.componentId)"
                                        >
                                          Reset
                                        </ui-button>
                                      </div>
                                    </div>
                                  </div>
                                }
                              </div>
                            } @else {
                              <div class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                No active instances. Use the "All" control to define the shared shortcut for future instances.
                              </div>
                            }
                          </ui-accordion-content>
                        </ui-accordion-item>
                      }
                    </ui-accordion>
                  </ui-accordion-content>
                </ui-accordion-item>
              }
            </ui-accordion>
            @if (groupedBindings().length === 0) {
              <div class="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
                No shortcuts matched your search.
              </div>
            }
          </div>
        </ui-scroll-area>
      </ui-dialog-content>
    </ui-dialog>
  `,
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
