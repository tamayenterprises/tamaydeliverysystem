export type PackageCategory =
  | 'box'
  | 'envelope'
  | 'furniture'
  | 'appliance'
  | 'construction'
  | 'other'

export type DeliveryPreference =
  | 'earliest_available'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'specific_two_hour_window'
  | 'specific_date'
  | 'appointment_delivery'

export interface DeliveryRequestDraft {
  pickupAddress: string
  pickupContactName: string
  pickupContactPhone: string
  destinationAddress: string
  recipientName: string
  recipientPhone: string
  deliveryPreference: DeliveryPreference | ''
  deliveryDate: string
  deliveryWindowId: string
  packageCategory: PackageCategory
  description: string
  lengthInches: string
  widthInches: string
  heightInches: string
  weightPounds: string
  specialHandling: string
}
