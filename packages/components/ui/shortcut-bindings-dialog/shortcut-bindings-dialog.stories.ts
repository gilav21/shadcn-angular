import { Component, OnDestroy, signal, inject } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from '../button';
import { CommandDialogComponent, CommandInputComponent, CommandListComponent, CommandEmptyComponent, CommandGroupComponent, CommandItemComponent } from '../command';
import { ShortcutBindingsDialogComponent } from './shortcut-bindings-dialog.component';
import { ShortcutBindingService } from '../../lib/shortcut-binding.service';

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

        <div class="flex gap-2">
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

const meta: Meta<ShortcutDialogStoryHostComponent> = {
    title: 'UI/Shortcut Bindings Dialog',
    component: ShortcutDialogStoryHostComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ShortcutDialogStoryHostComponent],
        }),
    ],
};

export default meta;
type Story = StoryObj<ShortcutDialogStoryHostComponent>;

export const Default: Story = {};
