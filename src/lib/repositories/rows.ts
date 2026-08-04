import type { Database } from '@/lib/supabase/database.types'

/** Convenience aliases over the generated schema, so call sites stay readable. */
export type Tables = Database['public']['Tables']
export type Enums = Database['public']['Enums']

export type CourtEnvironment = Enums['court_environment']
export type ProductType = Enums['product_type']
export type BookingStatusRow = Enums['booking_status']

export type ClubRow = Tables['clubs']['Row']
export type CourtRow = Tables['courts']['Row']
export type ProductRow = Tables['products']['Row']
export type PricingRuleRow = Tables['pricing_rules']['Row']
export type BookingRow = Tables['bookings']['Row']
export type BookingCourtRow = Tables['booking_courts']['Row']
export type AvailabilityBlockRow = Tables['availability_blocks']['Row']
