export interface HeavyCombineGate {
  readonly blobEnabled: boolean
  readonly authConfigured: boolean
  readonly isSignedIn: boolean
}

/**
 * Heavy merge may start only with Blob, Neon auth env, and a session.
 *
 * @param gate - Health flags plus client session.
 * @returns Whether Combine should run the upload/workflow path.
 */
export function canStartHeavyCombine(gate: HeavyCombineGate): boolean {
  return gate.blobEnabled && gate.authConfigured && gate.isSignedIn
}
