import { isValidAppLinkUrl, normalizeAppLinkUrl } from "@portal/shared";
import { z } from "zod";

export const optionalPortalUrlSchema = z.preprocess(
  (value) => typeof value === "string" ? (value.trim() ? normalizeAppLinkUrl(value) : null) : value,
  z.string().refine(isValidAppLinkUrl).nullish(),
).transform((value) => value ?? null);
