import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../../components/lib/utils';
import { ButtonComponent } from '../../components/ui/button';
import { InputComponent } from '../../components/ui/input';
import { LabelComponent } from '../../components/ui/label';
import { CheckboxComponent } from '../../components/ui/checkbox';
import {
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
} from '../../components/ui/card';

export interface LoginSubmit {
  readonly email: string;
  readonly password: string;
  readonly remember: boolean;
}

@Component({
  selector: 'ui-login-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    LabelComponent,
    CheckboxComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
  ],
  templateUrl: './login.component.html',
  host: { class: 'block' },
})
export class LoginBlockComponent {
  readonly class = input('');
  readonly email = signal('');
  readonly password = signal('');
  readonly remember = signal(false);
  readonly submitted = output<LoginSubmit>();

  readonly classes = computed(() =>
    cn('flex min-h-svh items-center justify-center p-4 sm:p-6', this.class()),
  );

  onSubmit(): void {
    this.submitted.emit({
      email: this.email(),
      password: this.password(),
      remember: this.remember(),
    });
  }
}
