/**
 * Uniform result envelope for server actions and route handlers, so callers
 * never have to guess whether a thrown error or a null return means failure.
 */
export type Ok<T> = { readonly success: true; readonly data: T }
export type Err = { readonly success: false; readonly error: string; readonly code?: string }
export type Result<T> = Ok<T> | Err

export function ok<T>(data: T): Ok<T> {
  return { success: true, data }
}

export function err(error: string, code?: string): Err {
  return code === undefined ? { success: false, error } : { success: false, error, code }
}

export function isOk<T>(result: Result<T>): result is Ok<T> {
  return result.success
}
