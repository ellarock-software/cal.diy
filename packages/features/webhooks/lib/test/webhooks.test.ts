import prismock from "@calcom/testing/lib/__mocks__/prisma";

import { expectWebhookToHaveBeenCalledWith } from "@calcom/testing/lib/bookingScenario/expects";

import { afterEach, describe, expect, beforeEach, vi } from "vitest";

import dayjs from "@calcom/dayjs";
import { WebhookTriggerEvents } from "@calcom/prisma/enums";
import { test } from "@calcom/testing/lib/fixtures/fixtures";

import { handleWebhookScheduledTriggers } from "../handleWebhookScheduledTriggers";
import type { EventPayloadType } from "../sendPayload";
import { scheduleTrigger } from "../scheduleTrigger";

describe("Cron job handler", () => {
  beforeEach(async () => {
    await prismock.webhookScheduledTriggers.deleteMany();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  test(`should delete old webhook scheduled triggers`, async () => {
    const now = dayjs();
    await prismock.webhookScheduledTriggers.createMany({
      data: [
        {
          id: 1,
          subscriberUrl: "https://example.com",
          startAfter: now.subtract(2, "day").toDate(),
          payload: "",
        },
        {
          id: 1,
          subscriberUrl: "https://example.com",
          startAfter: now.subtract(1, "day").subtract(1, "hour").toDate(),
          payload: "",
        },
        {
          id: 2,
          subscriberUrl: "https://example.com",
          startAfter: now.add(1, "day").toDate(),
          payload: "",
        },
      ],
    });

    await handleWebhookScheduledTriggers(prismock);

    const scheduledTriggers = await prismock.webhookScheduledTriggers.findMany();
    expect(scheduledTriggers.length).toBe(1);
    expect(scheduledTriggers[0].startAfter).toStrictEqual(now.add(1, "day").toDate());
  });
  test(`should trigger if current date is after startAfter`, async () => {
    const now = dayjs();
    const payload = `{"triggerEvent":"MEETING_ENDED"}`;
    await prismock.webhookScheduledTriggers.createMany({
      data: [
        {
          id: 1,
          subscriberUrl: "https://example.com",
          startAfter: now.add(5, "minute").toDate(),
          payload,
        },
        {
          id: 2,
          subscriberUrl: "https://example.com/test",
          startAfter: now.subtract(5, "minute").toDate(),
          payload,
        },
      ],
    });
    await handleWebhookScheduledTriggers(prismock);

    expectWebhookToHaveBeenCalledWith("https://example.com/test", { triggerEvent: "MEETING_ENDED", payload });
    expect(() =>
      expectWebhookToHaveBeenCalledWith("https://example.com", { triggerEvent: "MEETING_ENDED", payload })
    ).toThrow("Webhook not sent to https://example.com for MEETING_ENDED. All webhooks: []");
  });

  test("should store rendered custom payload for scheduled meeting webhooks", async () => {
    const createSpy = vi.spyOn(prismock.webhookScheduledTriggers, "create").mockResolvedValue({} as never);

    const webhookData: EventPayloadType = {
      title: "Team Sync",
      description: "Weekly sync",
      startTime: "2026-07-07T10:00:00.000Z",
      endTime: "2026-07-07T11:00:00.000Z",
      type: "team-sync",
      organizer: {
        name: "Organizer",
        email: "organizer@example.com",
        timeZone: "UTC",
        language: { locale: "en", translate: (key: string) => key },
      },
      attendees: [],
      metadata: { videoCallUrl: "https://cal.com/video/42" },
    };

    await scheduleTrigger({
      booking: {
        id: 42,
        uid: "booking-42",
        title: "Team Sync",
        description: "Weekly sync",
        startTime: new Date("2026-07-07T10:00:00.000Z"),
        endTime: new Date("2026-07-07T11:00:00.000Z"),
        eventType: { slug: "team-sync" },
      },
      subscriberUrl: "https://example.com/webhook",
      subscriber: {
        id: "webhook-1",
        appId: null,
        payloadTemplate:
          '{"triggerEvent":"{{triggerEvent}}","type":"{{type}}","videoCallUrl":"{{metadata.videoCallUrl}}"}',
      },
      triggerEvent: WebhookTriggerEvents.MEETING_ENDED,
      webhookData,
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload:
            '{"triggerEvent":"MEETING_ENDED","type":"team-sync","videoCallUrl":"https://cal.com/video/42"}',
        }),
      })
    );
  });

  test("should store documented meeting fields in default scheduled payloads", async () => {
    const createSpy = vi.spyOn(prismock.webhookScheduledTriggers, "create").mockResolvedValue({} as never);

    const webhookData: EventPayloadType = {
      title: "Team Sync",
      description: "Weekly sync",
      startTime: "2026-07-07T10:00:00.000Z",
      endTime: "2026-07-07T11:00:00.000Z",
      type: "team-sync",
      organizer: {
        name: "Organizer",
        email: "organizer@example.com",
        timeZone: "UTC",
        language: { locale: "en", translate: (key: string) => key },
      },
      attendees: [],
      metadata: { videoCallUrl: "https://cal.com/video/42" },
    };

    await scheduleTrigger({
      booking: {
        id: 42,
        uid: "booking-42",
        title: "Team Sync",
        description: "Weekly sync",
        startTime: new Date("2026-07-07T10:00:00.000Z"),
        endTime: new Date("2026-07-07T11:00:00.000Z"),
        eventType: { slug: "team-sync" },
      },
      subscriberUrl: "https://example.com/webhook",
      subscriber: {
        id: "webhook-1",
        appId: null,
        payloadTemplate: null,
      },
      triggerEvent: WebhookTriggerEvents.MEETING_STARTED,
      webhookData,
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const createArgs = createSpy.mock.calls[0][0];
    const scheduledPayload = JSON.parse(createArgs.data.payload);

    expect(scheduledPayload.triggerEvent).toBe("MEETING_STARTED");
    expect(scheduledPayload.payload.type).toBe("team-sync");
    expect(scheduledPayload.payload.metadata).toEqual({
      videoCallUrl: "https://cal.com/video/42",
    });
  });
});
