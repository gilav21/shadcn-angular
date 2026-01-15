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

## Usage

Use the `add` command to add components to your project:

```bash
npx @gilav21/shadcn-angular add [component]
```

Example:

```bash
npx @gilav21/shadcn-angular add button
```

You can also run the command without arguments to select from a list:

```bash
npx @gilav21/shadcn-angular add
```

## Available Components

- Accordion
- Alert
- Alert Dialog
- Aspect Ratio
- Avatar
- Badge
- Breadcrumb
- Button
- Button Group
- Calendar
- Card
- Carousel
- Checkbox
- Chip List
- Collapsible
- Command
- Context Menu
- Date Picker
- Dialog
- Drawer
- Dropdown Menu
- Emoji Picker
- Empty State
- Field
- Hover Card
- Input
- Input Group
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
- Switch
- Table
- Tabs
- Textarea
- Toast
- Toggle
- Toggle Group
- Tooltip

## Documentation

For full documentation and examples, verify usage in your local development environment or check the original [shadcn/ui documentation](https://ui.shadcn.com/docs).
