# shadcn-angular

Beautifully designed components built with Angular and Tailwind CSS.
This is an unofficial community-led port of [shadcn/ui](https://ui.shadcn.com/) for Angular.

[**Storybook**](https://shadcn-angular-storybook.netlify.app/) | [**Demo**](https://shadcn-angular-demo.netlify.app/)

> **NOTE:** This library is a collection of re-usable components that you can copy and paste into your apps.

> **VERSION:** Currently built using **Angular 20**. Further versions have not been tested yet.

## Features

- **Customizable**: Built with Tailwind CSS.
- **Accessible**: Uses standard HTML elements and accessibility best practices.
- **Lightweight**: Copy/paste components give you full control over the code.
- **Dark Mode**: Built-in dark mode support.
- **Rich Text Editor**: Includes a full-featured rich text editor component.

## Quick Start

The easiest way to get started is by using our CLI tool.

```bash
# Initialize the project
npx @gilav21/shadcn-angular init

# Add a component
npx @gilav21/shadcn-angular add button
```

## Local Development

If you want to contribute or experiment with the components locally:

1.  **Clone the repository**
    ```bash
    git clone https://github.com/gilav21/shadcn-angular.git
    cd shadcn-angular
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the demo application**
    The `demo` folder contains a documentation site/showcase of all components.
    ```bash
    npm run dev
    ```
    Access the demo at `http://localhost:4200`.

## Project Structure

- `packages/cli`: Source code for the `@gilav21/shadcn-angular` CLI tool.
- `packages/components`: The "source of truth" for all components (template files used by the CLI).
- `demo`: An Angular application showcasing usages of all components.

## License

MIT
