/**
 * Shell dev API (Iron Rule 8, ADR-0005): the dashboard chrome the root and
 * dashboard layouts/pages compose. All components are intentionally public —
 * shell is a foundation surface whose whole job is to be rendered by routes.
 */
export { BackButton } from './BackButton';
export { ChunkErrorReloader } from './ChunkErrorReloader';
export { DashboardNav } from './DashboardNav';
export { PageHeader } from './PageHeader';
