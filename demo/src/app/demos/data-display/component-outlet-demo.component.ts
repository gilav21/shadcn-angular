import {
    ChangeDetectionStrategy,
    Component,
    ComponentRef,
    Type,
    computed,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { BadgeComponent, ButtonComponent, UiComponentOutletDirective } from '../../../../../packages/components/ui';
import { ComponentPoolService } from '../../../../../packages/components/lib/component-pool.service';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { COMPONENT_OUTLET_DEMO_LOCALES } from './component-outlet-demo.locales';

type Tone = 'info' | 'success' | 'warning';

/** Dynamically rendered card. All copy arrives through the `inputs` record. */
@Component({
    selector: 'app-outlet-alert-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent],
    template: `
        <div class="rounded-lg border bg-card p-4 text-card-foreground">
            <div class="flex flex-wrap items-center gap-2">
                <ui-badge [variant]="badgeVariant()" [label]="toneLabel()" />
                <h4 class="text-sm font-semibold">{{ title() }}</h4>
            </div>
            <p class="mt-2 text-sm text-muted-foreground">{{ message() }}</p>
        </div>
    `,
})
export class OutletAlertCardComponent {
    readonly title = input('');
    readonly message = input('');
    readonly toneLabel = input('');
    readonly tone = input<Tone>('info');

    readonly badgeVariant = computed(() => {
        if (this.tone() === 'success') return 'default' as const;
        if (this.tone() === 'warning') return 'destructive' as const;
        return 'secondary' as const;
    });
}

/**
 * A second renderer for the same `{ title, message, tone, toneLabel }` data.
 * Swapping between renderers that share an input contract is the canonical
 * component-outlet use case (cell renderers, widget registries, plugins).
 */
@Component({
    selector: 'app-outlet-compact-row',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="flex flex-wrap items-baseline gap-2 rounded-md border-s-4 border-primary bg-muted/40 px-3 py-2">
            <span class="text-sm font-semibold">{{ title() }}</span>
            <span class="text-xs text-muted-foreground">{{ message() }}</span>
            <span class="ms-auto text-xs font-medium uppercase text-muted-foreground">{{ toneLabel() }}</span>
        </div>
    `,
})
export class OutletCompactRowComponent {
    readonly title = input('');
    readonly message = input('');
    readonly toneLabel = input('');
    readonly tone = input<Tone>('info');
}

/** A third renderer for the same data. */
@Component({
    selector: 'app-outlet-banner',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="rounded-lg bg-primary p-4 text-primary-foreground">
            <p class="text-xs uppercase tracking-wide opacity-80">{{ toneLabel() }}</p>
            <p class="mt-1 text-lg font-bold">{{ title() }}</p>
            <p class="text-sm opacity-90">{{ message() }}</p>
        </div>
    `,
})
export class OutletBannerComponent {
    readonly title = input('');
    readonly message = input('');
    readonly toneLabel = input('');
    readonly tone = input<Tone>('info');
}

/** Dynamically rendered stat tile — also the target of the imperative `setInput()` demo. */
@Component({
    selector: 'app-outlet-stat-tile',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="rounded-lg border bg-card p-4 text-card-foreground">
            <p class="text-xs uppercase tracking-wide text-muted-foreground">{{ label() }}</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ value() }}</p>
        </div>
    `,
})
export class OutletStatTileComponent {
    readonly label = input('');
    readonly value = input('0');
}

/** Dynamically rendered component with an output, wired through the `outputs` record. */
@Component({
    selector: 'app-outlet-vote-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    template: `
        <div class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-card-foreground">
            <span class="text-sm font-medium">{{ title() }}</span>
            <div class="flex flex-wrap gap-2">
                <ui-button size="sm" (clicked)="voted.emit('up')">{{ upLabel() }}</ui-button>
                <ui-button size="sm" variant="outline" (clicked)="voted.emit('down')">{{ downLabel() }}</ui-button>
            </div>
        </div>
    `,
})
export class OutletVoteCardComponent {
    readonly title = input('');
    readonly upLabel = input('');
    readonly downLabel = input('');
    readonly voted = output<string>();
}

@Component({
    selector: 'app-component-outlet-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [UiComponentOutletDirective, ButtonComponent, BadgeComponent],
    providers: [ComponentPoolService],
    template: `
        <div class="space-y-10">
            <section class="space-y-4">
                <h2 id="component-outlet" class="scroll-m-20 text-2xl font-semibold">{{ t().heading }}</h2>
                <p class="text-muted-foreground">{{ t().description }}</p>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().basicHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().basicDesc }}</p>
                <div class="w-full max-w-xl">
                    <ng-container [uiComponentOutlet]="alertType" [inputs]="basicInputs()" />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().swapHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().swapDesc }}</p>
                <div class="flex flex-wrap gap-2">
                    <ui-button size="sm" [variant]="swapVariant(alertType)" (clicked)="swapTo(alertType)">
                        {{ t().swapCard }}
                    </ui-button>
                    <ui-button size="sm" [variant]="swapVariant(compactType)" (clicked)="swapTo(compactType)">
                        {{ t().swapCompact }}
                    </ui-button>
                    <ui-button size="sm" [variant]="swapVariant(bannerType)" (clicked)="swapTo(bannerType)">
                        {{ t().swapBanner }}
                    </ui-button>
                </div>
                <div class="w-full max-w-xl">
                    <ng-container [uiComponentOutlet]="swapped()" [inputs]="tonedInputs()" />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().inputsHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().inputsDesc }}</p>
                <div class="flex flex-wrap gap-2">
                    <ui-button size="sm" [variant]="toneVariant('info')" (clicked)="setTone('info')">
                        {{ t().toneInfo }}
                    </ui-button>
                    <ui-button size="sm" [variant]="toneVariant('success')" (clicked)="setTone('success')">
                        {{ t().toneSuccess }}
                    </ui-button>
                    <ui-button size="sm" [variant]="toneVariant('warning')" (clicked)="setTone('warning')">
                        {{ t().toneWarning }}
                    </ui-button>
                </div>
                <div class="w-full max-w-xl">
                    <ng-container [uiComponentOutlet]="alertType" [inputs]="tonedInputs()" />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().outputsHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().outputsDesc }}</p>
                <div class="w-full max-w-xl space-y-3">
                    <ng-container
                        [uiComponentOutlet]="voteType"
                        [inputs]="voteInputs()"
                        [outputs]="voteOutputs()"
                    />
                    <div class="flex flex-wrap items-center gap-3">
                        <ui-badge variant="secondary" [label]="t().votesLabel + ': ' + score()" />
                        <ui-button size="sm" variant="ghost" (clicked)="clearLog()">{{ t().clearLog }}</ui-button>
                    </div>
                    <div class="rounded-lg border bg-muted/40 p-3">
                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {{ t().eventLog }}
                        </p>
                        @if (log().length === 0) {
                            <p class="mt-2 text-sm text-muted-foreground">{{ t().noEvents }}</p>
                        } @else {
                            <ul class="mt-2 space-y-1">
                                @for (entry of log(); track entry.id) {
                                    <li class="font-mono text-xs text-muted-foreground">
                                        voted → "{{ entry.value }}"
                                    </li>
                                }
                            </ul>
                        }
                    </div>
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().initializedHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().initializedDesc }}</p>
                <div class="w-full max-w-xl space-y-3">
                    <ng-container
                        [uiComponentOutlet]="statType"
                        [inputs]="statInputs()"
                        (initialized)="onStatInitialized($event)"
                    />
                    <div class="flex flex-wrap items-center gap-3">
                        <ui-badge variant="outline" [label]="t().renderedType + ': ' + renderedType()" />
                        <ui-button size="sm" variant="secondary" (clicked)="boostStat()">
                            {{ t().boostButton }}
                        </ui-button>
                    </div>
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().recycleHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().recycleDesc }}</p>
                <div class="flex flex-wrap gap-2">
                    <ui-button size="sm" (clicked)="addRow()">{{ t().addRow }}</ui-button>
                    <ui-button size="sm" variant="outline" (clicked)="removeRow()">{{ t().removeRow }}</ui-button>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <ui-badge variant="secondary" [label]="t().createdLabel + ': ' + stats().created" />
                    <ui-badge variant="secondary" [label]="t().recycledLabel + ': ' + stats().recycled" />
                    <ui-badge variant="secondary" [label]="t().pooledLabel + ': ' + stats().pooled" />
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    @for (row of rows(); track row) {
                        <div
                            [uiComponentOutlet]="statType"
                            [inputs]="{ label: t().rowLabel, value: '#' + row }"
                            [recycle]="true"
                            (initialized)="syncStats()"
                        ></div>
                    }
                </div>
            </section>
        </div>
    `,
})
export class ComponentOutletDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    private readonly pool = inject(ComponentPoolService);
    protected readonly t = computed(
        () => COMPONENT_OUTLET_DEMO_LOCALES[this.localeId()] ?? COMPONENT_OUTLET_DEMO_LOCALES['en'],
    );

    readonly alertType: Type<unknown> = OutletAlertCardComponent;
    readonly compactType: Type<unknown> = OutletCompactRowComponent;
    readonly bannerType: Type<unknown> = OutletBannerComponent;
    readonly statType: Type<unknown> = OutletStatTileComponent;
    readonly voteType: Type<unknown> = OutletVoteCardComponent;

    readonly basicInputs = computed<Record<string, unknown>>(() => ({
        title: this.t().alertTitle,
        message: this.t().alertMessage,
        toneLabel: this.t().toneInfo,
        tone: 'info',
    }));

    readonly swapped = signal<Type<unknown>>(OutletAlertCardComponent);

    private readonly tone = signal<Tone>('info');

    readonly tonedInputs = computed<Record<string, unknown>>(() => ({
        title: this.t().alertTitle,
        message: this.t().alertMessage,
        tone: this.tone(),
        toneLabel: this.toneLabelFor(this.tone()),
    }));

    readonly voteInputs = computed<Record<string, unknown>>(() => ({
        title: this.t().ticketTitle,
        upLabel: this.t().voteUp,
        downLabel: this.t().voteDown,
    }));

    readonly score = signal(0);
    readonly log = signal<{ id: number; value: string }[]>([]);
    private logId = 0;

    readonly voteOutputs = computed<Record<string, (event: never) => void>>(() => ({
        voted: (value: string) => this.registerVote(value),
    }));

    private readonly statValue = signal(1204);
    readonly statInputs = computed<Record<string, unknown>>(() => ({
        label: this.t().statLabel,
        value: this.statValue().toLocaleString(this.localeId()),
    }));

    readonly renderedType = signal('—');
    private statRef: ComponentRef<unknown> | null = null;

    readonly rows = signal<number[]>([1, 2, 3]);
    private nextRow = 4;
    readonly stats = signal({ created: 0, recycled: 0, pooled: 0 });

    protected swapVariant(type: Type<unknown>): 'default' | 'outline' {
        return this.swapped() === type ? 'default' : 'outline';
    }

    protected toneVariant(tone: Tone): 'default' | 'outline' {
        return this.tone() === tone ? 'default' : 'outline';
    }

    swapTo(type: Type<unknown>): void {
        this.swapped.set(type);
    }

    setTone(tone: Tone): void {
        this.tone.set(tone);
    }

    private toneLabelFor(tone: Tone): string {
        if (tone === 'success') return this.t().toneSuccess;
        if (tone === 'warning') return this.t().toneWarning;
        return this.t().toneInfo;
    }

    private registerVote(value: string): void {
        this.score.update((current) => (value === 'up' ? current + 1 : current - 1));
        this.log.update((entries) => [{ id: this.logId++, value }, ...entries].slice(0, 5));
    }

    clearLog(): void {
        this.log.set([]);
        this.score.set(0);
    }

    onStatInitialized(ref: ComponentRef<unknown>): void {
        this.statRef = ref;
        this.renderedType.set(ref.componentType.name);
    }

    boostStat(): void {
        this.statValue.update((value) => value + 137);
        this.statRef?.setInput('value', this.statValue().toLocaleString(this.localeId()));
    }

    addRow(): void {
        this.rows.update((rows) => [...rows, this.nextRow++]);
    }

    removeRow(): void {
        this.rows.update((rows) => rows.slice(0, -1));
        setTimeout(() => this.syncStats(), 0);
    }

    syncStats(): void {
        this.stats.set({
            created: this.pool.createCount,
            recycled: this.pool.recycleCount,
            pooled: this.pool.poolSize,
        });
    }
}
