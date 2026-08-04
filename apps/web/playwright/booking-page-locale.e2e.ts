import { prisma } from "@calcom/prisma";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";

test.describe.configure({ mode: "serial" });

const expectCalendarAlignment = async ({
  page,
  firstHeading,
  weekStart,
}: {
  page: Page;
  firstHeading: string;
  weekStart: number;
}) => {
  const selectedMonth = page.getByTestId("selected-month-label");
  await expect(selectedMonth).toBeVisible();

  const dateTime = await selectedMonth.getAttribute("datetime");
  if (!dateTime) throw new Error("Expected the selected month to expose its date");

  const headingGrid = page.locator(".grid-cols-7").first();
  await expect(headingGrid.locator(":scope > div").first()).toHaveText(firstHeading);

  // Do NOT assume the grid starts at day 1. From roughly mid-month the main
  // monthly view takes the `showNextMonthDays` branch in
  // packages/features/calendars/components/DatePicker.tsx and starts at day 8,
  // which would make a hard-coded "1" assertion fail for half of every month.
  // Read whichever day is rendered first and check ITS column instead.
  const firstDate = page.getByTestId("day").first();
  const firstDateColumn = await firstDate.evaluate((element) => {
    const dateCell = element.parentElement;
    return dateCell?.parentElement ? Array.from(dateCell.parentElement.children).indexOf(dateCell) : -1;
  });
  const firstDateText = (await firstDate.textContent())?.trim();
  if (!firstDateText || !/^\d+$/.test(firstDateText)) {
    throw new Error(`Expected the first rendered day to be a date number, got ${firstDateText}`);
  }
  const firstRenderedWeekday = new Date(`${dateTime}-${firstDateText.padStart(2, "0")}T12:00:00Z`).getUTCDay();

  expect(firstDateColumn).toBe((firstRenderedWeekday - weekStart + 7) % 7);
};

for (const scenario of [
  { locale: "en-US", firstHeading: "Sun", weekStart: 0 },
  { locale: "en-GB", firstHeading: "Mon", weekStart: 1 },
] as const) {
  test.describe(`public booking page under ${scenario.locale}`, () => {
    test.use({ locale: scenario.locale, timezoneId: "America/New_York" });

    test("uses the viewer locale despite the organizer preference", async ({ page, users }) => {
      const organizer = await users.create({ locale: "en-US", userFeatureFlags: [] });
      await prisma.user.update({
        where: { id: organizer.id },
        data: { weekStart: scenario.weekStart === 0 ? "Monday" : "Sunday" },
      });

      await page.goto(`/${organizer.username}/30-min?cal.tz=America%2FNew_York`);

      await expectCalendarAlignment({
        page,
        firstHeading: scenario.firstHeading,
        weekStart: scenario.weekStart,
      });
      await expect(page.getByTestId("timezone-select")).toContainText("New York");

      // Slot times depend on the seeded default schedule, so assert only that
      // selecting a day yields slots at all. The subject of this test is which
      // day the week starts on, not which hours the organizer is free.
      await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
      await expect(page.getByTestId("time").first()).toBeVisible();
    });
  });
}
