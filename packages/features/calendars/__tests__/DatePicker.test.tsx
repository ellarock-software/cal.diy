import dayjs from "@calcom/dayjs";
import { BookerStoreProvider } from "@calcom/features/bookings/Booker/BookerStoreProvider";
import { PeriodType } from "@calcom/prisma/enums";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, vi } from "vitest";
import { DatePicker, getWeekStartForLocale, resolveViewerLocale } from "../components/DatePicker";

const noop = () => {
  /* noop */
};

describe("Tests for DatePicker Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stubWeekInfo = (weekInfo: unknown) => {
    vi.spyOn(Intl, "Locale").mockImplementation(function Locale() {
      return { getWeekInfo: () => weekInfo } as unknown as Intl.Locale;
    } as typeof Intl.Locale);
  };

  test("normalizes the Intl Sunday value to the calendar's zero-based index", () => {
    expect(getWeekStartForLocale("en-US")).toBe(0);
  });

  // Intl reports firstDay as 1=Monday..7=Sunday; the calendar index is
  // 0=Sunday..6=Saturday. Pin the whole mapping, not just the two locales the
  // rendering tests happen to cover.
  test.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
    [6, 6],
    [7, 0],
  ])("maps Intl firstDay %i onto calendar week start %i", (firstDay, expected) => {
    stubWeekInfo({ firstDay });
    expect(getWeekStartForLocale("en-US")).toBe(expected);
  });

  test("supports the Intl getWeekInfo method", () => {
    stubWeekInfo({ firstDay: 6 });
    expect(getWeekStartForLocale("en-US")).toBe(6);
  });

  // The range guard, distinct from the constructor-throws path below.
  // `0` alone cannot discriminate the `firstDay < 1` half of the guard: 0 % 7
  // is 0, the same value as the fallback, so a negative case is required to
  // make deleting that clause fail.
  test.each([
    ["undefined", undefined],
    ["out-of-range low", 0],
    ["negative", -1],
    ["negative multiple of seven", -7],
    ["out-of-range high", 8],
    ["non-integer", 3.5],
  ])("falls back to Sunday for an %s firstDay", (_label, firstDay) => {
    stubWeekInfo({ firstDay });
    expect(getWeekStartForLocale("en-US")).toBe(0);
  });

  test("falls back to Sunday when the locale itself is absent from week info", () => {
    stubWeekInfo(undefined);
    expect(getWeekStartForLocale("en-US")).toBe(0);
  });

  test("falls back to Sunday when constructing the Intl locale throws", () => {
    // `new Intl.Locale("not-a-valid_locale")` throws RangeError, so this
    // exercises the catch, not the week-info range guard above.
    expect(() => new Intl.Locale("not-a-valid_locale")).toThrow();
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

  test("resolveViewerLocale reads the browser locale", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-GB");
    expect(resolveViewerLocale("en-US")).toBe("en-GB");
  });

  test("resolveViewerLocale falls back to the passed locale when the browser reports none", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("");
    expect(resolveViewerLocale("en-US")).toBe("en-US");
  });

  // This component IS server-rendered on the public booking page, so the server
  // pass and the hydration render must agree. weekStart drives both the header
  // order and the count of leading null cells, so resolving navigator.language
  // during render would be a structural hydration mismatch, not a text diff.
  // Browsing a future month keeps `showNextMonthDays` false on every calendar
  // date, so the day Tooltip's portal never blocks renderToString here.
  test("the server pass follows the passed locale, not the browser locale", async () => {
    const { renderToString } = await import("react-dom/server");
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-GB");

    const markup = renderToString(
      <BookerStoreProvider>
        <DatePicker
          onChange={noop}
          browsingDate={dayjs().add(2, "month").startOf("month")}
          locale="en-US"
        />
      </BookerStoreProvider>
    );

    const headings = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .map((day) => [day, markup.indexOf(`>${day}<`)] as const)
      .filter(([, index]) => index >= 0)
      .sort((a, b) => a[1] - b[1]);
    expect(headings[0]?.[0]).toBe("Sun");
  });

  test("reads the Intl weekInfo accessor when getWeekInfo is unavailable", () => {
    vi.spyOn(Intl, "Locale").mockImplementation(function Locale() {
      return { weekInfo: { firstDay: 1 } } as unknown as Intl.Locale;
    } as typeof Intl.Locale);
    expect(getWeekStartForLocale("en-GB")).toBe(1);
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
