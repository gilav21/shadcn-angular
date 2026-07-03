import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import { AvatarComponent, BadgeComponent } from '../../../../../packages/components/ui';
import {
    ACTION_PARAMS,
    type ActionParams,
    type RichTextActionParamsContext,
    type RichTextActionParamsForm,
} from '../../../../../packages/components/ui/rich-text-editor/addons/actions';

/** A teammate the tier-2 "profile" action can point at. */
export interface DemoUser {
    id: string;
    name: string;
    role: string;
    initials: string;
}

export const DEMO_USERS: DemoUser[] = [
    { id: 'ada', name: 'Ada Lovelace', role: 'Principal Engineer', initials: 'AL' },
    { id: 'grace', name: 'Grace Hopper', role: 'Compiler Lead', initials: 'GH' },
    { id: 'alan', name: 'Alan Turing', role: 'Research', initials: 'AT' },
];

/** Glossary definitions the hover "glossary" action looks up by term. */
export const DEMO_GLOSSARY: Record<string, string> = {
    idempotent: 'An operation that produces the same result no matter how many times it runs.',
    serialization: 'Turning an in-memory value into a string or bytes that can be stored or sent.',
    'top layer': 'The browser layer that renders above everything else — used by the native Popover API.',
};

/** Products the click "quick-view" action opens. */
export interface DemoProduct {
    sku: string;
    name: string;
    price: string;
    blurb: string;
}

export const DEMO_PRODUCTS: Record<string, DemoProduct> = {
    'kbd-01': { sku: 'kbd-01', name: 'Aurora Keyboard', price: '$149', blurb: 'Low-profile, hot-swappable, backlit.' },
    'mou-02': { sku: 'mou-02', name: 'Glide Mouse', price: '$79', blurb: 'Feather-light with a silent scroll.' },
};

/** Pricing plans the custom-component dialog preset renders. */
export const DEMO_PLANS: Record<string, { name: string; price: string; perks: string[] }> = {
    starter: { name: 'Starter', price: '$0', perks: ['1 project', 'Community support'] },
    pro: { name: 'Pro', price: '$9/mo', perks: ['Unlimited projects', 'Email support', 'Analytics'] },
    team: { name: 'Team', price: '$29/mo', perks: ['Everything in Pro', 'SSO', 'Priority support'] },
};

/**
 * Tier-2 custom form component: a teammate picker with a live avatar preview.
 * Implements the addon's `RichTextActionParamsForm` contract — the addon renders
 * it inside its attach dialog and reads `params`/`valid` on Apply.
 */
@Component({
    selector: 'app-demo-entity-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AvatarComponent],
    template: `
        <label class="mb-1 block text-sm font-medium" for="demo-entity-select">Link to teammate</label>
        <select
            id="demo-entity-select"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm"
            [value]="selectedId()" (change)="pick($any($event.target).value)"
        >
            <option value="" disabled>Choose a person…</option>
            @for (u of users; track u.id) {
                <option [value]="u.id">{{ u.name }}</option>
            }
        </select>
        @if (current(); as u) {
            <div class="mt-3 flex items-center gap-3 rounded-md border bg-muted/40 p-2">
                <ui-avatar [fallback]="u.initials" class="size-9" />
                <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ u.name }}</p>
                    <p class="truncate text-xs text-muted-foreground">{{ u.role }}</p>
                </div>
            </div>
        }
    `,
})
export class DemoEntityFormComponent implements RichTextActionParamsForm {
    context!: RichTextActionParamsContext;
    readonly params: WritableSignal<ActionParams> = signal<ActionParams>({});
    readonly valid: Signal<boolean> = computed(() => Boolean(this.params()['userId']));

    protected readonly users = DEMO_USERS;
    protected readonly selectedId = computed(() => String(this.params()['userId'] ?? ''));
    protected readonly current = computed(() => this.users.find((u) => u.id === this.selectedId()) ?? null);

    protected pick(id: string): void {
        const user = this.users.find((u) => u.id === id);
        this.params.set({ userId: id, userName: user?.name ?? '' });
    }
}

/**
 * A developer-owned component rendered *inside* the open-dialog preset. The
 * preset provides the action's params through the `ACTION_PARAMS` token, so the
 * component decides what to show — here, a mini pricing card.
 */
@Component({
    selector: 'app-demo-pricing',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent],
    template: `
        <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
                <p class="text-base font-semibold">{{ plan.name }}</p>
                <ui-badge>{{ plan.price }}</ui-badge>
            </div>
            <ul class="space-y-1 text-sm text-muted-foreground">
                @for (perk of plan.perks; track perk) {
                    <li class="flex items-center gap-2">
                        <span class="inline-block size-1.5 rounded-full bg-primary"></span>{{ perk }}
                    </li>
                }
            </ul>
        </div>
    `,
})
export class DemoPricingComponent {
    private readonly actionParams = inject(ACTION_PARAMS);
    protected readonly plan =
        DEMO_PLANS[String(this.actionParams['plan'] ?? 'pro')] ?? DEMO_PLANS['pro'];
}
