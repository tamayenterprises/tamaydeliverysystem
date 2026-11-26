export type PackageCategory =
  | 'box'
  | 'envelope'
  | 'furniture'
  | 'appliance'
  | 'construction'
  | 'other'

export interface DeliveryRequestDraft {
  pickupAddress: string
  pickupContactName: string
  pickupContactPhone: string
  destinationAddress: string
  recipientName: string
  recipientPhone: string
  deliveryDate: string
  packageCategory: PackageCategory
  description: string
  lengthInches: string
  widthInches: string
  heightInches: string
  weightPounds: string
  specialHandling: string
}
