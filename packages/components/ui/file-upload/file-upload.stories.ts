import { Meta, StoryObj } from '@storybook/angular';
import { FileUploadComponent } from './file-upload.component';
import { FILE_UPLOAD_LOCALES } from './file-upload.locales';

const meta: Meta<FileUploadComponent> = {
    title: 'UI/FileUpload',
    component: FileUploadComponent,
    tags: ['autodocs'],
    argTypes: {
        accept: { control: 'text', description: 'Comma-separated list of accepted MIME types / extensions (e.g. "image/*,.pdf").' },
        multiple: { control: 'boolean', description: 'Allows selecting/dropping more than one file.' },
        maxFiles: { control: 'number', description: 'Maximum number of files accepted. Null for unlimited.' },
        maxSize: { control: 'number', description: 'Maximum file size in bytes. Null for unlimited.' },
        disabled: { control: 'boolean', description: 'Disables the dropzone and file picker.' },
        locale: {
            control: 'select',
            options: Object.keys(FILE_UPLOAD_LOCALES),
            description: 'Locale dictionary key. Falls back to UI_LOCALE_ID when not set.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        accept: '',
        multiple: true,
        maxFiles: null,
        maxSize: null,
        disabled: false,
        locale: undefined,
        class: '',
    },
};

export default meta;
type Story = StoryObj<FileUploadComponent>;

const TEMPLATE = `
    <div class="max-w-md">
        <ui-file-upload
            [accept]="accept" [multiple]="multiple" [maxFiles]="maxFiles"
            [maxSize]="maxSize" [disabled]="disabled" [locale]="locale" [class]="class"
        />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    render,
};

export const ImagesOnly: Story = {
    args: { accept: 'image/*' },
    render,
};

export const SingleFile: Story = {
    args: { multiple: false },
    render,
};

export const WithLimits: Story = {
    render: () => ({
        template: `
            <div class="max-w-md space-y-2">
                <p class="text-sm text-muted-foreground">Max 3 files, 1MB each</p>
                <ui-file-upload
                    [multiple]="true"
                    [maxFiles]="3"
                    [maxSize]="1048576"
                />
            </div>
        `,
    }),
};

export const DocumentsOnly: Story = {
    args: { accept: '.pdf,.doc,.docx' },
    render,
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const RTL: Story = {
    args: { locale: 'he' },
    render: (args) => ({
        props: args,
        template: `
            <div dir="rtl" class="max-w-md">
                <ui-file-upload
                    [accept]="accept" [multiple]="multiple" [maxFiles]="maxFiles"
                    [maxSize]="maxSize" [disabled]="disabled" [locale]="locale" [class]="class"
                />
            </div>
        `,
    }),
};

export const LocalizedArabic: Story = {
    args: { locale: 'ar' },
    render: (args) => ({
        props: args,
        template: `
            <div dir="rtl" class="max-w-md">
                <ui-file-upload
                    [accept]="accept" [multiple]="multiple" [maxFiles]="maxFiles"
                    [maxSize]="maxSize" [disabled]="disabled" [locale]="locale" [class]="class"
                />
            </div>
        `,
    }),
};

export const DirectoryDrop: Story = {
    name: 'Directory drop (recursive)',
    render: () => ({
        template: `
            <div class="w-full max-w-md space-y-2">
                <p class="text-sm text-muted-foreground">
                    With <code>allowDirectories</code>, dropping a FOLDER enumerates its files
                    recursively and the picker switches to folder-selection mode. Every enumerated
                    file is still validated against accept / maxSize / maxFiles.
                </p>
                <ui-file-upload [allowDirectories]="true" />
            </div>
        `,
    }),
};

export const InlineCrop: Story = {
    name: 'Inline crop (square avatar)',
    render: () => ({
        template: `
            <div class="w-full max-w-md space-y-2">
                <p class="text-sm text-muted-foreground">
                    With <code>cropImages</code>, an image is held back and the crop panel opens
                    before it enters the queue. <code>cropAspect="1"</code> locks it square. Drag the
                    box or use the arrow keys; <code>+</code> / <code>-</code> resize. Non-images
                    bypass the step entirely.
                </p>
                <ui-file-upload accept="image/*,.pdf" [cropImages]="true" [cropAspect]="1" />
            </div>
        `,
    }),
};
