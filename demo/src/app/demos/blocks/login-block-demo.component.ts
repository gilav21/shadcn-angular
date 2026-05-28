import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LoginBlockComponent, LoginSubmit } from '../../../../../packages/blocks/login';

@Component({
  selector: 'app-login-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoginBlockComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h2 id="login-block" class="text-2xl font-semibold scroll-m-20">Login</h2>
        <p class="text-muted-foreground mt-1">
          An email/password sign-in page with a card layout, remember-me,
          Google sign-in, and a sign-up link. Composed from <code>card</code>,
          <code>input</code>, <code>label</code>, <code>button</code> and <code>checkbox</code>.
        </p>
        <code class="mt-3 inline-block rounded bg-muted px-2 py-1 text-xs">npx shadcn-angular add login</code>
      </div>

      <div class="rounded-lg border overflow-hidden bg-background">
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span class="h-3 w-3 rounded-full bg-red-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-400/70"></span>
          <span class="h-3 w-3 rounded-full bg-green-400/70"></span>
        </div>
        <div class="bg-muted/20 p-4 sm:p-8">
          <ui-login-block class="min-h-0" (submitted)="onSubmit($event)" />
        </div>
      </div>

      @if (lastSubmit(); as value) {
        <p class="text-sm text-muted-foreground">
          Submitted: <span class="font-medium text-foreground">{{ value.email }}</span>
          (remember me: {{ value.remember ? 'yes' : 'no' }})
        </p>
      }
    </section>
  `,
})
export class LoginBlockDemoComponent {
  readonly lastSubmit = signal<LoginSubmit | null>(null);

  onSubmit(value: LoginSubmit): void {
    this.lastSubmit.set(value);
  }
}
