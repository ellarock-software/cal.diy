import { RetryableError } from "@calcom/lib/crmManager/errors";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import type { CalendarEvent } from "@calcom/types/Calendar";
import type { CredentialPayload } from "@calcom/types/Credential";
import type { Contact, ContactCreateInput, CRM, CrmEvent } from "@calcom/types/CrmService";
import { bitrix24CredentialSchema } from "../zod";

type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
};

type BitrixContact = {
  ID: string;
  EMAIL?: Array<{ VALUE: string }>;
};

type BitrixCalendarEvent = {
  ID: string | number;
  DESCRIPTION?: string;
};

const RETRYABLE_ERROR_CODES: Set<string> = new Set([
  "INTERNAL_SERVER_ERROR",
  "OPERATION_TIME_LIMIT",
  "QUERY_LIMIT_EXCEEDED",
]);

class Bitrix24CrmService implements CRM {
  private readonly webhookUrl: string;
  private ownerId?: string;

  constructor(credential: CredentialPayload) {
    const parsedCredential = bitrix24CredentialSchema.safeParse(credential.key);
    if (!parsedCredential.success) {
      throw new ErrorWithCode(ErrorCode.BadRequest, "Invalid Bitrix24 webhook URL");
    }

    this.webhookUrl = parsedCredential.data.webhookUrl.replace(/\/$/, "");
  }

  private async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.webhookUrl}/${method}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
    } catch (error) {
      throw new RetryableError(`Bitrix24 ${method} request failed: ${String(error)}`);
    }

    if (response.status === 429 || response.status >= 500) {
      throw new RetryableError(`Bitrix24 ${method} request failed with status ${response.status}`);
    }

    if (!response.ok) {
      throw new ErrorWithCode(
        ErrorCode.InternalServerError,
        `Bitrix24 ${method} request failed with status ${response.status}`
      );
    }

    const body = (await response.json()) as BitrixResponse<T>;
    if (body.error) {
      const message = `Bitrix24 ${method} failed: ${body.error_description ?? body.error}`;
      if (RETRYABLE_ERROR_CODES.has(body.error)) {
        throw new RetryableError(message);
      }
      throw new ErrorWithCode(ErrorCode.InternalServerError, message);
    }

    if (body.result === undefined) {
      throw new ErrorWithCode(ErrorCode.InternalServerError, `Bitrix24 ${method} returned no result`);
    }

    return body.result;
  }

  private async getOwnerId(): Promise<string> {
    if (this.ownerId) return this.ownerId;

    const profile = await this.request<{ ID: string | number }>("profile");
    this.ownerId = String(profile.ID);
    return this.ownerId;
  }

  private getBookingMarker(event: CalendarEvent): string {
    if (!event.uid) {
      throw new ErrorWithCode(ErrorCode.BadRequest, "A booking UID is required for Bitrix24 events");
    }
    return `[cal.com booking:${event.uid}]`;
  }

  private getEventFields(event: CalendarEvent, ownerId: string): Record<string, unknown> {
    const marker = this.getBookingMarker(event);
    const description = [marker, event.description ?? event.additionalNotes].filter(Boolean).join("\n\n");

    return {
      type: "user",
      ownerId,
      name: event.title,
      description,
      from: event.startTime,
      to: event.endTime,
      skipTime: false,
      isMeeting: false,
    };
  }

  private async findEvent(event: CalendarEvent, ownerId: string): Promise<BitrixCalendarEvent | undefined> {
    const marker = this.getBookingMarker(event);
    const events = await this.request<BitrixCalendarEvent[]>("calendar.event.get", {
      type: "user",
      ownerId,
      from: event.startTime,
      to: event.endTime,
    });
    return events.find((candidate) => candidate.DESCRIPTION?.includes(marker));
  }

  async createEvent(event: CalendarEvent, _contacts: Contact[]): Promise<CrmEvent> {
    const ownerId = await this.getOwnerId();
    const existingEvent = await this.findEvent(event, ownerId);
    let id: string;
    if (existingEvent) {
      id = String(existingEvent.ID);
    } else {
      id = String(
        await this.request<string | number>("calendar.event.add", this.getEventFields(event, ownerId))
      );
    }

    return {
      id,
      uid: id,
      type: "bitrix24",
      password: "",
      url: "",
      additionalInfo: { bookingUid: event.uid },
    };
  }

  async updateEvent(uid: string, event: CalendarEvent): Promise<CrmEvent> {
    const ownerId = await this.getOwnerId();
    await this.request("calendar.event.update", {
      id: uid,
      ...this.getEventFields(event, ownerId),
    });
    return { id: uid, uid };
  }

  async deleteEvent(uid: string): Promise<void> {
    const ownerId = await this.getOwnerId();
    await this.request("calendar.event.delete", { type: "user", ownerId, id: uid });
  }

  async getContacts({ emails }: { emails: string | string[] }): Promise<Contact[]> {
    const requestedEmails = Array.isArray(emails) ? emails : [emails];
    if (requestedEmails.length === 0) return [];

    const contacts = await this.request<BitrixContact[]>("crm.contact.list", {
      filter: { EMAIL: requestedEmails },
      select: ["ID", "EMAIL"],
    });

    return contacts.flatMap((contact) =>
      (contact.EMAIL ?? []).map(({ VALUE }) => ({ id: String(contact.ID), email: VALUE }))
    );
  }

  async createContacts(contactsToCreate: ContactCreateInput[]): Promise<Contact[]> {
    return Promise.all(
      contactsToCreate.map(async (contact) => {
        const fields: Record<string, unknown> = {
          NAME: contact.name,
          EMAIL: [{ VALUE: contact.email, VALUE_TYPE: "WORK" }],
        };
        if (contact.phone) {
          fields.PHONE = [{ VALUE: contact.phone, VALUE_TYPE: "WORK" }];
        }

        const id = await this.request<string | number>("crm.contact.add", {
          fields,
        });
        return { id: String(id), email: contact.email };
      })
    );
  }

  getAppOptions(): Record<string, never> {
    return {};
  }
}

export default function BuildCrmService(
  credential: CredentialPayload,
  _appOptions?: Record<string, unknown>
): CRM {
  return new Bitrix24CrmService(credential);
}
