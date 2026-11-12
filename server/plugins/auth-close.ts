import { closeAuthentication } from '../auth/runtime'

export default defineNitroPlugin((nitro) => { nitro.hooks.hook('close', closeAuthentication) })
