import { z } from 'zod';

/**
 * Data model D-1..D-4. Zod schemas are the runtime source of truth; the
 * TypeScript types are inferred from them so the two can never drift.
 */

export const STAGES = [
  'draft',
  'voting',
  'grouping',
  'results',
  'expanding',
  'expanded',
  'visualizing',
  'gallery',
] as const;

export const stageSchema = z.enum(STAGES);
export type Stage = z.infer<typeof stageSchema>;

/** D-1 resources[] — a context resource attached to a session. */
export const resourceSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  type: z.enum(['image', 'text']),
  /** Present when type === 'text'. */
  text: z.string().optional(),
  /** Blob key, present when type === 'image' (D-3). */
  imageKey: z.string().optional(),
  /** F-2.3 — pass this image to the image model as a visual reference. */
  useAsReference: z.boolean().default(false),
});
export type Resource = z.infer<typeof resourceSchema>;

/**
 * F-4.3 — what an attendee is allowed to submit. Shared by the function that
 * accepts it and the form that sends it, so the two cannot drift apart.
 */
export const IDEA_MIN_LENGTH = 10;
export const IDEA_MAX_LENGTH = 1000;

export const ideaTextSchema = z
  .string()
  .transform((text) => text.trim())
  .pipe(z.string().min(IDEA_MIN_LENGTH).max(IDEA_MAX_LENGTH));

/** D-2 — one blob per idea so concurrent attendee writes never race. */
export const ideaSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  createdAt: z.number(),
});
export type Idea = z.infer<typeof ideaSchema>;

/** F-5.2 — an LLM-produced group of ideas. */
export const groupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  synthesis: z.string(),
  ideaIds: z.array(z.string()),
});
export type Group = z.infer<typeof groupSchema>;

/** F-7 — the image-generation prompt expanded from a group. */
export const expansionSchema = z.object({
  prompt: z.string(),
  createdAt: z.number(),
});
export type Expansion = z.infer<typeof expansionSchema>;

/** F-8.4 — a generated image stored in Blobs. */
export const generatedImageSchema = z.object({
  imageKey: z.string().min(1),
  createdAt: z.number(),
});
export type GeneratedImage = z.infer<typeof generatedImageSchema>;

/** D-1 — the full session document. */
export const sessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().default(''),
  createdAt: z.number(),
  stage: stageSchema,
  resources: z.array(resourceSchema).default([]),
  groups: z.array(groupSchema).default([]),
  selectedGroupIds: z.array(z.string()).default([]),
  expansions: z.record(z.string(), expansionSchema).default({}),
  images: z.record(z.string(), generatedImageSchema).default({}),
});
export type Session = z.infer<typeof sessionSchema>;

/** D-4 — one entry of sessions/index.json. */
export const sessionSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  createdAt: z.number(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionIndexSchema = z.array(sessionSummarySchema);

/** What the attendee page is allowed to see (GET /api/sessions/:id/public). */
export const publicSessionSchema = z.object({
  title: z.string(),
  intro: z.string(),
  stage: stageSchema,
});
export type PublicSession = z.infer<typeof publicSessionSchema>;

/** Body of PATCH /api/sessions/:id — every field optional. */
export const sessionPatchSchema = sessionSchema.omit({ id: true, createdAt: true }).partial();
export type SessionPatch = z.infer<typeof sessionPatchSchema>;

/** Body of POST /api/sessions. */
export const createSessionSchema = z.object({
  title: z.string().min(1),
  intro: z.string().optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
