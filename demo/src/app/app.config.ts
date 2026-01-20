import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, importProvidersFrom } from '@angular/core';
import { LucideAngularModule, ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    importProvidersFrom(LucideAngularModule.pick({
      ArrowDown,
      ArrowUp,
      ChevronsUpDown,
      ChevronLeft,
      ChevronRight,
      ChevronsLeft,
      ChevronsRight
    }))
  ]
};
