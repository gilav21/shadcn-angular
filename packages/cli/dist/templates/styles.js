const baseColors = {
    neutral: {
        light: {
            '--background': 'oklch(1 0 0)',
            '--foreground': 'oklch(0.145 0 0)',
            '--card': 'oklch(1 0 0)',
            '--card-foreground': 'oklch(0.145 0 0)',
            '--popover': 'oklch(1 0 0)',
            '--popover-foreground': 'oklch(0.145 0 0)',
            '--primary': 'oklch(0.205 0 0)',
            '--primary-foreground': 'oklch(0.985 0 0)',
            '--secondary': 'oklch(0.97 0 0)',
            '--secondary-foreground': 'oklch(0.205 0 0)',
            '--muted': 'oklch(0.97 0 0)',
            '--muted-foreground': 'oklch(0.556 0 0)',
            '--accent': 'oklch(0.97 0 0)',
            '--accent-foreground': 'oklch(0.205 0 0)',
            '--destructive': 'oklch(0.577 0.245 27.325)',
            '--border': 'oklch(0.922 0 0)',
            '--input': 'oklch(0.922 0 0)',
            '--ring': 'oklch(0.708 0 0)',
        },
        dark: {
            '--background': 'oklch(0.145 0 0)',
            '--foreground': 'oklch(0.985 0 0)',
            '--card': 'oklch(0.205 0 0)',
            '--card-foreground': 'oklch(0.985 0 0)',
            '--popover': 'oklch(0.269 0 0)',
            '--popover-foreground': 'oklch(0.985 0 0)',
            '--primary': 'oklch(0.922 0 0)',
            '--primary-foreground': 'oklch(0.205 0 0)',
            '--secondary': 'oklch(0.269 0 0)',
            '--secondary-foreground': 'oklch(0.985 0 0)',
            '--muted': 'oklch(0.269 0 0)',
            '--muted-foreground': 'oklch(0.708 0 0)',
            '--accent': 'oklch(0.371 0 0)',
            '--accent-foreground': 'oklch(0.985 0 0)',
            '--destructive': 'oklch(0.704 0.191 22.216)',
            '--border': 'oklch(1 0 0 / 10%)',
            '--input': 'oklch(1 0 0 / 15%)',
            '--ring': 'oklch(0.556 0 0)',
        },
    },
    slate: {
        light: {
            '--background': 'oklch(1 0 0)',
            '--foreground': 'oklch(0.129 0.042 264.695)',
            '--card': 'oklch(1 0 0)',
            '--card-foreground': 'oklch(0.129 0.042 264.695)',
            '--popover': 'oklch(1 0 0)',
            '--popover-foreground': 'oklch(0.129 0.042 264.695)',
            '--primary': 'oklch(0.208 0.042 265.755)',
            '--primary-foreground': 'oklch(0.984 0.003 247.858)',
            '--secondary': 'oklch(0.968 0.007 247.896)',
            '--secondary-foreground': 'oklch(0.208 0.042 265.755)',
            '--muted': 'oklch(0.968 0.007 247.896)',
            '--muted-foreground': 'oklch(0.554 0.046 257.417)',
            '--accent': 'oklch(0.968 0.007 247.896)',
            '--accent-foreground': 'oklch(0.208 0.042 265.755)',
            '--destructive': 'oklch(0.577 0.245 27.325)',
            '--border': 'oklch(0.929 0.013 255.508)',
            '--input': 'oklch(0.929 0.013 255.508)',
            '--ring': 'oklch(0.704 0.04 256.788)',
        },
        dark: {
            '--background': 'oklch(0.129 0.042 264.695)',
            '--foreground': 'oklch(0.984 0.003 247.858)',
            '--card': 'oklch(0.208 0.042 265.755)',
            '--card-foreground': 'oklch(0.984 0.003 247.858)',
            '--popover': 'oklch(0.269 0.04 260.031)',
            '--popover-foreground': 'oklch(0.984 0.003 247.858)',
            '--primary': 'oklch(0.929 0.013 255.508)',
            '--primary-foreground': 'oklch(0.208 0.042 265.755)',
            '--secondary': 'oklch(0.269 0.04 260.031)',
            '--secondary-foreground': 'oklch(0.984 0.003 247.858)',
            '--muted': 'oklch(0.269 0.04 260.031)',
            '--muted-foreground': 'oklch(0.704 0.04 256.788)',
            '--accent': 'oklch(0.372 0.044 257.287)',
            '--accent-foreground': 'oklch(0.984 0.003 247.858)',
            '--destructive': 'oklch(0.704 0.191 22.216)',
            '--border': 'oklch(1 0 0 / 10%)',
            '--input': 'oklch(1 0 0 / 15%)',
            '--ring': 'oklch(0.554 0.046 257.417)',
        },
    },
    stone: {
        light: {
            '--background': 'oklch(1 0 0)',
            '--foreground': 'oklch(0.147 0.004 49.25)',
            '--card': 'oklch(1 0 0)',
            '--card-foreground': 'oklch(0.147 0.004 49.25)',
            '--popover': 'oklch(1 0 0)',
            '--popover-foreground': 'oklch(0.147 0.004 49.25)',
            '--primary': 'oklch(0.216 0.006 56.043)',
            '--primary-foreground': 'oklch(0.985 0.001 106.423)',
            '--secondary': 'oklch(0.97 0.001 106.424)',
            '--secondary-foreground': 'oklch(0.216 0.006 56.043)',
            '--muted': 'oklch(0.97 0.001 106.424)',
            '--muted-foreground': 'oklch(0.553 0.013 58.071)',
            '--accent': 'oklch(0.97 0.001 106.424)',
            '--accent-foreground': 'oklch(0.216 0.006 56.043)',
            '--destructive': 'oklch(0.577 0.245 27.325)',
            '--border': 'oklch(0.923 0.003 48.717)',
            '--input': 'oklch(0.923 0.003 48.717)',
            '--ring': 'oklch(0.709 0.01 56.259)',
        },
        dark: {
            '--background': 'oklch(0.147 0.004 49.25)',
            '--foreground': 'oklch(0.985 0.001 106.423)',
            '--card': 'oklch(0.216 0.006 56.043)',
            '--card-foreground': 'oklch(0.985 0.001 106.423)',
            '--popover': 'oklch(0.268 0.007 34.298)',
            '--popover-foreground': 'oklch(0.985 0.001 106.423)',
            '--primary': 'oklch(0.923 0.003 48.717)',
            '--primary-foreground': 'oklch(0.216 0.006 56.043)',
            '--secondary': 'oklch(0.268 0.007 34.298)',
            '--secondary-foreground': 'oklch(0.985 0.001 106.423)',
            '--muted': 'oklch(0.268 0.007 34.298)',
            '--muted-foreground': 'oklch(0.709 0.01 56.259)',
            '--accent': 'oklch(0.374 0.01 67.558)',
            '--accent-foreground': 'oklch(0.985 0.001 106.423)',
            '--destructive': 'oklch(0.704 0.191 22.216)',
            '--border': 'oklch(1 0 0 / 10%)',
            '--input': 'oklch(1 0 0 / 15%)',
            '--ring': 'oklch(0.553 0.013 58.071)',
        },
    },
    gray: {
        light: {
            '--background': 'oklch(1 0 0)',
            '--foreground': 'oklch(0.13 0.028 261.692)',
            '--card': 'oklch(1 0 0)',
            '--card-foreground': 'oklch(0.13 0.028 261.692)',
            '--popover': 'oklch(1 0 0)',
            '--popover-foreground': 'oklch(0.13 0.028 261.692)',
            '--primary': 'oklch(0.21 0.028 264.532)',
            '--primary-foreground': 'oklch(0.985 0.002 247.839)',
            '--secondary': 'oklch(0.967 0.003 264.542)',
            '--secondary-foreground': 'oklch(0.21 0.028 264.532)',
            '--muted': 'oklch(0.967 0.003 264.542)',
            '--muted-foreground': 'oklch(0.551 0.027 264.364)',
            '--accent': 'oklch(0.967 0.003 264.542)',
            '--accent-foreground': 'oklch(0.21 0.028 264.532)',
            '--destructive': 'oklch(0.577 0.245 27.325)',
            '--border': 'oklch(0.928 0.006 264.531)',
            '--input': 'oklch(0.928 0.006 264.531)',
            '--ring': 'oklch(0.707 0.022 264.436)',
        },
        dark: {
            '--background': 'oklch(0.13 0.028 261.692)',
            '--foreground': 'oklch(0.985 0.002 247.839)',
            '--card': 'oklch(0.21 0.028 264.532)',
            '--card-foreground': 'oklch(0.985 0.002 247.839)',
            '--popover': 'oklch(0.274 0.029 256.848)',
            '--popover-foreground': 'oklch(0.985 0.002 247.839)',
            '--primary': 'oklch(0.928 0.006 264.531)',
            '--primary-foreground': 'oklch(0.21 0.028 264.532)',
            '--secondary': 'oklch(0.274 0.029 256.848)',
            '--secondary-foreground': 'oklch(0.985 0.002 247.839)',
            '--muted': 'oklch(0.274 0.029 256.848)',
            '--muted-foreground': 'oklch(0.707 0.022 264.436)',
            '--accent': 'oklch(0.37 0.029 259.733)',
            '--accent-foreground': 'oklch(0.985 0.002 247.839)',
            '--destructive': 'oklch(0.704 0.191 22.216)',
            '--border': 'oklch(1 0 0 / 10%)',
            '--input': 'oklch(1 0 0 / 15%)',
            '--ring': 'oklch(0.551 0.027 264.364)',
        },
    },
    zinc: {
        light: {
            '--background': 'oklch(1 0 0)',
            '--foreground': 'oklch(0.141 0.005 285.823)',
            '--card': 'oklch(1 0 0)',
            '--card-foreground': 'oklch(0.141 0.005 285.823)',
            '--popover': 'oklch(1 0 0)',
            '--popover-foreground': 'oklch(0.141 0.005 285.823)',
            '--primary': 'oklch(0.21 0.006 285.885)',
            '--primary-foreground': 'oklch(0.985 0 0)',
            '--secondary': 'oklch(0.967 0.001 286.375)',
            '--secondary-foreground': 'oklch(0.21 0.006 285.885)',
            '--muted': 'oklch(0.967 0.001 286.375)',
            '--muted-foreground': 'oklch(0.552 0.016 285.938)',
            '--accent': 'oklch(0.967 0.001 286.375)',
            '--accent-foreground': 'oklch(0.21 0.006 285.885)',
            '--destructive': 'oklch(0.577 0.245 27.325)',
            '--border': 'oklch(0.92 0.004 286.32)',
            '--input': 'oklch(0.92 0.004 286.32)',
            '--ring': 'oklch(0.705 0.015 286.067)',
        },
        dark: {
            '--background': 'oklch(0.141 0.005 285.823)',
            '--foreground': 'oklch(0.985 0 0)',
            '--card': 'oklch(0.21 0.006 285.885)',
            '--card-foreground': 'oklch(0.985 0 0)',
            '--popover': 'oklch(0.274 0.006 286.033)',
            '--popover-foreground': 'oklch(0.985 0 0)',
            '--primary': 'oklch(0.92 0.004 286.32)',
            '--primary-foreground': 'oklch(0.21 0.006 285.885)',
            '--secondary': 'oklch(0.274 0.006 286.033)',
            '--secondary-foreground': 'oklch(0.985 0 0)',
            '--muted': 'oklch(0.274 0.006 286.033)',
            '--muted-foreground': 'oklch(0.705 0.015 286.067)',
            '--accent': 'oklch(0.37 0.013 285.805)',
            '--accent-foreground': 'oklch(0.985 0 0)',
            '--destructive': 'oklch(0.704 0.191 22.216)',
            '--border': 'oklch(1 0 0 / 10%)',
            '--input': 'oklch(1 0 0 / 15%)',
            '--ring': 'oklch(0.552 0.016 285.938)',
        },
    },
};
function generateCssVars(vars, indent = '  ') {
    return Object.entries(vars)
        .map(([key, value]) => `${indent}${key}: ${value};`)
        .join('\n');
}
export function getStylesTemplate(baseColor = 'neutral') {
    const colors = baseColors[baseColor];
    return `@import "tailwindcss";

/* Tell Tailwind v4 where to scan for classes */
@source "../src/**/*.ts";
@source "../src/**/*.html";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
${generateCssVars(colors.light)}
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
${generateCssVars(colors.dark)}
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.439 0 0);
}

@theme inline {
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
}

@layer base {
  * {
    border-color: var(--border);
    outline-color: color-mix(in oklch, var(--ring) 50%, transparent);
  }
  body {
    font-family: var(--font-sans);
    background-color: var(--background);
    color: var(--foreground);
  }
  html {
    font-family: var(--font-sans);
  }
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}
`;
}
