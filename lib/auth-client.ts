import { magicLinkClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/**
 * Browser Better Auth client. Same-origin `/api/auth`.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
})
