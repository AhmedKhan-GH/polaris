// Schema composition root (Domain Charter §3). Re-exports every schema slice so
// drizzle-kit and the client see one aggregated namespace. Grows as later slices
// (tables, policies) are added.
export * from './roles';
export * from './identity';
export * from './audit';
export * from './preferences';
// Feature-owned slices reach the client through lib/registry (NOT imported from
// app/ directly: that hop would violate Rule A). lib/registry/schema re-exports
// the feature `schema` manifests via the Rule-C exemption.
export * from '@/lib/registry/schema';
