"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface CalendarEvent {
  id: string
  date: string
  title: string
  time: string
  reminder: boolean
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formData, setFormData] = useState({ title: "", time: "09:00", reminder: false })
  const [error, setError] = useState<string | null>(null)

  const STORAGE_KEY = "tans-agents:calendar-events-v1"

  // Load events from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setEvents(JSON.parse(stored))
      } catch {
        setEvents([])
      }
    }
  }, [])

  // Save events to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }, [events])

  function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  function getFirstDayOfMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  function formatDate(date: Date): string {
    return date.toISOString().split("T")[0]
  }

  function getMonthName(date: Date): string {
    return date.toLocaleString("vi-VN", { month: "long", year: "numeric" })
  }

  function previousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  function getEventsForDate(dateStr: string): CalendarEvent[] {
    return events.filter((e) => e.date === dateStr)
  }

  function hasEvents(dateStr: string): boolean {
    return events.some((e) => e.date === dateStr)
  }

  function openAddEvent(dateStr: string) {
    setSelectedDate(dateStr)
    setFormData({ title: "", time: "09:00", reminder: false })
    setShowAddEvent(true)
    setError(null)
  }

  function closeAddEvent() {
    setShowAddEvent(false)
    setSelectedDate(null)
    setFormData({ title: "", time: "09:00", reminder: false })
  }

  function addEvent() {
    if (!selectedDate || !formData.title.trim()) {
      setError("Vui lòng nhập tiêu đề sự kiện")
      return
    }

    const newEvent: CalendarEvent = {
      id: `${Date.now()}-${Math.random()}`,
      date: selectedDate,
      title: formData.title.trim(),
      time: formData.time,
      reminder: formData.reminder,
    }

    setEvents([...events, newEvent])
    closeAddEvent()
  }

  function deleteEvent(eventId: string) {
    setEvents(events.filter((e) => e.id !== eventId))
  }

  function exportToICS() {
    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Tans Agents//Calendar//EN",
      "CALSCALE:GREGORIAN",
    ]

    events.forEach((event) => {
      const [year, month, day] = event.date.split("-")
      const [hours, minutes] = event.time.split(":")
      const dtStart = `${year}${month}${day}T${hours}${minutes}00`

      icsLines.push("BEGIN:VEVENT")
      icsLines.push(`UID:${event.id}@tans-agents.local`)
      icsLines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`)
      icsLines.push(`DTSTART:${dtStart}`)
      icsLines.push(`DTEND:${dtStart.slice(0, -2)}59`)
      icsLines.push(`SUMMARY:${event.title}`)
      if (event.reminder) {
        icsLines.push("BEGIN:VALARM")
        icsLines.push("ACTION:DISPLAY")
        icsLines.push("TRIGGER:-PT30M")
        icsLines.push(`DESCRIPTION:${event.title}`)
        icsLines.push("END:VALARM")
      }
      icsLines.push("END:VEVENT")
    })

    icsLines.push("END:VCALENDAR")

    const icsContent = icsLines.join("\r\n")
    const element = document.createElement("a")
    element.setAttribute("href", "data:text/calendar;charset=utf-8," + encodeURIComponent(icsContent))
    element.setAttribute("download", `calendar-${formatDate(new Date())}.ics`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const calendarDays = Array(firstDay)
    .fill(null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Event Manager</p>
              <h1 className="text-2xl font-semibold tracking-tight">Lịch & Sự kiện</h1>
              <p className="mt-1 text-sm text-muted-foreground">Quản lý sự kiện với lịch tháng</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={exportToICS} disabled={events.length === 0} size="sm">
                📥 Xuất .ICS
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Calendar Grid */}
          <section className="rounded-lg border bg-card p-4 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{getMonthName(currentDate)}</h2>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={previousMonth} size="sm">
                  ← Trước
                </Button>
                <Button type="button" variant="outline" onClick={nextMonth} size="sm">
                  Sau →
                </Button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-7 gap-2">
              {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-semibold">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const dateStr = day ? formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day)) : ""
                const hasEvent = day ? hasEvents(dateStr) : false

                return (
                  <div
                    key={idx}
                    onClick={() => day && openAddEvent(dateStr)}
                    className={`relative min-h-16 rounded border p-2 text-sm cursor-pointer transition-colors ${
                      !day
                        ? "bg-muted"
                        : hasEvent
                          ? "border-primary bg-primary/5 hover:bg-primary/10"
                          : "border-border hover:bg-accent"
                    }`}
                  >
                    {day && (
                      <>
                        <div className="font-semibold">{day}</div>
                        {hasEvent && <div className="mt-1 h-2 w-2 rounded-full bg-primary" />}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Events Sidebar */}
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Danh sách sự kiện</h2>

            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có sự kiện nào.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {events.map((event) => (
                  <div key={event.id} className="flex flex-col gap-1 rounded border border-border bg-background p-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium">{event.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(event.date + "T00:00:00").toLocaleDateString("vi-VN")} • {event.time}
                        </div>
                        {event.reminder && <div className="text-xs text-amber-600">🔔 Nhắc nhở</div>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => deleteEvent(event.id)}
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Add Event Modal */}
        {showAddEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <section className="w-full max-w-md rounded-lg border bg-card p-4 shadow-lg">
              <h2 className="mb-4 text-lg font-semibold">Thêm sự kiện</h2>

              {error && <div className="mb-3 rounded border border-destructive bg-destructive/10 p-2 text-sm text-destructive">{error}</div>}

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Ngày</label>
                  <div className="mt-1 rounded border bg-background p-2 text-sm">{selectedDate}</div>
                </div>

                <div>
                  <label htmlFor="event-title" className="text-sm font-medium">
                    Tiêu đề sự kiện
                  </label>
                  <input
                    id="event-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value })
                      setError(null)
                    }}
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                    placeholder="Nhập tiêu đề..."
                  />
                </div>

                <div>
                  <label htmlFor="event-time" className="text-sm font-medium">
                    Thời gian
                  </label>
                  <input
                    id="event-time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="event-reminder"
                    type="checkbox"
                    checked={formData.reminder}
                    onChange={(e) => setFormData({ ...formData, reminder: e.target.checked })}
                    className="rounded border border-input"
                  />
                  <label htmlFor="event-reminder" className="text-sm font-medium">
                    🔔 Bật nhắc nhở
                  </label>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button type="button" onClick={addEvent} className="flex-1">
                  Thêm sự kiện
                </Button>
                <Button type="button" variant="secondary" onClick={closeAddEvent} className="flex-1">
                  Hủy
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
