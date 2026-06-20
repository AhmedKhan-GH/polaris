// @vitest-environment node
//
// withOrgContext unit contract (lib/db/with-org-context). Mirrors
// with-user-context.test.ts in shape. This is the sibling, org-scoped layer:
// it composes withUserContext rather than talking to `db` directly, so the
// mock boundary here is withUserContext itself, not the DB client. The real
// membership lookup + GUC behaviour against Postgres is proven separately in
// the integration suite — this file only asserts fail-closed validation and
// that a non-member never reaches `fn`.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecute = vi.fn();
const mockTx = { execute: mockExecute };

vi.mock('./with-user-context', () => ({
    withUserContext: vi.fn(async (_ctx, cb) => cb(mockTx)),
}));

import { withUserContext } from './with-user-context';

import { withOrgContext } from './with-org-context';

const userContextMock = vi.mocked(withUserContext);

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

beforeEach(() => {
    userContextMock.mockClear();
    mockExecute.mockReset();
});

describe('lib/db withOrgContext', () => {
    it('rejects an empty orgId without calling withUserContext', async () => {
        await expect(
            withOrgContext({ userId: USER_ID, orgId: '' }, async () => 'ok'),
        ).rejects.toThrow();
        expect(userContextMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed orgId with a UUID message and no withUserContext call', async () => {
        await expect(
            withOrgContext({ userId: USER_ID, orgId: 'not-a-uuid' }, async () => 'ok'),
        ).rejects.toThrow('orgId must be a UUID');
        expect(userContextMock).not.toHaveBeenCalled();
    });

    it('rejects an empty userId without calling withUserContext', async () => {
        await expect(
            withOrgContext({ userId: '', orgId: ORG_ID }, async () => 'ok'),
        ).rejects.toThrow();
        expect(userContextMock).not.toHaveBeenCalled();
    });

    it('throws "Not a member" and never runs fn when the membership lookup is empty', async () => {
        // Simulate the membership SELECT returning zero rows.
        mockExecute.mockResolvedValueOnce({ rows: [] });

        const fn = vi.fn(async () => 'should not run');

        await expect(
            withOrgContext({ userId: USER_ID, orgId: ORG_ID }, fn),
        ).rejects.toThrow('Not a member');

        expect(fn).not.toHaveBeenCalled();
    });

    it('sets app.org_id and app.org_role then resolves to fn(tx) for a real member', async () => {
        // Simulate the membership SELECT returning the caller's row.
        mockExecute
            .mockResolvedValueOnce({ rows: [{ role: 'org_admin' }] }) // membership lookup
            .mockResolvedValueOnce(undefined) // set_config app.org_id
            .mockResolvedValueOnce(undefined); // set_config app.org_role

        let received: unknown;
        const result = await withOrgContext(
            { userId: USER_ID, orgId: ORG_ID },
            async (tx) => {
                received = tx;
                return 'ok';
            },
        );

        expect(result).toBe('ok');
        expect(userContextMock).toHaveBeenCalledTimes(1);
        expect(received).toHaveProperty('execute');

        // app.org_id and app.org_role must both be set via set_config before fn
        // runs. Drizzle's sql`` tagged template returns an SQL object, not a
        // plain string — String(sqlObj) collapses to "[object Object]", so we
        // read the literal text out of its internal query chunks instead.
        const toQueryText = (value: unknown): string => {
            const chunks = (value as { queryChunks?: unknown[] }).queryChunks ?? [];
            return chunks
                .map((chunk) =>
                    typeof chunk === 'string'
                        ? chunk
                        : (chunk as { value?: unknown })?.value !== undefined
                            ? String((chunk as { value?: unknown }).value)
                            : '',
                )
                .join('');
        };

        const executedSql = mockExecute.mock.calls.map((c) => toQueryText(c[0]));
        expect(executedSql.some((s) => s.includes('app.org_id'))).toBe(true);
        expect(executedSql.some((s) => s.includes('app.org_role'))).toBe(true);
    });
});