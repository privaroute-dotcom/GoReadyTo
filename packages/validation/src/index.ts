import { z } from 'zod';

export const coordinatesSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

export const bootstrapTaskSchema = coordinatesSchema;

export const createCaptureSessionSchema = z.object({
  taskId: z.string().uuid(),
  devicePublicId: z.string().min(3).max(200),
  platform: z.enum(['ios', 'android', 'unknown']),
});

export const locationSampleSchema = coordinatesSchema.extend({
  accuracyM: z.number().positive().max(10000),
  altitudeM: z.number().nullable().optional(),
  headingDeg: z.number().gte(0).lte(360).nullable().optional(),
  speedMps: z.number().nullable().optional(),
  deviceTimestamp: z.string().datetime(),
});

export const presignEvidenceSchema = coordinatesSchema.extend({
  captureSessionId: z.string().uuid(),
  mediaType: z.enum(['photo', 'video', '360']),
  captureStep: z.number().int().positive(),
  mimeType: z.string().min(3),
  clientSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  capturedAt: z.string().datetime(),
  gpsAccuracyM: z.number().positive().max(10000),
});

export const submitObservationSchema = z.object({
  captureSessionId: z.string().uuid(),
  answer: z.enum(['YES', 'NO', 'UNCERTAIN']),
  note: z.string().max(2000).optional(),
});
