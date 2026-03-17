import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Global mocks: prevent auth / db from requiring real env vars in tests
// ---------------------------------------------------------------------------

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'mock-user-id', email: 'test@example.com' },
  }),
}))

vi.mock('@/lib/auth/guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'mock-user-id', email: 'test@example.com' }),
}))

vi.mock('@/lib/db', () => ({
  db: {},
}))
