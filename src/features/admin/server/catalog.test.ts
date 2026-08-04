import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentStaff = vi.fn()
const createSupabaseServerClient = vi.fn()
const createProduct = vi.fn()
const updateProduct = vi.fn()
const createPricingRule = vi.fn()
const updatePricingRule = vi.fn()

vi.mock('@/lib/auth/staff', () => ({ getCurrentStaff }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient }))
vi.mock('@/lib/repositories/products', () => ({ createProduct, updateProduct }))
vi.mock('@/lib/repositories/pricing-rules', () => ({ createPricingRule, updatePricingRule }))

const { saveProduct, savePricingRule } = await import('./catalog')

const STAFF = {
  id: 'staff-1',
  userId: 'user-1',
  clubId: 'club-1',
  role: 'admin' as const,
  fullName: 'Mika Reyes',
}

const PRODUCT_ID = '55555555-5555-4555-8555-555555555555'
const RULE_ID = '66666666-6666-4666-8666-666666666666'
const OTHER_CLUB = '77777777-7777-4777-8777-777777777777'

const NEW_PRODUCT = {
  name: 'Iced Barako',
  description: 'House cold brew',
  type: 'cafe',
  priceCents: 12000,
  hasQuantity: true,
  imageUrl: null,
  sortOrder: 1,
}

const NEW_RULE = {
  courtId: null,
  label: 'Weekend peak',
  daysOfWeek: [6, 0],
  startsAtTime: '16:00',
  endsAtTime: '21:00',
  minDurationMinutes: null,
  appliesToTier: null,
  kind: 'percent_delta',
  valueCents: null,
  valuePercent: 20,
  priority: 10,
}

beforeEach(() => {
  vi.clearAllMocks()
  createSupabaseServerClient.mockResolvedValue({})
  getCurrentStaff.mockResolvedValue(STAFF)
  createProduct.mockResolvedValue({ id: PRODUCT_ID })
  updateProduct.mockResolvedValue({ id: PRODUCT_ID })
  createPricingRule.mockResolvedValue({ id: RULE_ID })
  updatePricingRule.mockResolvedValue({ id: RULE_ID })
})

describe('saveProduct', () => {
  it('refuses a caller with no staff session', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await saveProduct(NEW_PRODUCT)

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(createProduct).not.toHaveBeenCalled()
  })

  it('creates the product under the club the staff member belongs to', async () => {
    await saveProduct(NEW_PRODUCT)

    expect(createProduct).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clubId: 'club-1', name: 'Iced Barako' }),
    )
  })

  it('ignores a clubId in the request, so staff cannot write into another club', async () => {
    await saveProduct({ ...NEW_PRODUCT, clubId: OTHER_CLUB })

    expect(createProduct).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clubId: 'club-1' }),
    )
  })

  it('patches an existing product when an id is supplied, instead of creating a duplicate', async () => {
    await saveProduct({ id: PRODUCT_ID, priceCents: 13000 })

    expect(createProduct).not.toHaveBeenCalled()
    expect(updateProduct).toHaveBeenCalledWith(expect.anything(), PRODUCT_ID, { priceCents: 13000 })
  })

  it('sends only the fields the editor changed', async () => {
    await saveProduct({ id: PRODUCT_ID, isActive: false })

    expect(updateProduct).toHaveBeenCalledWith(expect.anything(), PRODUCT_ID, { isActive: false })
  })

  it('rejects a negative price', async () => {
    const result = await saveProduct({ ...NEW_PRODUCT, priceCents: -1 })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createProduct).not.toHaveBeenCalled()
  })

  it('rejects a product type the database does not define', async () => {
    const result = await saveProduct({ ...NEW_PRODUCT, type: 'merch' })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })
})

describe('savePricingRule', () => {
  it('refuses a caller with no staff session', async () => {
    getCurrentStaff.mockResolvedValue(null)

    const result = await savePricingRule(NEW_RULE)

    expect(result).toMatchObject({ success: false, code: 'UNAUTHORIZED' })
    expect(createPricingRule).not.toHaveBeenCalled()
  })

  it('creates the rule under the staff member’s club', async () => {
    await savePricingRule(NEW_RULE)

    expect(createPricingRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clubId: 'club-1', label: 'Weekend peak' }),
    )
  })

  it('rejects a percentage rule that carries no percentage', async () => {
    const result = await savePricingRule({ ...NEW_RULE, valuePercent: null })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
    expect(createPricingRule).not.toHaveBeenCalled()
  })

  it('rejects a cash rule that carries no amount', async () => {
    const result = await savePricingRule({
      ...NEW_RULE,
      kind: 'fixed',
      valuePercent: null,
      valueCents: null,
    })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('rejects a day-of-week outside 0–6', async () => {
    const result = await savePricingRule({ ...NEW_RULE, daysOfWeek: [7] })

    expect(result).toMatchObject({ success: false, code: 'INVALID' })
  })

  it('patches an existing rule when an id is supplied', async () => {
    await savePricingRule({ id: RULE_ID, isActive: false })

    expect(createPricingRule).not.toHaveBeenCalled()
    expect(updatePricingRule).toHaveBeenCalledWith(expect.anything(), RULE_ID, { isActive: false })
  })
})
