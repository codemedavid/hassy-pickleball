import { describe, expect, it } from 'vitest'
import {
  MAX_PROOF_BYTES,
  buildPaymentProofPath,
  validatePaymentProof,
  type ProofFile,
} from './payment-proof'

function screenshot(overrides: Partial<ProofFile> = {}): ProofFile {
  return { name: 'gcash-receipt.jpg', type: 'image/jpeg', size: 120_000, ...overrides }
}

describe('validatePaymentProof', () => {
  it('accepts a JPEG screenshot of the size a phone actually produces', () => {
    const result = validatePaymentProof(screenshot())

    expect(result.success).toBe(true)
  })

  it('derives the extension from the content type rather than the filename', () => {
    const result = validatePaymentProof(screenshot({ name: 'receipt.exe', type: 'image/png' }))

    expect(result).toMatchObject({ success: true, data: { extension: 'png' } })
  })

  it('accepts the HEIC an iPhone uploads by default', () => {
    expect(validatePaymentProof(screenshot({ type: 'image/heic' })).success).toBe(true)
  })

  it('rejects a PDF, because the desk verifies a screenshot by eye', () => {
    const result = validatePaymentProof(screenshot({ type: 'application/pdf' }))

    expect(result).toMatchObject({ success: false })
    expect(result.success === false && result.error).toMatch(/image/i)
  })

  it('rejects a file over the size ceiling', () => {
    const result = validatePaymentProof(screenshot({ size: MAX_PROOF_BYTES + 1 }))

    expect(result).toMatchObject({ success: false })
    expect(result.success === false && result.error).toMatch(/too large|smaller/i)
  })

  it('accepts a file exactly at the ceiling', () => {
    expect(validatePaymentProof(screenshot({ size: MAX_PROOF_BYTES })).success).toBe(true)
  })

  it('rejects an empty file, which is what an aborted upload looks like', () => {
    const result = validatePaymentProof(screenshot({ size: 0 }))

    expect(result).toMatchObject({ success: false })
  })
})

describe('buildPaymentProofPath', () => {
  it('files the proof under its booking reference, so one booking has one proof', () => {
    expect(buildPaymentProofPath('PB-4G6JVH', 'png')).toBe('PB-4G6JVH/proof.png')
  })

  it('refuses a reference that is not a booking reference, so the path cannot be steered', () => {
    expect(() => buildPaymentProofPath('../../secrets', 'png')).toThrow(/reference/i)
  })

  it('refuses an extension that is not one we issued', () => {
    expect(() => buildPaymentProofPath('PB-4G6JVH', '../x')).toThrow(/extension/i)
  })
})
