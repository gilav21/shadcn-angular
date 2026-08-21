import { Meta, StoryObj } from '@storybook/angular';
import {
  CommandComponent,
  CommandInputComponent,
  CommandListComponent,
  CommandEmptyComponent,
  CommandGroupComponent,
  CommandItemComponent,
  CommandSeparatorComponent,
  CommandShortcutComponent,
  CommandDialogComponent,
} from '../command';
import type { CommandSource } from './command.types';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from '../button';
import { DialogComponent, DialogContentComponent } from '../dialog';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<CommandComponent & { rtl: boolean }> = {
  title: 'UI/Command',
  component: CommandComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        CommandComponent,
        CommandInputComponent,
        CommandListComponent,
        CommandEmptyComponent,
        CommandGroupComponent,
        CommandItemComponent,
        CommandSeparatorComponent,
        CommandShortcutComponent,
        CommandDialogComponent,
        ButtonComponent,
        DialogComponent,
        DialogContentComponent
      ],
    }),
  ],
  argTypes: {
    shouldFilter: { control: 'boolean', description: 'Whether typing in the input filters items/groups. Disable to implement custom (e.g. async) filtering.' },
    search: { control: 'text', description: 'Externally-controlled search text. When set, drives the filter instead of the input\'s own typed value.' },
    class: { control: 'text', description: 'Extra classes merged onto the command root.' },
    rtl: { control: 'boolean', description: 'Story-only toggle: renders the demo with `dir="rtl"`.' },
  },
  args: {
    shouldFilter: true,
    search: null,
    class: 'rounded-lg border shadow-md',
    rtl: false,
  },
};

export default meta;
type Story = StoryObj<CommandComponent & { rtl: boolean }>;

const TEMPLATE = `
      <div class="w-full max-w-[calc(100vw-2rem)] sm:w-[450px] rounded-lg border shadow-md" [attr.dir]="rtl ? 'rtl' : 'ltr'">
        <ui-command [class]="class" [shouldFilter]="shouldFilter" [search]="search">
          <ui-command-input placeholder="Type a command or search..." ariaLabel="Search command" />
          <ui-command-list ariaLabel="Results">
            <ui-command-empty>No results found.</ui-command-empty>
            <ui-command-group heading="Suggestions">
              <ui-command-item value="calendar">
                <svg class="h-4 w-4 ltr:mr-2 rtl:ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>Calendar</span>
              </ui-command-item>
              <ui-command-item value="search-emoji">
                <svg class="h-4 w-4 ltr:mr-2 rtl:ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                <span>Search Emoji</span>
              </ui-command-item>
              <ui-command-item value="calculator">
                <svg class="h-4 w-4 ltr:mr-2 rtl:ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M16 10h.01"></path><path d="M12 10h.01"></path><path d="M8 10h.01"></path><path d="M12 14h.01"></path><path d="M8 14h.01"></path><path d="M12 18h.01"></path><path d="M8 18h.01"></path></svg>
                <span>Calculator</span>
              </ui-command-item>
            </ui-command-group>
            <ui-command-separator />
            <ui-command-group heading="Settings">
              <ui-command-item value="profile">
                <svg class="h-4 w-4 ltr:mr-2 rtl:ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>Profile</span>
                <ui-command-shortcut>⌘P</ui-command-shortcut>
              </ui-command-item>
              <ui-command-item value="billing">
                <svg class="h-4 w-4 ltr:mr-2 rtl:ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                <span>Billing</span>
                <ui-command-shortcut>⌘B</ui-command-shortcut>
              </ui-command-item>
              <ui-command-item value="settings">
                <svg class="h-4 w-4 ltr:mr-2 rtl:ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                <span>Settings</span>
                <ui-command-shortcut>⌘S</ui-command-shortcut>
              </ui-command-item>
            </ui-command-group>
          </ui-command-list>
        </ui-command>
      </div>
    `;

const render: NonNullable<Story['render']> = (args) => ({
  props: args,
  template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const NoFilter: Story = {
  args: { shouldFilter: false },
  render,
};

export const RightToLeft: Story = {
  args: { rtl: true },
  render,
};

export const Dialog: Story = {
  render: () => ({
    props: { open: false },
    template: `
      <ui-button (click)="open = true">Open Command Dialog (⌘K)</ui-button>
      <ui-command-dialog [(open)]="open">
        <ui-command-input placeholder="Type a command or search..." ariaLabel="Search command" />
        <ui-command-list ariaLabel="Results">
          <ui-command-empty>No results found.</ui-command-empty>
          <ui-command-group heading="Suggestions">
            <ui-command-item value="calendar"><span>Calendar</span></ui-command-item>
            <ui-command-item value="search-emoji"><span>Search Emoji</span></ui-command-item>
            <ui-command-item value="calculator"><span>Calculator</span></ui-command-item>
          </ui-command-group>
        </ui-command-list>
      </ui-command-dialog>
    `,
  }),
};

const PEOPLE = [
  'Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson',
  'Barbara Liskov', 'Donald Knuth', 'Margaret Hamilton', 'Edsger Dijkstra',
];

/** Stands in for a server: 400ms of latency, filtered server-side. */
const remoteSearch: CommandSource = (query) =>
  new Promise(resolve =>
    setTimeout(() => {
      const q = query.trim().toLowerCase();
      const rows = PEOPLE
        .filter(name => !q || name.toLowerCase().includes(q))
        .map(name => ({ id: name, value: name }));
      resolve(rows);
    }, 400),
  );

export const AsyncSource: Story = {
  name: 'Async source (debounced, race-safe)',
  render: () => ({
    props: { source: remoteSearch },
    template: `
      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">
          Type fast: calls are debounced, and any answer a newer keystroke has superseded is
          discarded and its AbortSignal fired — results can never go backwards.
        </p>
        <ui-command [source]="source" [shouldFilter]="false" class="border rounded-lg" #cmd>
          <ui-command-input placeholder="Search people…" />
          <ui-command-list ariaLabel="Results">
            @if (cmd.isLoading()) {
              <div class="py-6 text-center text-sm text-muted-foreground">Searching…</div>
            } @else if (cmd.results().length === 0) {
              <ui-command-empty>No results.</ui-command-empty>
            } @else {
              <ui-command-group heading="People">
                @for (row of cmd.results(); track row.id) {
                  <ui-command-item [value]="row.value">{{ row.label ?? row.value }}</ui-command-item>
                }
              </ui-command-group>
            }
          </ui-command-list>
        </ui-command>
      </div>
    `,
  }),
};

export const RecentItems: Story = {
  name: 'Recent items on an empty query',
  render: () => ({
    template: `
      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">
          Pick an item, then clear the query — recents surface, newest first, persisted under
          <code>recentKey</code>.
        </p>
        <ui-command recentKey="storybook-palette" [recentLimit]="3" class="border rounded-lg" #cmd>
          <ui-command-input placeholder="Type a command…" />
          <ui-command-list ariaLabel="Results">
            @if (cmd.showRecents()) {
              <ui-command-group heading="Recent">
                @for (value of cmd.recents(); track value) {
                  <ui-command-item [value]="value">{{ value }}</ui-command-item>
                }
              </ui-command-group>
              <ui-command-separator />
            }
            <ui-command-group heading="All commands">
              <ui-command-item value="New file">New file</ui-command-item>
              <ui-command-item value="Open folder">Open folder</ui-command-item>
              <ui-command-item value="Save all">Save all</ui-command-item>
              <ui-command-item value="Toggle theme">Toggle theme</ui-command-item>
            </ui-command-group>
          </ui-command-list>
        </ui-command>
      </div>
    `,
  }),
};

export const NestedPages: Story = {
  name: 'Nested pages (Escape goes back)',
  render: () => ({
    template: `
      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">
          Pick "Change theme…" to drill in. Escape — or Backspace on an empty query — returns to the
          parent instead of closing the palette.
        </p>
        <ui-command class="border rounded-lg" #cmd>
          <ui-command-input placeholder="Type a command…" />
          <ui-command-list ariaLabel="Results">
            @if (cmd.page()?.id === 'themes') {
              <ui-command-group [heading]="cmd.page()?.label ?? 'Themes'">
                <ui-command-item value="Light">Light</ui-command-item>
                <ui-command-item value="Dark">Dark</ui-command-item>
                <ui-command-item value="System">System</ui-command-item>
              </ui-command-group>
            } @else {
              <ui-command-group heading="Commands">
                <ui-command-item
                  value="Change theme"
                  (selectItem)="cmd.pushPage({ id: 'themes', label: 'Themes' })"
                >Change theme…</ui-command-item>
                <ui-command-item value="New file">New file</ui-command-item>
                <ui-command-item value="Save all">Save all</ui-command-item>
              </ui-command-group>
            }
          </ui-command-list>
        </ui-command>
      </div>
    `,
  }),
};
