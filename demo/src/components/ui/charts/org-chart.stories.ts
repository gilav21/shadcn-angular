import type { Meta, StoryObj } from '@storybook/angular';
import { OrgChartComponent } from './org-chart.component';
import { OrgNode } from './chart.types';

const meta: Meta<OrgChartComponent> = {
    title: 'Charts/OrgChart',
    component: OrgChartComponent,
    tags: ['autodocs'],
    argTypes: {
        layout: {
            control: 'select',
            options: ['vertical', 'horizontal'],
        },
        lineType: {
            control: 'select',
            options: ['curved', 'straight'],
        },
        nodeWidth: { control: { type: 'range', min: 120, max: 250, step: 10 } },
        nodeHeight: { control: { type: 'range', min: 60, max: 120, step: 10 } },
        showImages: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<OrgChartComponent>;

// Sample company org data
const companyOrgData: OrgNode[] = [
    { id: 'ceo', name: 'Sarah Johnson', title: 'CEO', parentId: null },
    { id: 'cto', name: 'Michael Chen', title: 'CTO', parentId: 'ceo' },
    { id: 'cfo', name: 'Emily Rodriguez', title: 'CFO', parentId: 'ceo' },
    { id: 'coo', name: 'David Kim', title: 'COO', parentId: 'ceo' },
    { id: 'dev-lead', name: 'Alex Turner', title: 'Dev Lead', parentId: 'cto' },
    { id: 'design-lead', name: 'Jessica Lee', title: 'Design Lead', parentId: 'cto' },
    { id: 'dev1', name: 'Chris Brown', title: 'Sr. Developer', parentId: 'dev-lead' },
    { id: 'dev2', name: 'Taylor Swift', title: 'Developer', parentId: 'dev-lead' },
    { id: 'designer1', name: 'Jordan Rivera', title: 'UI Designer', parentId: 'design-lead' },
    { id: 'finance1', name: 'Morgan White', title: 'Accountant', parentId: 'cfo' },
    { id: 'ops1', name: 'Casey Green', title: 'Operations Manager', parentId: 'coo' },
];

export const Default: Story = {
    args: {
        data: companyOrgData,
        layout: 'vertical',
        nodeWidth: 180,
        nodeHeight: 80,
        showImages: true,
        lineType: 'curved',
    },
};

export const HorizontalLayout: Story = {
    args: {
        data: companyOrgData,
        layout: 'horizontal',
        nodeWidth: 180,
        nodeHeight: 80,
        showImages: true,
        lineType: 'curved',
    },
};

export const StraightLines: Story = {
    args: {
        data: companyOrgData,
        layout: 'vertical',
        lineType: 'straight',
        nodeWidth: 180,
        nodeHeight: 80,
        showImages: true,
    },
};

// Small team example
const smallTeamData: OrgNode[] = [
    { id: 'lead', name: 'Team Lead', title: 'Project Manager', parentId: null },
    { id: 'dev', name: 'Developer', title: 'Full Stack', parentId: 'lead' },
    { id: 'designer', name: 'Designer', title: 'UI/UX', parentId: 'lead' },
    { id: 'qa', name: 'QA Engineer', title: 'Testing', parentId: 'lead' },
];

export const SmallTeam: Story = {
    args: {
        data: smallTeamData,
        layout: 'vertical',
        nodeWidth: 160,
        nodeHeight: 70,
        showImages: true,
        lineType: 'curved',
    },
};

// Department with colors
const departmentData: OrgNode[] = [
    { id: 'director', name: 'Engineering Director', title: 'Director', parentId: null, color: 'hsl(221 83% 53%)' },
    { id: 'frontend', name: 'Frontend Team', title: 'Team Lead', parentId: 'director', color: 'hsl(142 76% 36%)' },
    { id: 'backend', name: 'Backend Team', title: 'Team Lead', parentId: 'director', color: 'hsl(262 83% 58%)' },
    { id: 'devops', name: 'DevOps Team', title: 'Team Lead', parentId: 'director', color: 'hsl(25 95% 53%)' },
    { id: 'fe1', name: 'React Developer', title: 'Senior', parentId: 'frontend', color: 'hsl(142 76% 36%)' },
    { id: 'fe2', name: 'Angular Developer', title: 'Senior', parentId: 'frontend', color: 'hsl(142 76% 36%)' },
    { id: 'be1', name: 'Node.js Developer', title: 'Senior', parentId: 'backend', color: 'hsl(262 83% 58%)' },
    { id: 'be2', name: 'Python Developer', title: 'Senior', parentId: 'backend', color: 'hsl(262 83% 58%)' },
    { id: 'do1', name: 'Cloud Engineer', title: 'Senior', parentId: 'devops', color: 'hsl(25 95% 53%)' },
];

export const ColorCodedDepartments: Story = {
    args: {
        data: departmentData,
        layout: 'vertical',
        nodeWidth: 180,
        nodeHeight: 80,
        showImages: true,
        lineType: 'curved',
    },
};

// No images variant
export const NoImages: Story = {
    args: {
        data: companyOrgData,
        layout: 'vertical',
        nodeWidth: 160,
        nodeHeight: 60,
        showImages: false,
        lineType: 'curved',
    },
};

// Compact variant
export const Compact: Story = {
    args: {
        data: smallTeamData,
        layout: 'horizontal',
        nodeWidth: 140,
        nodeHeight: 60,
        nodePaddingX: 30,
        nodePaddingY: 20,
        showImages: false,
        lineType: 'straight',
    },
};
