# @gilav21/shadcn-angular

An Angular port of [shadcn/ui](https://ui.shadcn.com/) - beautifully designed components that you can copy and paste into your apps.

This CLI tool helps you easily add components to your Angular project.

## Prerequisites

- Angular v17+
- Tailwind CSS installed and configured

## Installation

Run the `init` command to set up your project:

```bash
npx @gilav21/shadcn-angular init
```

This will:
1.  Configure your `tailwind.config.ts`.
2.  Add CSS variables to your global styles.
3.  Add a `cn` utility for class merging.
4.  Create a `components.json` configuration file.

### `init` Options

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip confirmation prompt |
| `-d, --defaults` | Use default configuration |
| `-b, --branch <branch>` | GitHub branch to fetch from (default: `master`) |

## Usage

Use the `add` command to add components to your project:

```bash
npx @gilav21/shadcn-angular add [component...]
```

Example:

```bash
npx @gilav21/shadcn-angular add button
```

You can add multiple components at once:

```bash
npx @gilav21/shadcn-angular add button card dialog
```

Or run without arguments to select from a list:

```bash
npx @gilav21/shadcn-angular add
```

### `add` Options

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip all prompts (no optional deps, no overwrite) |
| `-o, --overwrite` | Overwrite existing files that differ from the registry |
| `-a, --all` | Install every available component |
| `-p, --path <path>` | Custom install directory (overrides `components.json`) |
| `--remote` | Force fetch from GitHub (skip local registry) |
| `-b, --branch <branch>` | GitHub branch to fetch from (default: `master`) |

## Optional Dependencies

Some components offer companion components that enhance their functionality. When you add such a component, the CLI will prompt you to optionally install them.

For example, `data-table` offers `context-menu` for right-click menus on rows and headers. `tree` also offers `context-menu` for right-click menus on tree nodes.

Behavior with flags:
- **Interactive (default)** — you pick which optional companions to include
- **`--yes`** — skips optional dependencies entirely (useful in CI)
- **`--all`** — automatically includes all optional dependencies

## Available Components

### UI Components

- Accordion
- Alert
- Alert Dialog
- Aspect Ratio
- Autocomplete
- Avatar
- Badge
- Breadcrumb
- Button
- Button Group
- Calendar
- Card
- Carousel
- Chat
- Checkbox
- Chip List
- Code Block
- Collapsible
- Color Picker
- Command
- Confetti
- Context Menu
- Data Table
- Date Picker
- Dialog
- Dock
- Drawer
- Dropdown Menu
- Emoji Picker
- Empty State
- Field
- File Upload
- File Viewer
- Hover Card
- Icon
- Input
- Input Group
- Input Mask
- Input OTP
- Kbd (Keyboard Key)
- Label
- Menubar
- Native Select
- Navigation Menu
- Pagination
- Popover
- Progress
- Radio Group
- Rating
- Resizable
- Rich Text Editor
- Scroll Area
- Select
- Separator
- Sheet
- Sidebar
- Skeleton
- Slider
- Speed Dial
- Spinner
- Split Button
- Stepper
- Streaming Text
- Switch
- Table
- Tabs
- Textarea
- Timeline
- Toast
- Toggle
- Toggle Group
- Tooltip
- Tree
- Tree Select
- Virtual Scroll

### Chart Components

- Bar Chart
- Bar Chart Drilldown
- Bar Race Chart
- Column Range Chart
- Org Chart
- Pie Chart
- Pie Chart Drilldown
- Stacked Bar Chart

### Layout & Page Building

- Bento Grid
- Page Builder

### Animation Components

- Blur Fade
- Flip Text
- Gradient Text
- Magnetic
- Marquee
- Meteors
- Morphing Text
- Number Ticker
- Orbit
- Particles
- Ripple
- Scroll Progress
- Shine Border
- Sparkles
- Stagger Children
- Text Reveal
- Typing Animation
- Wobble Card
- Word Rotate

### Kanban

- Kanban

## Documentation

For full documentation and examples, verify usage in your local development environment or check the original [shadcn/ui documentation](https://ui.shadcn.com/docs).
