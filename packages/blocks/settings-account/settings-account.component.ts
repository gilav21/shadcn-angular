import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../../components/lib/utils';
import { ButtonComponent } from '../../components/ui/button';
import { InputComponent } from '../../components/ui/input';
import { LabelComponent } from '../../components/ui/label';
import { SeparatorComponent } from '../../components/ui/separator';
import { IconComponent } from '../../components/ui/icon';
import {
  CollapsibleComponent,
  CollapsibleTriggerComponent,
  CollapsibleContentComponent,
} from '../../components/ui/collapsible';
import {
  AlertComponent,
  AlertTitleComponent,
  AlertDescriptionComponent,
} from '../../components/ui/alert';
import {
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
} from '../../components/ui/card';

export interface AccountSubmit {
  readonly email: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}

@Component({
  selector: 'ui-settings-account-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    LabelComponent,
    SeparatorComponent,
    IconComponent,
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent,
    AlertComponent,
    AlertTitleComponent,
    AlertDescriptionComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
  ],
  templateUrl: './settings-account.component.html',
  host: { class: 'block' },
})
export class SettingsAccountBlockComponent {
  readonly class = input('');
  readonly email = signal('ada@example.com');
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly submitted = output<AccountSubmit>();
  readonly deleteRequested = output<void>();

  readonly classes = computed(() =>
    cn('mx-auto w-full max-w-2xl p-4 sm:p-6', this.class()),
  );

  onSubmit(): void {
    this.submitted.emit({
      email: this.email(),
      currentPassword: this.currentPassword(),
      newPassword: this.newPassword(),
    });
  }

  onDelete(): void {
    this.deleteRequested.emit();
  }
}
