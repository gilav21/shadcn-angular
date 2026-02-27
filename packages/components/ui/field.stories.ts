import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    FieldComponent,
    FieldGroupComponent,
    FieldSetComponent,
    FieldLabelComponent,
    FieldLegendComponent,
    FieldDescriptionComponent,
    FieldErrorComponent,
    FieldSeparatorComponent,
} from './field.component';
import { InputComponent } from './input.component';
import { ButtonComponent } from './button.component';

const meta: Meta<FieldComponent> = {
    title: 'UI/Field',
    component: FieldComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                FieldComponent,
                FieldGroupComponent,
                FieldSetComponent,
                FieldLabelComponent,
                FieldLegendComponent,
                FieldDescriptionComponent,
                FieldErrorComponent,
                FieldSeparatorComponent,
                InputComponent,
                ButtonComponent,
            ],
        }),
    ],
};

export default meta;
type Story = StoryObj<FieldComponent>;

export const Default: Story = {
    render: () => ({
        template: `
            <ui-field>
                <ui-field-label for="email">Email</ui-field-label>
                <ui-input id="email" placeholder="you@example.com" />
                <ui-field-description>We will never share your email with anyone.</ui-field-description>
            </ui-field>
        `,
    }),
};

export const WithError: Story = {
    render: () => ({
        template: `
            <ui-field>
                <ui-field-label for="username">Username</ui-field-label>
                <ui-input id="username" placeholder="Enter username" />
                <ui-field-error>Username is already taken.</ui-field-error>
            </ui-field>
        `,
    }),
};

export const HorizontalOrientation: Story = {
    render: () => ({
        template: `
            <ui-field orientation="horizontal">
                <ui-field-label for="name">Name</ui-field-label>
                <ui-input id="name" placeholder="John Doe" />
            </ui-field>
        `,
    }),
};

export const FieldSet: Story = {
    render: () => ({
        template: `
            <ui-field-set>
                <ui-field-legend>Personal Information</ui-field-legend>

                <ui-field>
                    <ui-field-label for="first-name">First Name</ui-field-label>
                    <ui-input id="first-name" placeholder="John" />
                </ui-field>

                <ui-field>
                    <ui-field-label for="last-name">Last Name</ui-field-label>
                    <ui-input id="last-name" placeholder="Doe" />
                </ui-field>

                <ui-field>
                    <ui-field-label for="bio-email">Email</ui-field-label>
                    <ui-input id="bio-email" type="email" placeholder="john@example.com" />
                    <ui-field-description>Your primary contact email.</ui-field-description>
                </ui-field>
            </ui-field-set>
        `,
    }),
};

export const FieldGroup: Story = {
    render: () => ({
        template: `
            <ui-field-group>
                <ui-field-set>
                    <ui-field-legend>Account</ui-field-legend>

                    <ui-field>
                        <ui-field-label for="acct-email">Email</ui-field-label>
                        <ui-input id="acct-email" type="email" placeholder="you@example.com" />
                    </ui-field>

                    <ui-field>
                        <ui-field-label for="acct-password">Password</ui-field-label>
                        <ui-input id="acct-password" type="password" placeholder="Enter password" />
                        <ui-field-description>Must be at least 8 characters.</ui-field-description>
                    </ui-field>
                </ui-field-set>

                <ui-field-separator></ui-field-separator>

                <ui-field-set>
                    <ui-field-legend>Profile</ui-field-legend>

                    <ui-field>
                        <ui-field-label for="display-name">Display Name</ui-field-label>
                        <ui-input id="display-name" placeholder="Your display name" />
                    </ui-field>
                </ui-field-set>
            </ui-field-group>
        `,
    }),
};

export const WithDescriptionAndError: Story = {
    render: () => ({
        template: `
            <ui-field>
                <ui-field-label for="password">Password</ui-field-label>
                <ui-input id="password" type="password" placeholder="Enter a strong password" />
                <ui-field-description>Must contain uppercase, lowercase, and a number.</ui-field-description>
                <ui-field-error>Password does not meet the requirements.</ui-field-error>
            </ui-field>
        `,
    }),
};
