import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextImagesDirective } from './rich-text-images.directive';

const SAMPLE_UPLOAD = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/1200px-Cat_November_2010-1a.jpg';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Images',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextImagesDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in images addon: `apply rich-text-editor/images`, then add `uiRteImages` to the editor ' +
                    'element. Owns the whole image feature — the toolbar image button + insert popover, image paste ' +
                    'and drag-and-drop, the upload pipeline (`uiRteImagesUploader` + `uiRteImagesAutoUpload`), and the ' +
                    'resize/align overlay on a selected image. The base editor keeps only content-level image support ' +
                    '(the sanitizer allows `<img>` and markdown serializes images); every image control is opt-in.',
            },
        },
    },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteImages
                placeholder="Use the image button, or paste / drag an image in…"
                minHeight="180px"
            />
        `,
    }),
};

export const MinimalToolbarWithImages: Story = {
    render: () => ({
        props: {
            items: ['bold', 'italic', 'separator'],
        },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteImages
                [toolbarItems]="items"
                placeholder="The image button renders after the built-in items…"
                minHeight="180px"
            />
        `,
    }),
};

export const AutoUpload: Story = {
    render: () => ({
        props: {
            uploader: (_file: File) => of(SAMPLE_UPLOAD).pipe(delay(1500)),
        },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteImages
                [uiRteImagesAutoUpload]="true"
                [uiRteImagesUploader]="uploader"
                placeholder="Paste or drag an image to watch it auto-upload…"
                minHeight="200px"
            />
        `,
    }),
};

export const InsertControls: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteImages
                [uiRteImagesDefaultWidth]="240"
                uiRteImagesDefaultAlignment="center"
                [uiRteImagesMinWidth]="80"
                [uiRteImagesMaxWidth]="480"
                [uiRteImagesLockAspectRatio]="false"
                placeholder="Insert an image, select it, then drag the corner or edge handles…"
                minHeight="220px"
            />
        `,
    }),
};

export const RtlAndLocale: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteImages
                uiRteImagesLocale="he"
                locale="he"
                minHeight="180px"
            />
        `,
    }),
};
