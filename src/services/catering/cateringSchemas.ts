import { z } from 'zod';

// Firestore Timestamp-like value (can be Timestamp object, plain {seconds, nanoseconds}, or null)
const firestoreTimestamp = z.any().optional();

export const OrderItemSchema = z.object({
  menuItemId: z.string(),
  name: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  specialInstructions: z.string().optional(),
});

export const DeliveryAddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string().optional(),
  zip: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const CateringOrderSchema = z.object({
  id: z.string().optional(),
  customerId: z.string(),
  businessId: z.string(),
  businessName: z.string(),
  items: z.array(OrderItemSchema),
  subtotal: z.number().int(),
  tax: z.number().int(),
  total: z.number().int(),
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']),
  deliveryAddress: DeliveryAddressSchema.optional(),
  createdAt: firestoreTimestamp,
}).passthrough(); // allow extra Firestore fields we don't validate

/**
 * Safely parse a Firestore document into a typed object.
 * Returns the parsed data or null if validation fails.
 */
export function safeParseCateringOrder(data: unknown): z.infer<typeof CateringOrderSchema> | null {
  const result = CateringOrderSchema.safeParse(data);
  if (!result.success) {
    console.warn('[CateringSchema] Order validation failed:', result.error.issues);
    return null;
  }
  return result.data;
}
