// Schema composition root (Domain Charter §3). Re-exports every schema slice so
// drizzle-kit and the client see one aggregated namespace. Grows as later slices
// (tables, policies) are added.
export * from './roles';
export * from './identity';
export * from './audit';
