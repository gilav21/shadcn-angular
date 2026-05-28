import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../../components/lib/utils';
import { ButtonComponent } from '../../components/ui/button';
import { InputComponent } from '../../components/ui/input';
import { TextareaComponent } from '../../components/ui/textarea';
import { LabelComponent } from '../../components/ui/label';
import { SeparatorComponent } from '../../components/ui/separator';
import { AvatarComponent, AvatarFallbackComponent } from '../../components/ui/avatar';
import {
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
} from '../../components/ui/card';

export interface ProfileSubmit {
  readonly name: string;
  readonly email: string;
  readonly bio: string;
}

@Component({
  selector: 'ui-settings-profile-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    TextareaComponent,
    LabelComponent,
    SeparatorComponent,
    AvatarComponent,
    AvatarFallbackComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
  ],
  templateUrl: './settings-profile.component.html',
  host: { class: 'block' },
})
export class SettingsProfileBlockComponent {
  readonly class = input('');
  readonly name = signal('Ada Lovelace');
  readonly email = signal('ada@example.com');
  readonly bio = signal('');
  readonly submitted = output<ProfileSubmit>();

  readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .map(part => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );

  readonly classes = computed(() =>
    cn('mx-auto w-full max-w-2xl p-4 sm:p-6', this.class()),
  );

  onSubmit(): void {
    this.submitted.emit({ name: this.name(), email: this.email(), bio: this.bio() });
  }
}
