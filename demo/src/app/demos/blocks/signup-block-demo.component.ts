import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SignupBlockComponent, SignupSubmit } from '../../../../../packages/blocks/signup';

@Component({
  selector: 'app-signup-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SignupBlockComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h2 id="signup-block" class="text-2xl font-semibold scroll-m-20">Signup</h2>
        <p class="text-muted-foreground mt-1">
          An account-registration page with name, email, password, a terms checkbox,
          and Google sign-up. Composed from <code>card</code>, <code>input</code>,
          <code>label</code>, <code>button</code> and <code>checkbox</code>.
        </p>
        <code class="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs">npx shadcn-angular add signup</code>
      </div>

      <div class="rounded-lg border overflow-hidden bg-background">
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span class="h-3 w-3 rounded-full bg-red-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-green-400/70"></span>
        </div>
        <div class="bg-muted/20 p-4 sm:p-8">
          <ui-signup-block class="min-h-0" (submitted)="onSubmit($event)" />
        </div>
      </div>

      @if (lastSubmit(); as value) {
        <p class="text-sm text-muted-foreground">
          Submitted: <span class="font-medium text-foreground">{{ value.name }}</span>
          ({{ value.email }}) — terms accepted: {{ value.acceptTerms ? 'yes' : 'no' }}
        </p>
      }
    </section>
  `,
})
export class SignupBlockDemoComponent {
  readonly lastSubmit = signal<SignupSubmit | null>(null);

  onSubmit(value: SignupSubmit): void {
    this.lastSubmit.set(value);
  }
}
