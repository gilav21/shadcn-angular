import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    AvatarComponent,
    AvatarImageComponent,
    AvatarFallbackComponent,
} from '@/components/ui/avatar';

@Component({
    selector: 'app-avatar-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AvatarComponent, AvatarImageComponent, AvatarFallbackComponent],
    template: `
        <main class="p-8 space-y-4">
            <!-- Bad src so the image fails to load and the fallback shows. -->
            <ui-avatar data-testid="broken">
                <ui-avatar-image src="https://example.invalid/does-not-exist.png"
                    alt="Codex" />
                <ui-avatar-fallback data-testid="fallback">CX</ui-avatar-fallback>
            </ui-avatar>
        </main>
    `,
})
export class AvatarDemoComponent {}
