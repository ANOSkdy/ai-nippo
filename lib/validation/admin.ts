import { z } from 'zod';

export const searchQuerySchema = z.object({
  userId: z.string().trim().min(1).max(100).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  siteName: z.string().trim().min(1).max(100).optional(),
  type: z.enum(['IN', 'OUT']).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const reflectBodySchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        fields: z
          .object({
            workDescription: z.string().max(1000).optional(),
            type: z.enum(['IN', 'OUT']).optional(),
          })
          .refine((o) => Object.keys(o).length > 0, 'No fields to update'),
      }),
    )
    .min(1)
    .max(50),
});

