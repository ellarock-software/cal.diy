import { RetryableError } from "@calcom/lib/crmManager/errors";
import type { CalendarEvent } from "@calcom/types/Calendar";
import type { CredentialPayload } from "@calcom/types/Credential";
import type { CRM } from "@calcom/types/CrmService";
import type { TFunction } from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BuildCrmService from "./CrmService";

const webhookUrl = "https://example.bitrix24.com/rest/42/webhook-token";

function response(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createEvent(): CalendarEvent {
  return {
    type: "test-event",
    title: "Customer consultation",
    startTime: "2026-08-03T10:00:00.000Z",
    endTime: "2026-08-03T10:30:00.000Z",
    uid: "booking-123",
    description: "Discuss implementation",
    organizer: {
      email: "organizer@example.com",
      name: "Organizer",
      timeZone: "UTC",
      language: {
        translate: ((key: string) => key) as TFunction,
        locale: "en",
      },
    },
    attendees: [],
  };
}

describe("Bitrix24CrmService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: CRM;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const credential: CredentialPayload = {
      id: 1,
      type: "bitrix24_crm",
      key: { webhookUrl: `${webhookUrl}/` },
      userId: 1,
      appId: "bitrix24",
      teamId: null,
      invalid: false,
      user: { email: "organizer@example.com" },
      delegationCredentialId: null,
      encryptedKey: null,
    };

    service = BuildCrmService(credential);
  });

  it("looks up existing contacts through the authenticated webhook URL", async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        result: [{ ID: "17", EMAIL: [{ VALUE: "customer@example.com" }] }, { ID: "18" }],
      })
    );

    await expect(
      service.getContacts({ emails: ["customer@example.com", "missing@example.com"] })
    ).resolves.toEqual([{ id: "17", email: "customer@example.com" }]);
    expect(fetchMock).toHaveBeenCalledWith(`${webhookUrl}/crm.contact.list.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: { EMAIL: ["customer@example.com", "missing@example.com"] },
        select: ["ID", "EMAIL"],
      }),
    });
  });

  it("creates a missing contact with its email and phone", async () => {
    fetchMock.mockResolvedValueOnce(response({ result: [] }));
    fetchMock.mockResolvedValueOnce(response({ result: 19 }));

    await expect(service.getContacts({ emails: "new@example.com" })).resolves.toEqual([]);
    await expect(
      service.createContacts([{ name: "New Customer", email: "new@example.com", phone: "+15550100" }])
    ).resolves.toEqual([{ id: "19", email: "new@example.com" }]);
    expect(fetchMock).toHaveBeenLastCalledWith(`${webhookUrl}/crm.contact.add.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          NAME: "New Customer",
          EMAIL: [{ VALUE: "new@example.com", VALUE_TYPE: "WORK" }],
          PHONE: [{ VALUE: "+15550100", VALUE_TYPE: "WORK" }],
        },
      }),
    });
  });

  it("creates, updates, and deletes an event using the returned remote ID", async () => {
    const event = createEvent();
    fetchMock.mockResolvedValueOnce(response({ result: { ID: 42 } }));
    fetchMock.mockResolvedValueOnce(response({ result: [] }));
    fetchMock.mockResolvedValueOnce(response({ result: 501 }));
    fetchMock.mockResolvedValueOnce(response({ result: true }));
    fetchMock.mockResolvedValueOnce(response({ result: true }));

    await expect(service.createEvent(event, [])).resolves.toEqual({
      id: "501",
      uid: "501",
      type: "bitrix24",
      password: "",
      url: "",
      additionalInfo: { bookingUid: "booking-123" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${webhookUrl}/calendar.event.add.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user",
        ownerId: "42",
        name: "Customer consultation",
        description: "[cal.com booking:booking-123]\n\nDiscuss implementation",
        from: "2026-08-03T10:00:00.000Z",
        to: "2026-08-03T10:30:00.000Z",
        skipTime: false,
        isMeeting: false,
      }),
    });

    await expect(service.updateEvent("501", event)).resolves.toEqual({ id: "501", uid: "501" });
    expect(fetchMock).toHaveBeenNthCalledWith(4, `${webhookUrl}/calendar.event.update.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "501",
        type: "user",
        ownerId: "42",
        name: "Customer consultation",
        description: "[cal.com booking:booking-123]\n\nDiscuss implementation",
        from: "2026-08-03T10:00:00.000Z",
        to: "2026-08-03T10:30:00.000Z",
        skipTime: false,
        isMeeting: false,
      }),
    });

    await expect(service.deleteEvent("501", event)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(5, `${webhookUrl}/calendar.event.delete.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user", ownerId: "42", id: "501" }),
    });
  });

  it("reuses an existing event for the same booking identity", async () => {
    const event = createEvent();
    fetchMock.mockResolvedValueOnce(response({ result: { ID: "42" } }));
    fetchMock.mockResolvedValueOnce(response({ result: [] }));
    fetchMock.mockResolvedValueOnce(response({ result: "501" }));
    fetchMock.mockResolvedValueOnce(
      response({ result: [{ ID: "501", DESCRIPTION: "[cal.com booking:booking-123]" }] })
    );

    await service.createEvent(event, []);
    await expect(service.createEvent(event, [])).resolves.toMatchObject({ id: "501", uid: "501" });

    const addRequests = fetchMock.mock.calls.filter(
      ([url]) => url === `${webhookUrl}/calendar.event.add.json`
    );
    expect(addRequests).toHaveLength(1);
    expect(fetchMock).toHaveBeenLastCalledWith(`${webhookUrl}/calendar.event.get.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user",
        ownerId: "42",
        from: event.startTime,
        to: event.endTime,
      }),
    });
  });

  it("classifies retryable Bitrix24 API errors", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ error: "QUERY_LIMIT_EXCEEDED", error_description: "Too many requests" })
    );

    await expect(service.getContacts({ emails: "customer@example.com" })).rejects.toBeInstanceOf(
      RetryableError
    );
  });
});
