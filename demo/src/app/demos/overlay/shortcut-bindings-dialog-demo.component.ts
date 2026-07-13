import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  CardContentComponent,
  CardDescriptionComponent,
  CardHeaderComponent,
  CardTitleComponent,
  ShortcutBindingsDialogComponent,
  type ShortcutBindingsDialogLocale,
} from '../../../../../packages/components/ui';
import {
  ShortcutBindingService,
  type ShortcutOverrideSchema,
  type ShortcutRegistration,
} from '../../../../../packages/components/lib/shortcut-binding.service';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  SHORTCUT_BINDINGS_DIALOG_DEMO_LOCALES,
  type ShortcutBindingsDialogDemoLocale,
} from './shortcut-bindings-dialog-demo.locales';

const EDITOR_ONE = 'demo-editor-1';
const EDITOR_TWO = 'demo-editor-2';
const TABLE_ONE = 'demo-table-1';
const APP_ONE = 'demo-app-1';

const SAMPLE_MAPPING: ShortcutOverrideSchema = {
  'demo-editor::demo.editor.save': 'Mod+Alt+S',
  'demo-table::demo.table.export': 'Mod+Alt+E',
};

const RTL_LOCALES = new Set(['he', 'ar']);

@Component({
  selector: 'app-shortcut-bindings-dialog-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    CardContentComponent,
    CardDescriptionComponent,
    CardHeaderComponent,
    CardTitleComponent,
    ShortcutBindingsDialogComponent,
  ],
  host: {
    '(document:keydown)': 'onGlobalKeydown($event)',
  },
  template: `
    <div class="space-y-10">
      <section class="space-y-4">
        <h2 id="shortcut-bindings-dialog" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
        <p class="text-muted-foreground">{{ t().description }}</p>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().basicHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().basicDesc }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <ui-button (click)="openManager()">{{ t().openButton }}</ui-button>
          <p class="text-sm text-muted-foreground">
            {{ t().kbdHintPrefix }}
            <kbd class="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{{ t().kbdHintKey }}</kbd>
            {{ t().kbdHintSuffix }}
          </p>
        </div>

        <ui-card>
          <ui-card-header>
            <ui-card-title>{{ t().platformLabel }}</ui-card-title>
            <ui-card-description>{{ t().platformDesc }}</ui-card-description>
          </ui-card-header>
          <ui-card-content>
            <kbd class="rounded border bg-muted px-2 py-1 font-mono text-sm">{{ modKey() }}</kbd>
          </ui-card-content>
        </ui-card>

        <ui-shortcut-bindings-dialog [(open)]="managerOpen" />
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().catalogHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().catalogDesc }}</p>

        <div class="w-full overflow-x-auto rounded-md border">
          <table class="w-full min-w-[36rem] text-sm">
            <thead class="bg-muted/50 text-start">
              <tr>
                <th scope="col" class="px-3 py-2 text-start font-medium">{{ t().colAction }}</th>
                <th scope="col" class="px-3 py-2 text-start font-medium">{{ t().colCategory }}</th>
                <th scope="col" class="px-3 py-2 text-start font-medium">{{ t().colComponent }}</th>
                <th scope="col" class="px-3 py-2 text-start font-medium">{{ t().colDefault }}</th>
                <th scope="col" class="px-3 py-2 text-start font-medium">{{ t().colEffective }}</th>
                <th scope="col" class="px-3 py-2 text-start font-medium">{{ t().colInstances }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of catalogRows(); track row.actionId) {
                <tr class="border-t">
                  <td class="px-3 py-2">{{ row.description }}</td>
                  <td class="px-3 py-2">
                    <ui-badge variant="secondary">{{ row.category }}</ui-badge>
                  </td>
                  <td class="px-3 py-2 font-mono text-xs text-muted-foreground">{{ row.componentName }}</td>
                  <td class="px-3 py-2">
                    <kbd class="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{{ row.defaultShortcut }}</kbd>
                  </td>
                  <td class="px-3 py-2">
                    <kbd class="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{{ row.effectiveShortcut }}</kbd>
                  </td>
                  <td class="px-3 py-2 tabular-nums">{{ row.instances }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().tryHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().tryDesc }}</p>

        <button
          type="button"
          class="flex min-h-[6rem] w-full max-w-xl flex-col items-start justify-center gap-2 rounded-md border border-dashed bg-muted/30 p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
          (keydown)="onEditorKeydown($event)"
        >
          <span class="text-sm text-muted-foreground">{{ t().surfaceHint }}</span>
          <span class="text-sm">
            <strong>{{ t().lastActionLabel }}</strong>
            {{ lastAction() || t().noActionYet }}
          </span>
        </button>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().mappingHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().mappingDesc }}</p>

        <div class="flex flex-wrap items-center gap-2">
          <ui-button (click)="openMapping()">{{ t().openMappingButton }}</ui-button>
          <ui-button variant="outline" (click)="loadSampleMapping()">{{ t().loadSampleButton }}</ui-button>
          <ui-button variant="ghost" (click)="resetOverrides()">{{ t().resetButton }}</ui-button>
        </div>

        @if (savedSchema()) {
          <div class="space-y-1">
            <p class="text-xs font-medium text-muted-foreground">{{ t().savedLabel }}</p>
            <pre class="max-w-[calc(100vw-2rem)] overflow-x-auto rounded-md bg-muted p-3 text-xs">{{ savedSchemaJson() }}</pre>
          </div>
        } @else {
          <p class="text-xs text-muted-foreground">{{ t().notSavedLabel }}</p>
        }

        <ui-shortcut-bindings-dialog
          [(open)]="mappingOpen"
          [allowSaveMapping]="true"
          [mappingSchema]="mappingSchema()"
          (mappingSave)="onMappingSave($event)"
        />
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().localeHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().localeDesc }}</p>

        <ui-button variant="outline" (click)="openCustom()">{{ t().openLocalizedButton }}</ui-button>

        <ui-shortcut-bindings-dialog [(open)]="customOpen" [locale]="customLocale()" />
      </section>
    </div>
  `,
})
export class ShortcutBindingsDialogDemoComponent implements OnDestroy {
  private readonly localeId = inject(UI_LOCALE_ID);
  private readonly shortcuts = inject(ShortcutBindingService);

  protected readonly t = computed(
    () => SHORTCUT_BINDINGS_DIALOG_DEMO_LOCALES[this.localeId()] ?? SHORTCUT_BINDINGS_DIALOG_DEMO_LOCALES['en'],
  );

  readonly managerOpen = signal(false);
  readonly mappingOpen = signal(false);
  readonly customOpen = signal(false);
  readonly lastAction = signal('');
  readonly savedSchema = signal<ShortcutOverrideSchema | null>(null);
  readonly mappingSchema = signal<ShortcutOverrideSchema | null>(null);

  readonly savedSchemaJson = computed(() => JSON.stringify(this.savedSchema(), null, 2));

  readonly modKey = computed(() => this.shortcuts.formatShortcutForDisplay('Mod+K'));

  /** Dictionary passed to `[locale]` — overrides the dialog's own wording. */
  readonly customLocale = computed<ShortcutBindingsDialogLocale>(() => {
    const code = this.localeId();
    const strings = this.t();
    return {
      code,
      rtl: RTL_LOCALES.has(code),
      searchPlaceholder: strings.customSearchPlaceholder,
      conflict: strings.customConflict,
      rebindAllInstances: strings.customRebindAll,
      rebindInstance: strings.customRebindInstance,
    };
  });

  readonly catalogRows = computed(() =>
    this.shortcuts.getShortcutCatalog().map(item => ({
      actionId: item.actionId,
      description: item.description,
      category: item.category ?? '',
      componentName: item.componentName,
      defaultShortcut: this.shortcuts.formatShortcutForDisplay(item.defaultShortcut),
      effectiveShortcut: this.shortcuts.formatShortcutForDisplay(item.effectiveShortcut),
      instances: item.activeInstanceCount,
    })),
  );

  private cleanup: (() => void) | null = null;

  constructor() {
    effect(() => {
      const strings = this.t();
      this.cleanup?.();
      this.cleanup = this.registerDemoShortcuts(strings);
    });
  }

  ngOnDestroy(): void {
    this.cleanup?.();
    this.cleanup = null;
  }

  onGlobalKeydown(event: KeyboardEvent): void {
    this.shortcuts.dispatch(event);
  }

  onEditorKeydown(event: KeyboardEvent): void {
    this.shortcuts.dispatch(event, { componentId: EDITOR_ONE });
  }

  openManager(): void {
    this.managerOpen.set(true);
  }

  openMapping(): void {
    this.mappingOpen.set(true);
  }

  openCustom(): void {
    this.customOpen.set(true);
  }

  loadSampleMapping(): void {
    this.mappingSchema.set({ ...SAMPLE_MAPPING });
  }

  resetOverrides(): void {
    this.mappingSchema.set(null);
    this.savedSchema.set(null);
    this.shortcuts.clearAllShortcutOverrides();
  }

  onMappingSave(schema: ShortcutOverrideSchema): void {
    this.savedSchema.set(schema);
  }

  private registerDemoShortcuts(strings: ShortcutBindingsDialogDemoLocale): () => void {
    const cleanups = [
      this.shortcuts.registerShortcuts(EDITOR_ONE, this.editorRegistrations(strings)),
      this.shortcuts.registerShortcuts(EDITOR_TWO, this.editorRegistrations(strings)),
      this.shortcuts.registerShortcuts(TABLE_ONE, this.tableRegistrations(strings)),
      this.shortcuts.registerShortcuts(APP_ONE, this.appRegistrations(strings)),
    ];
    return () => cleanups.forEach(dispose => dispose());
  }

  private editorRegistrations(strings: ShortcutBindingsDialogDemoLocale): ShortcutRegistration[] {
    return [
      {
        actionId: 'demo.editor.bold',
        description: strings.actBold,
        defaultShortcut: 'Mod+B',
        category: strings.catEditor,
        handler: () => this.lastAction.set(strings.actBold),
      },
      {
        actionId: 'demo.editor.italic',
        description: strings.actItalic,
        defaultShortcut: 'Mod+I',
        category: strings.catEditor,
        handler: () => this.lastAction.set(strings.actItalic),
      },
      {
        actionId: 'demo.editor.save',
        description: strings.actSave,
        defaultShortcut: 'Mod+S',
        category: strings.catEditor,
        handler: () => this.lastAction.set(strings.actSave),
      },
    ];
  }

  private tableRegistrations(strings: ShortcutBindingsDialogDemoLocale): ShortcutRegistration[] {
    return [
      {
        actionId: 'demo.table.search',
        description: strings.actSearch,
        defaultShortcut: 'Mod+F',
        category: strings.catData,
        handler: () => this.lastAction.set(strings.actSearch),
      },
      {
        actionId: 'demo.table.export',
        description: strings.actExport,
        defaultShortcut: 'Mod+Shift+E',
        category: strings.catData,
        handler: () => this.lastAction.set(strings.actExport),
      },
    ];
  }

  private appRegistrations(strings: ShortcutBindingsDialogDemoLocale): ShortcutRegistration[] {
    return [
      {
        actionId: 'demo.app.shortcuts',
        description: strings.actShortcuts,
        defaultShortcut: 'Shift+?',
        category: strings.catApp,
        scope: 'global',
        when: () => !this.anyDialogOpen(),
        handler: () => this.openManager(),
      },
      {
        actionId: 'demo.app.ping',
        description: strings.actPing,
        defaultShortcut: 'Mod+Shift+L',
        category: strings.catApp,
        scope: 'global',
        handler: () => this.lastAction.set(strings.actPing),
      },
    ];
  }

  private anyDialogOpen(): boolean {
    return this.managerOpen() || this.mappingOpen() || this.customOpen();
  }
}
