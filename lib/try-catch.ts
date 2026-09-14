export interface TryCatchSuccess<T> {
  readonly data: T
  readonly error: null
}

export interface TryCatchFailure {
  readonly data: null
  readonly error: Error
}

export type TryCatchResult<T> = TryCatchSuccess<T> | TryCatchFailure

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught))
}

/**
 * Run an async function and return a result object instead of throwing.
 *
 * @param runAsync - Work that may reject.
 * @returns `{ data, error }` with exactly one side set.
 */
export async function tryCatch<T>(
  runAsync: () => Promise<T>
): Promise<TryCatchResult<T>> {
  try {
    return { data: await runAsync(), error: null }
  } catch (caught) {
    return { data: null, error: toError(caught) }
  }
}
