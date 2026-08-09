import { z } from "zod";
import { eventTypeAppCardZod } from "../eventTypeAppCardZod";

export const bitrix24CredentialSchema: z.ZodType<{ webhookUrl: string }> = z.object({
  webhookUrl: z
    .string()
    .url()
    .refine(
      (value) => URL.canParse(value) && new URL(value).protocol === "https:",
      "Bitrix24 webhook URL must use HTTPS"
    )
    .refine(
      (value) =>
        URL.canParse(value) &&
        /^\/rest\/\d+\/[^/]+\/?$/.test(new URL(value).pathname) &&
        !new URL(value).search &&
        !new URL(value).hash,
      "Bitrix24 webhook URL must contain a REST user ID and webhook token"
    ),
});

export const appKeysSchema = z.object({});

export const appDataSchema: typeof eventTypeAppCardZod = eventTypeAppCardZod;
