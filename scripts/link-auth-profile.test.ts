import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { linkAuthProfile } from './link-auth-profile'

const scriptSource = readFileSync(new URL('./link-auth-profile.ts', import.meta.url), 'utf8')

describe('linkAuthProfile', () => {
  it('loads the repository local environment when run directly', () => {
    expect(scriptSource).toContain("path: process.env.DOTENV_CONFIG_PATH ?? '.env.local'")
  })

  it('links an invited auth user to an existing family profile', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const client = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: {
              users: [{ id: 'auth-user-1', email: 'family@example.test', invited_at: '2026-08-01T00:00:00Z' }],
            },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({ select, insert }),
    }

    await expect(linkAuthProfile(client, {
      profileId: '00000000-0000-0000-0000-000000000001',
      email: 'FAMILY@example.test',
    })).resolves.toEqual({ profileId: '00000000-0000-0000-0000-000000000001', authUserId: 'auth-user-1' })

    expect(client.from).toHaveBeenCalledWith('users')
    expect(insert).toHaveBeenCalledWith({
      profile_id: '00000000-0000-0000-0000-000000000001',
      auth_user_id: 'auth-user-1',
    })
  })

  it('rejects a non-invited account without exposing the email', async () => {
    const client = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'auth-user-1', email: 'family@example.test' }] },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: '00000000-0000-0000-0000-000000000001' },
              error: null,
            }),
          }),
        }),
      }),
    }

    await expect(linkAuthProfile(client, {
      profileId: '00000000-0000-0000-0000-000000000001',
      email: 'family@example.test',
    })).rejects.toThrow('No invited account matched')
    await expect(linkAuthProfile(client, {
      profileId: '00000000-0000-0000-0000-000000000001',
      email: 'family@example.test',
    })).rejects.not.toThrow('family@example.test')
  })
})
