import { Component, OnDestroy, computed, signal, inject } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from '../button';
import { CommandDialogComponent, CommandInputComponent, CommandListComponent, CommandEmptyComponent, CommandGroupComponent, CommandItemComponent } from '../command';
import { ShortcutBindingsDialogComponent } from './shortcut-bindings-dialog.component';
import { ShortcutBindingService, ShortcutOverrideSchema } from '../../lib/shortcut-binding.service';

const meta: Meta<ShortcutBindingsDialogComponent> = {
    title: 'UI/Shortcut Bindings Dialog',
    component: ShortcutBindingsDialogComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ShortcutBindingsDialogComponent],
        }),
    ],
    argTypes: {
        open: { control: 'boolean', description: 'Whether the dialog is visible. Two-way bindable via `[(open)]`.' },
        allowSaveMapping: { control: 'boolean', description: 'Shows a "Save Changes" button that emits the current overrides via `mappingSave`.' },
        mappingSchema: { control: false, description: 'A shortcut-override schema to import into the binding service when it changes.' },
        replaceOnSchemaLoad: { control: 'boolean', description: 'Whether importing `mappingSchema` replaces existing overrides (true) or merges (false).' },
        locale: { control: false, description: 'Locale dictionary or registry key; falls back to `UI_LOCALE_ID`.' },
        mappingSave: { control: false, description: 'Emits the exported shortcut-override schema when "Save Changes" is clicked.' },
    },
    args: {
        open: false,
        allowSaveMapping: false,
        mappingSchema: null,
        replaceOnSchemaLoad: true,
    },
};

export default meta;
type Story = StoryObj<ShortcutBindingsDialogComponent>;

const TEMPLATE = `
    <ui-shortcut-bindings-dialog
        [open]="open"
        [allowSaveMapping]="allowSaveMapping"
        [mappingSchema]="mappingSchema"
        [replaceOnSchemaLoad]="replaceOnSchemaLoad">
    </ui-shortcut-bindings-dialog>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. Toggle `open` to show the dialog. */
export const Playground: Story = { render };

export const AllowSaveMapping: Story = {
    args: { open: true, allowSaveMapping: true },
    render,
};

// --- Demo hosts: exercise the dialog wired to a live command palette and a
// mapping export/import round-trip (both need a running ShortcutBindingService). ---

@Component({
    selector: 'ui-shortcut-dialog-story-host',
    standalone: true,
    imports: [
        ButtonComponent,
        CommandDialogComponent,
        CommandInputComponent,
        CommandListComponent,
        CommandEmptyComponent,
        CommandGroupComponent,
        CommandItemComponent,
        ShortcutBindingsDialogComponent,
    ],
    template: `
      <div class="space-y-4 max-w-2xl">
        <p class="text-sm text-muted-foreground">
          Open command dialog with <kbd class="rounded border px-1.5 py-0.5 text-xs">Ctrl/Cmd + K</kbd>.
          Open shortcut manager and rebind actions live.
        </p>

        <div class="flex flex-wrap gap-2">
          <ui-button (click)="showCommandDialog.set(true)">Open Command Dialog</ui-button>
          <ui-button variant="outline" (click)="showShortcutDialog.set(true)">Manage Shortcuts</ui-button>
        </div>

        <ui-command-dialog [(open)]="showCommandDialog" [shortcutActionId]="'storybook.command.toggle'">
          <ui-command-input placeholder="Type a command..." />
          <ui-command-list>
            <ui-command-empty>No results found.</ui-command-empty>
            <ui-command-group heading="Actions">
              <ui-command-item value="new-file">New File</ui-command-item>
              <ui-command-item value="open-settings">Open Settings</ui-command-item>
            </ui-command-group>
          </ui-command-list>
        </ui-command-dialog>

        <ui-shortcut-bindings-dialog [(open)]="showShortcutDialog" />
      </div>
    `,
})
class ShortcutDialogStoryHostComponent implements OnDestroy {
    showCommandDialog = signal(false);
    showShortcutDialog = signal(false);

    private readonly shortcuts = inject(ShortcutBindingService);
    private readonly cleanup = this.shortcuts.registerShortcut('shortcut-story', {
        actionId: 'storybook.shortcuts.open',
        description: 'Open shortcuts dialog',
        defaultShortcut: 'Mod+Shift+/',
        scope: 'global',
        category: 'Navigation',
        handler: () => this.showShortcutDialog.set(true),
    });

    ngOnDestroy(): void {
        this.cleanup();
    }
}

export const WithCommandPalette: Story = {
    render: () => ({
        moduleMetadata: { imports: [ShortcutDialogStoryHostComponent] },
        template: `<ui-shortcut-dialog-story-host />`,
    }),
};

@Component({
    selector: 'ui-shortcut-mapping-story-host',
    standalone: true,
    imports: [ButtonComponent, ShortcutBindingsDialogComponent],
    template: `
      <div class="space-y-4 max-w-2xl">
        <p class="text-sm text-muted-foreground">
          Demonstrates <code>allowSaveMapping</code>: the dialog's "Save Changes" button emits the
          current overrides via <code>mappingSave</code>. "Load Sample Mapping" feeds a schema back
          in through <code>mappingSchema</code>, which re-imports it on the next open.
        </p>

        <div class="flex flex-wrap gap-2">
          <ui-button (click)="showDialog.set(true)">Open Shortcut Manager</ui-button>
          <ui-button variant="outline" (click)="loadSampleMapping()">Load Sample Mapping</ui-button>
        </div>

        @if (savedSchema()) {
          <div class="space-y-1">
            <p class="text-xs font-medium text-muted-foreground">Last exported mapping:</p>
            <pre class="text-xs bg-muted rounded-md p-3 overflow-x-auto max-w-[calc(100vw-2rem)]">{{ savedSchemaJson() }}</pre>
          </div>
        }

        <ui-shortcut-bindings-dialog
          [(open)]="showDialog"
          [allowSaveMapping]="true"
          [mappingSchema]="mappingSchema()"
          (mappingSave)="onMappingSave($event)"
        />
      </div>
    `,
})
class ShortcutMappingStoryHostComponent implements OnDestroy {
    showDialog = signal(false);
    savedSchema = signal<ShortcutOverrideSchema | null>(null);
    mappingSchema = signal<ShortcutOverrideSchema | null>(null);
    savedSchemaJson = computed(() => JSON.stringify(this.savedSchema(), null, 2));

    private readonly shortcuts = inject(ShortcutBindingService);
    private readonly cleanup = this.shortcuts.registerShortcut('shortcut-mapping-story', {
        actionId: 'storybook.mapping.demo',
        description: 'Demo action used to exercise mapping export/import',
        defaultShortcut: 'Mod+Shift+M',
        scope: 'global',
        category: 'Demo',
        handler: () => { /* no-op demo handler */ },
    });

    onMappingSave(schema: ShortcutOverrideSchema): void {
        this.savedSchema.set(schema);
    }

    loadSampleMapping(): void {
        this.mappingSchema.set({ 'storybook.mapping.demo': 'Mod+Shift+K' });
    }

    ngOnDestroy(): void {
        this.cleanup();
    }
}

export const MappingImportExport: Story = {
    render: () => ({
        moduleMetadata: { imports: [ShortcutMappingStoryHostComponent] },
        template: `<ui-shortcut-mapping-story-host />`,
    }),
};
