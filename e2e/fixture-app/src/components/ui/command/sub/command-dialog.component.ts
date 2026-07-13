import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  effect,
  inject,
  input,
  model,
  OnDestroy,
} from '@angular/core';
import { DialogComponent, DialogContentComponent } from '../../dialog';
import { ShortcutBindingService, ShortcutComponentHandle } from '@/components/lib/shortcut-binding.service';
import { CommandComponent } from '../command.component';
import { CommandInputComponent } from './command-input.component';

@Component({
  selector: 'ui-command-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, DialogContentComponent, CommandComponent],
  template: `
    <ui-dialog [(open)]="open">
      <ui-dialog-content class="overflow-hidden p-0 shadow-lg">
        <ui-command class="**:data-[slot=command-group]:px-2 **:data-[slot=command-group]:font-medium **:data-[slot=command-group]:text-muted-foreground **:data-[slot=command-item]:px-2 **:data-[slot=command-item]:py-3 [&_[data-slot=command-item]_svg]:h-5 [&_[data-slot=command-item]_svg]:w-5">
           <ng-content />
        </ui-command>
      </ui-dialog-content>
    </ui-dialog>
  `,
  host: { class: 'contents' },
})
export class CommandDialogComponent implements OnDestroy {
  open = model(false);
  shortcutEnabled = input(true);
  shortcut = input('Mod+K');
  shortcutActionId = input('command-dialog.toggle');
  shortcutCategory = input('Navigation');

  commandInput = contentChild(CommandInputComponent);
  private readonly shortcutBindings = inject(ShortcutBindingService);
  private shortcutHandle: ShortcutComponentHandle | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        setTimeout(() => {
          this.commandInput()?.focus();
        });
      }
    });

    effect(() => {
      const enabled = this.shortcutEnabled();
      const shortcut = this.shortcut();
      const actionId = this.shortcutActionId();
      const category = this.shortcutCategory();
      this.shortcutHandle?.unregister();
      this.shortcutHandle = null;

      if (!enabled || !shortcut.trim() || !actionId.trim()) {
        return;
      }

      this.shortcutBindings.defineShortcuts('command-dialog', [{
        actionId,
        description: 'Toggle command dialog',
        defaultShortcut: shortcut,
        category,
        scope: 'global',
      }]);

      this.shortcutHandle = this.shortcutBindings.registerComponent('command-dialog', [{
        actionId,
        description: 'Toggle command dialog',
        defaultShortcut: shortcut,
        category,
        scope: 'global',
        handler: () => this.open.update(v => !v),
      }]);
    }, { allowSignalWrites: true });
  }

  ngOnDestroy(): void {
    this.shortcutHandle?.unregister();
    this.shortcutHandle = null;
  }
}
