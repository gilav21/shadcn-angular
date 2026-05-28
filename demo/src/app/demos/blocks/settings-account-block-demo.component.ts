import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SettingsAccountBlockComponent,
  AccountSubmit,
} from '../../../../../packages/blocks/settings-account';

@Component({
  selector: 'app-settings-account-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsAccountBlockComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h2 id="settings-account-block" class="text-2xl font-semibold scroll-m-20">Settings — Account</h2>
        <p class="text-muted-foreground mt-1">
          An account settings page with email, a change-password section, and a
          danger-zone delete action. Composed from <code>card</code>, <code>input</code>,
          <code>label</code>, <code>button</code>, <code>separator</code> and <code>alert</code>.
        </p>
        <code class="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs">npx shadcn-angular add settings-account</code>
      </div>

      <div class="rounded-lg border overflow-hidden bg-background">
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span class="h-3 w-3 rounded-full bg-red-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-green-400/70"></span>
        </div>
        <div class="bg-muted/20 p-4 sm:p-8">
          <ui-settings-account-block
            (submitted)="onSubmit($event)"
            (deleteRequested)="onDelete()" />
        </div>
      </div>

      @if (lastSubmit(); as value) {
        <p class="text-sm text-muted-foreground">
          Saved account for <span class="font-medium text-foreground">{{ value.email }}</span>.
        </p>
      }
      @if (deleteAsked()) {
        <p class="text-sm text-destructive">Delete account requested (demo — no action taken).</p>
      }
    </section>
  `,
})
export class SettingsAccountBlockDemoComponent {
  readonly lastSubmit = signal<AccountSubmit | null>(null);
  readonly deleteAsked = signal(false);

  onSubmit(value: AccountSubmit): void {
    this.lastSubmit.set(value);
  }

  onDelete(): void {
    this.deleteAsked.set(true);
  }
}
