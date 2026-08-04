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

  const firstDate = page.getByTestId("day").first();
  const firstDateColumn = await firstDate.evaluate((element) => {
    const dateCell = element.parentElement;
    return dateCell?.parentElement ? Array.from(dateCell.parentElement.children).indexOf(dateCell) : -1;
  });
  const firstDayOfMonth = new Date(`${dateTime}-01T12:00:00Z`).getUTCDay();

  await expect(firstDate).toHaveText("1");
  expect(firstDateColumn).toBe((firstDayOfMonth - weekStart + 7) % 7);
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

      await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
      await expect(page.getByTestId("time").first()).toHaveText(/^(0?4|0?5):00/);
    });
  });
}
