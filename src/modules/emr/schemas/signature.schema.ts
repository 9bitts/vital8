import { z } from "zod";

export const signatureSettingsSchema = z.object({
  provider: z.enum(["DEV_SIMPLE", "ICP_A1", "ICP_DSAS", "ICP_LACUNA"]).default("DEV_SIMPLE"),
  timestampEnabled: z.boolean().default(false),
  dsasApiUrl: z.string().optional().nullable(),
  certificateBase64: z.string().optional().nullable(),
  certificatePassword: z.string().optional().nullable(),
  dsasApiKey: z.string().optional().nullable(),
});
