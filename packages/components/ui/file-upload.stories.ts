import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FileUploadComponent } from './file-upload.component';

const meta: Meta<FileUploadComponent> = {
    title: 'UI/FileUpload',
    component: FileUploadComponent,
    decorators: [
        moduleMetadata({
            imports: [],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        accept: { control: 'text' },
        multiple: { control: 'boolean' },
        maxFiles: { control: 'number' },
        maxSize: { control: 'number' },
        disabled: { control: 'boolean' },
    },
    args: {
        accept: '',
        multiple: true,
        maxFiles: null,
        maxSize: null,
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<FileUploadComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="max-w-md">
                <ui-file-upload
                    [accept]="accept"
                    [multiple]="multiple"
                    [maxFiles]="maxFiles"
                    [maxSize]="maxSize"
                    [disabled]="disabled"
                />
            </div>
        `,
    }),
};

export const ImagesOnly: Story = {
    render: () => ({
        template: `
            <div class="max-w-md">
                <ui-file-upload
                    accept="image/*"
                    [multiple]="true"
                />
            </div>
        `,
    }),
};

export const SingleFile: Story = {
    render: () => ({
        template: `
            <div class="max-w-md">
                <ui-file-upload
                    [multiple]="false"
                />
            </div>
        `,
    }),
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
    render: () => ({
        template: `
            <div class="max-w-md space-y-2">
                <p class="text-sm text-muted-foreground">PDF and Word documents only</p>
                <ui-file-upload
                    accept=".pdf,.doc,.docx"
                    [multiple]="true"
                />
            </div>
        `,
    }),
};

export const Disabled: Story = {
    render: () => ({
        template: `
            <div class="max-w-md">
                <ui-file-upload [disabled]="true" />
            </div>
        `,
    }),
};

export const RTL: Story = {
    render: () => ({
        template: `
            <div dir="rtl" class="max-w-md">
                <ui-file-upload
                    [multiple]="true"
                />
            </div>
        `,
    }),
};
