import { describe, expect, it } from 'vitest'
import { validateInstitution } from '../../shared/schemas/institution'

describe('institution input boundary', () => {
  it('normalizes surrounding whitespace without silently changing the slug', () => {
    expect(validateInstitution({ name: '  Associação Horizonte  ', slug: '  associacao-horizonte  ' }))
      .toEqual({ success: true, data: { name: 'Associação Horizonte', slug: 'associacao-horizonte' } })
  })

  it.each(['admin', 'api', 'auth', 'eventos', 'www', 'pagino', 's', '-inicio', 'fim-', 'a--b', 'Maiuscula', 'a/b', '<script>', 'com espaço'])('rejects unsafe or reserved slug %s', (slug) => {
    const result = validateInstitution({ name: 'Instituição', slug })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.fields.slug).toBeTruthy()
  })

  it.each([null, [], 'text', { name: 'A', slug: 'ab' }, { name: 'a'.repeat(121), slug: 's'.repeat(61) }])('rejects malformed input %j', (input) => {
    expect(validateInstitution(input).success).toBe(false)
  })

  it('rejects extra properties, including attempted privilege injection', () => {
    expect(validateInstitution({ name: 'Instituição', slug: 'instituicao', role: 'owner' }).success).toBe(false)
  })
})
