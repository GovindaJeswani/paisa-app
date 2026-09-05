"use client";

import { MoneyCalendar } from "@/components/calendar/money-calendar";

export default function CalendarPage() {
  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      <MoneyCalendar />
    </div>
  );
}
