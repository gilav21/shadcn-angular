import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FileViewerComponent, FileViewerToolbarDirective, FileViewerContentDirective } from './file-viewer.component';

function createTextFile(): File {
    const content = `# Sample Text File

This is a sample text file for previewing in the file viewer component.

## Features
- Line 1: Text rendering
- Line 2: Scrollable content
- Line 3: Zoom support

## Code Example
function hello() {
    console.log("Hello, World!");
}

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
`;
    return new File([content], 'readme.md', { type: 'text/plain' });
}

function createSvgFile(): File {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#grad)"/>
  <text x="100" y="110" text-anchor="middle" fill="white" font-size="24" font-family="sans-serif">SVG</text>
</svg>`;
    return new File([svg], 'sample.svg', { type: 'image/svg+xml' });
}

const meta: Meta<FileViewerComponent> = {
    title: 'UI/FileViewer',
    component: FileViewerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [FileViewerComponent, FileViewerToolbarDirective, FileViewerContentDirective],
        }),
    ],
    argTypes: {
        height: { control: 'text' },
        zoom: { control: { type: 'range', min: 0.25, max: 3, step: 0.25 } },
        filename: { control: 'text' },
    },
    args: {
        height: '500px',
        zoom: 1,
        filename: '',
    },
};

export default meta;
type Story = StoryObj<FileViewerComponent>;

export const TextFile: Story = {
    render: (args) => ({
        props: { ...args, file: createTextFile() },
        template: `<ui-file-viewer [file]="file" [height]="height" [zoom]="zoom" [filename]="filename" />`,
    }),
};

export const SvgImage: Story = {
    render: (args) => ({
        props: { ...args, file: createSvgFile() },
        template: `<ui-file-viewer [file]="file" [height]="height" [zoom]="zoom" filename="sample.svg" />`,
    }),
};

export const UnknownFile: Story = {
    render: (args) => ({
        props: {
            ...args,
            file: new File([new Uint8Array([0x00, 0x01, 0x02])], 'data.bin', { type: 'application/octet-stream' }),
        },
        template: `<ui-file-viewer [file]="file" [height]="height" filename="data.bin" />`,
    }),
};

export const ErrorState: Story = {
    render: (args) => ({
        props: {
            ...args,
            file: new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x00])], 'broken.pdf', { type: 'application/pdf' }),
        },
        template: `<ui-file-viewer [file]="file" [height]="height" type="pdf" filename="broken.pdf" />`,
    }),
};

export const CustomHeight: Story = {
    render: () => ({
        props: { file: createTextFile() },
        template: `<ui-file-viewer [file]="file" height="300px" filename="small-viewer.txt" />`,
    }),
};

export const CustomMode: Story = {
    render: () => ({
        props: { file: createTextFile() },
        template: `
            <ui-file-viewer [file]="file" height="400px">
                <ui-file-viewer-toolbar>
                    <div class="flex items-center gap-2 px-3 py-2 border-b">
                        <span class="font-bold">Custom Toolbar</span>
                        <span class="text-muted-foreground text-sm">- You can put anything here</span>
                    </div>
                </ui-file-viewer-toolbar>
                <ui-file-viewer-content />
            </ui-file-viewer>
        `,
    }),
};

export const MultipleFiles: Story = {
    render: () => ({
        props: {
            textFile: createTextFile(),
            svgFile: createSvgFile(),
        },
        template: `
            <div class="grid grid-cols-2 gap-4">
                <ui-file-viewer [file]="textFile" height="400px" filename="readme.md" />
                <ui-file-viewer [file]="svgFile" height="400px" filename="logo.svg" />
            </div>
        `,
    }),
};
