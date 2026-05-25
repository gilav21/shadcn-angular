import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { createLocaleBindings, provideComponentLocale, type LocaleInput } from '../../lib/i18n';
import { BREADCRUMB_LOCALES, type BreadcrumbLocale } from './breadcrumb.locales';

/**
 * Interface for data-driven breadcrumb items
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}

@Component({
  selector: 'ui-breadcrumb',
  providers: [provideComponentLocale(() => BreadcrumbComponent)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      [attr.aria-label]="t().breadcrumb"
      [attr.data-slot]="'breadcrumb'"
      [attr.dir]="dir()">
      <ng-content />
    </nav>
  `,
  host: { class: 'contents' },
})
export class BreadcrumbComponent {
  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<BreadcrumbLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, BREADCRUMB_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;
}
