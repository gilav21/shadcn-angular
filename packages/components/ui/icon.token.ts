import { InjectionToken, Provider } from '@angular/core';

export const UI_CUSTOM_ICONS = new InjectionToken<Record<string, string>>('UI_CUSTOM_ICONS');

export function provideIcons(icons: Record<string, string>): Provider {
    return {
        provide: UI_CUSTOM_ICONS,
        useValue: icons,
    };
}
