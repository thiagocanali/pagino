import { createHash, randomBytes } from 'node:crypto'
import postgres from 'postgres'
import { symmetricEncrypt, symmetricDecrypt } from 'better-auth/crypto'
import type { AuthMailTransport } from '../auth/mail'
import { normalizeProvisionInput } from '../../shared/schemas/provisioning'

/**
 * Offline operator-only service. Never import from a public Nitro endpoint.
 * Uses a dedicated provision_operator connection, not auth_runtime/app_runtime.
 */
export async function provisionInstitution(
  options: { databaseUrl: string; appOrigin: string; encryptionSecret: string; mail: AuthMailTransport },
  input: unknown,
) {
  const data = normalizeProvisionInput(input)
  if (options.encryptionSecret.length < 32) throw new Error('Provisioning encryption secret missing')
  const origin = new URL(options.appOrigin)
  if (origin.origin !== options.appOrigin || (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))) throw new Error('Invalid application origin')
  const client = postgres(options.databaseUrl, { max: 1, prepare: false, connect_timeout: 5 })
  try {
    const [role] = await client`select current_user as name, rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname = current_user`
    if (!role || role.name !== 'provision_operator' || role.rolsuper || role.rolbypassrls || role.rolcreaterole) throw new Error('Dedicated restricted operator role required')
    const receipt = await client.begin(async tx => {
      // Serialize retries and avoid leaking a newly generated token on conflict.
      await tx`select pg_advisory_xact_lock(hashtextextended(${data.idempotencyKey}, 0))`
      const previous = await tx`
        select i.id, i.slug, i.name, v.recipient_email, v.id as invitation_id, v.encrypted_token, v.delivery_status, v.expires_at
        from pagino.provisioning_operations p
        join pagino.institutions i on i.id = p.institution_id
        join pagino.initial_owner_invitations v on v.institution_id = i.id
        where p.idempotency_key = ${data.idempotencyKey}
      `
      if (previous.length) {
        const existing = previous[0]!

        if (existing.slug !== data.slug || existing.name !== data.name || existing.recipient_email !== data.ownerEmail) throw new Error('Idempotency key reused with different input')
        return { id: existing.id as string, invitationId: existing.invitation_id as string, encryptedToken: existing.encrypted_token as string, status: existing.delivery_status as string, expiresAt: existing.expires_at as Date }
      }
      const token = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      const encryptedToken = await symmetricEncrypt({ key: options.encryptionSecret, data: token })
      const [institution] = await tx`insert into pagino.institutions (name, slug) values (${data.name}, ${data.slug}) returning id`
      if (!institution) throw new Error('Institution insert failed')
      await tx`insert into pagino.sites (institution_id) values (${institution.id})`
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const [invite] = await tx`
        insert into pagino.initial_owner_invitations (institution_id, recipient_email, token_hash, encrypted_token, expires_at)
        values (${institution.id}, ${data.ownerEmail}, ${tokenHash}, ${encryptedToken}, ${expiresAt}) returning id
      `
      if (!invite) throw new Error('Invitation insert failed')
      await tx`insert into pagino.provisioning_operations (idempotency_key, institution_id) values (${data.idempotencyKey}, ${institution.id})`
      await tx`insert into pagino.operator_audit_logs (institution_id, action) values (${institution.id}, 'institution.provisioned')`
      return { id: institution.id as string, invitationId: invite.id as string, encryptedToken, status: 'pending', expiresAt }
    })
    if (receipt.status === 'sent') return { institutionId: receipt.id, deliveryStatus: 'sent' as const }
    if (receipt.expiresAt.getTime() <= Date.now()) throw new Error('Invitation expired; requires explicit operator recovery')
    const token = await symmetricDecrypt({ key: options.encryptionSecret, data: receipt.encryptedToken })
    // No token is printed, logged, or returned to the caller.
    try {
      await options.mail.send({
        to: data.ownerEmail,
        subject: 'Convite para administrar sua instituição — Pagino',
        text: `Você foi convidado para administrar uma instituição no Pagino. A aceitação será habilitada após a implementação segura do fluxo de convite. Guarde esta mensagem; o convite não está ativado ainda.\nCódigo de convite: ${token}\n`,
      })
    }
    catch {
      await client`update pagino.initial_owner_invitations set delivery_status = 'failed' where id = ${receipt.invitationId} and used_at is null`
      throw new Error('Invitation delivery failed; retry with same idempotency key')
    }
    await client`update pagino.initial_owner_invitations set delivery_status = 'sent' where id = ${receipt.invitationId} and used_at is null`
    return { institutionId: receipt.id, deliveryStatus: 'sent' as const }
  }
  finally { await client.end() }
}
