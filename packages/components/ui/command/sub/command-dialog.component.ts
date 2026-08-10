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
import { ShortcutBindingService, ShortcutComponentHandle } from '../../../lib/shortcut-binding.service';
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
  /**
   * Two-way open state of the underlying `ui-dialog`. Toggled by the global
   * {@link shortcut}, and each transition to open focuses the projected
   * `ui-command-input` on the next tick.
   */
  open = model(false);
  /**
   * Set `false` to drop the global key binding entirely (the handle is
   * unregistered) and drive {@link open} yourself. A blank {@link shortcut} or
   * {@link shortcutActionId} has the same effect.
   */
  shortcutEnabled = input(true);
  /**
   * Global key combo that toggles {@link open}, in `ShortcutBindingService`
   * syntax — `Mod` resolves to Cmd on macOS and Ctrl elsewhere. Defaults to
   * `Mod+K`. Registered with `scope: 'global'`, so it fires regardless of focus.
   */
  shortcut = input('Mod+K');
  /**
   * Identity of the binding in `ShortcutBindingService`, which is what a
   * shortcut-settings UI persists user remappings against. Defaults to
   * `command-dialog.toggle`; give each dialog instance a distinct id when a
   * page hosts more than one, or they overwrite each other's binding.
   */
  shortcutActionId = input('command-dialog.toggle');
  /** Grouping label the binding is filed under in a shortcuts cheat-sheet or settings screen. Defaults to `Navigation`. */
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
