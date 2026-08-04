import dayjs from "@calcom/dayjs";
import { BookerStoreProvider } from "@calcom/features/bookings/Booker/BookerStoreProvider";
import { PeriodType } from "@calcom/prisma/enums";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, vi } from "vitest";
import { DatePicker, getWeekStartForLocale } from "../components/DatePicker";

const noop = () => {
  /* noop */
};

describe("Tests for DatePicker Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("normalizes the Intl Sunday value to the calendar's zero-based index", () => {
    expect(getWeekStartForLocale("en-US")).toBe(0);
  });

  test("supports the Intl getWeekInfo method", () => {
    vi.spyOn(Intl, "Locale").mockImplementation(function Locale() {
      return {
        getWeekInfo: () => ({ firstDay: 6 }),
      } as unknown as Intl.Locale;
    } as typeof Intl.Locale);

    expect(getWeekStartForLocale("en-US")).toBe(6);
  });

  test("falls back to Sunday when Intl locale week information is invalid", () => {
    expect(getWeekStartForLocale("not-a-valid_locale")).toBe(0);
  });

  const renderWeekdayHeadings = ({
    viewerLocale,
    weekStart,
  }: {
    viewerLocale: string;
    weekStart?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  }) => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue(viewerLocale);
    const result = render(
      <BookerStoreProvider>
        <TooltipProvider>
          <DatePicker
            onChange={noop}
            browsingDate={dayjs("2024-01-01")}
            locale="en-US"
            weekStart={weekStart}
          />
        </TooltipProvider>
      </BookerStoreProvider>
    );

    const headingGrid = result.container.querySelector(".grid-cols-7");
    if (!headingGrid) throw new Error("Expected the weekday heading grid");
    return headingGrid;
  };

  test.each([
    ["en-US", "Sun"],
    ["en-GB", "Mon"],
  ])("starts the calendar using the %s viewer locale", async (viewerLocale, firstHeading) => {
    const headingGrid = renderWeekdayHeadings({ viewerLocale });
    await waitFor(() => expect(headingGrid.children[0]).toHaveTextContent(firstHeading));
  });

  test("keeps an explicit week start authoritative over the viewer locale", async () => {
    const headingGrid = renderWeekdayHeadings({ viewerLocale: "en-GB", weekStart: 2 });
    await waitFor(() => expect(headingGrid.children[0]).toHaveTextContent("Tue"));
  });

  test("Should render correctly with default date", async () => {
    const testDate = dayjs("2024-02-20");
    const { getByTestId } = render(
      <BookerStoreProvider>
        <TooltipProvider>
          <DatePicker
            onChange={noop}
            browsingDate={testDate}
            locale="en"
            periodData={{
              periodType: PeriodType.UNLIMITED,
              periodDays: null,
              periodCountCalendarDays: false,
              periodStartDate: null,
              periodEndDate: null,
            }}
          />
        </TooltipProvider>
      </BookerStoreProvider>
    );

    const selectedMonthLabel = getByTestId("selected-month-label");
    await expect(selectedMonthLabel).toHaveAttribute("dateTime", testDate.format("YYYY-MM"));
  });

  test("Should render with the minimum date if browsingDate < minDate", async () => {
    const testDate = dayjs("2024-02-20");
    const minDate = dayjs("2025-02-10");
    const { getByTestId } = render(
      <BookerStoreProvider>
        <TooltipProvider>
          <DatePicker onChange={noop} browsingDate={testDate} minDate={minDate.toDate()} locale="en" />
        </TooltipProvider>
      </BookerStoreProvider>
    );

    const selectedMonthLabel = getByTestId("selected-month-label");
    await expect(selectedMonthLabel).toHaveAttribute("dateTime", minDate.format("YYYY-MM"));
  });

  test("Should render with the browsingDate date if browsingDate >= minDate", async () => {
    const testDate = dayjs("2025-03-20");
    const minDate = dayjs("2025-02-10");
    const { getByTestId } = render(
      <BookerStoreProvider>
        <TooltipProvider>
          <DatePicker onChange={noop} browsingDate={testDate} minDate={minDate.toDate()} locale="en" />
        </TooltipProvider>
      </BookerStoreProvider>
    );

    const selectedMonthLabel = getByTestId("selected-month-label");
    await expect(selectedMonthLabel).toHaveAttribute("dateTime", testDate.format("YYYY-MM"));
  });

  describe("End-of-Month UI Improvements", () => {
    const createMockSlots = (dates: string[]) => {
      const slots: Record<string, { time: string; userIds?: number[] }[]> = {};
      dates.forEach((date) => {
        slots[date] = [{ time: `${date}T10:00:00` }];
      });
      return slots;
    };

    test("Should show traditional calendar view before second week of month", async () => {
      // Set test date to early in month (January 10th, 2024)
      const earlyMonthDate = dayjs("2024-01-10");

      // Mock current date to also be early in month so isSecondWeekOver is false
      vi.useFakeTimers();
      vi.setSystemTime(earlyMonthDate.toDate());

      const slots = createMockSlots([
        "2024-01-15", // Available date in current month
        "2024-01-20",
      ]);

      const { getAllByTestId } = render(
        <BookerStoreProvider>
          <TooltipProvider>
            <DatePicker
              onChange={noop}
              browsingDate={earlyMonthDate}
              locale="en"
              slots={slots}
              isCompact={false}
              periodData={{
                periodType: PeriodType.UNLIMITED,
                periodDays: null,
                periodCountCalendarDays: false,
                periodStartDate: null,
                periodEndDate: null,
              }}
            />
          </TooltipProvider>
        </BookerStoreProvider>
      );

      const dayElements = getAllByTestId("day");

      // Should show full month starting from day 1
      const firstAvailableDay = dayElements.find((day) => day.textContent && day.textContent.trim() !== "");
      expect(firstAvailableDay?.textContent).toBe("1");

      vi.useRealTimers();
    });

    test("Should show end-of-month view after second week (monthly view)", async () => {
      // Mock current date to ensure we're after second week
      const mockDate = dayjs("2024-01-20");
      vi.useFakeTimers();
      vi.setSystemTime(mockDate.toDate());

      const lateMonthDate = dayjs("2024-01-20");

      const slots = createMockSlots([
        "2024-01-25", // Available in current month
        "2024-02-01", // Available in next month
        "2024-02-05",
      ]);

      const { getAllByTestId, queryByText } = render(
        <BookerStoreProvider>
          <TooltipProvider>
            <DatePicker
              onChange={noop}
              browsingDate={lateMonthDate}
              locale="en"
              slots={slots}
              isCompact={false}
              periodData={{
                periodType: PeriodType.UNLIMITED,
                periodDays: null,
                periodCountCalendarDays: false,
                periodStartDate: null,
                periodEndDate: null,
              }}
            />
          </TooltipProvider>
        </BookerStoreProvider>
      );

      const dayElements = getAllByTestId("day");

      const firstAvailableDay = dayElements.find((day) => day.textContent && day.textContent.trim() !== "");

      // Should show days from day 8 onwards of current month (the main change in end-of-month view)
      expect(firstAvailableDay?.textContent).toBe("8");

      // Should show next month days (February days when browsing January)
      // In end-of-month view, the first day of next month gets a month label
      const febLabel = queryByText("Feb");
      expect(febLabel).toBeTruthy();

      vi.useRealTimers();
    });

    test("Should show traditional view when compact=true (not monthly view) even after second week", async () => {
      const lateMonthDate = dayjs("2024-01-20");
      const slots = createMockSlots(["2024-01-25", "2024-02-01"]);

      const { getAllByTestId } = render(
        <BookerStoreProvider>
          <TooltipProvider>
            <DatePicker
              onChange={noop}
              browsingDate={lateMonthDate}
              locale="en"
              slots={slots}
              isCompact={true} // This should force traditional view
              periodData={{
                periodType: PeriodType.UNLIMITED,
                periodDays: null,
                periodCountCalendarDays: false,
                periodStartDate: null,
                periodEndDate: null,
              }}
            />
          </TooltipProvider>
        </BookerStoreProvider>
      );

      const dayElements = getAllByTestId("day");

      // Should show day 1 even in compact mode after second week
      const firstDayOfMonth = dayElements.find((day) => day.textContent === "1");
      expect(firstDayOfMonth).toBeTruthy();
    });
  });
});
