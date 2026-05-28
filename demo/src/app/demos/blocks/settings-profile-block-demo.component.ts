import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  SettingsProfileBlockComponent,
  ProfileSubmit,
} from '../../../../../packages/blocks/settings-profile';

@Component({
  selector: 'app-settings-profile-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsProfileBlockComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h2 id="settings-profile-block" class="text-2xl font-semibold scroll-m-20">Settings — Profile</h2>
        <p class="text-muted-foreground mt-1">
          A full profile settings form — avatar with upload controls, identity fields
          (name, username, email, role), a bio, and contact details (location, website).
          Composed from <code>card</code>, <code>input</code>, <code>textarea</code>,
          <code>label</code>, <code>avatar</code>, <code>separator</code> and <code>button</code>.
        </p>
        <code class="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs">npx shadcn-angular add settings-profile</code>
      </div>

      <div class="rounded-lg border overflow-hidden bg-background">
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span class="h-3 w-3 rounded-full bg-red-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-green-400/70"></span>
        </div>
        <div class="bg-muted/20 p-4 sm:p-8">
          <ui-settings-profile-block (submitted)="onSubmit($event)" />
        </div>
      </div>

      @if (lastSubmit(); as value) {
        <p class="text-sm text-muted-foreground">
          Saved profile for <span class="font-medium text-foreground">{{ value.name }}</span>
          ({{ value.email }}).
        </p>
      }
    </section>
  `,
})
export class SettingsProfileBlockDemoComponent {
  readonly lastSubmit = signal<ProfileSubmit | null>(null);

  onSubmit(value: ProfileSubmit): void {
    this.lastSubmit.set(value);
  }
}
