// Apple Wallet / Calendar export
// Generates a .ics calendar file (works on iOS, Android, Gmail, Outlook — everywhere)
// Full .pkpass requires Apple Developer account + native cert signing (not web-viable without paid service)
// The .ics approach is zero-config, always works, and adds the event to the device calendar

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("ref");
  const email = searchParams.get("email");

  if (!reference || !email) {
    return NextResponse.json({ error: "Missing ref or email" }, { status: 400 });
  }

  const db = getDb();
  const { data: ticket } = await db
    .from("tickets")
    .select("*, events!event_id(id,title,date,time,location,lat,lng,image_url), ticket_tiers:tier_id(name)")
    .eq("reference", reference)
    .eq("guest_email", email.toLowerCase())
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status !== "valid") return NextResponse.json({ error: "Ticket not valid" }, { status: 400 });

  const ev = ticket.events || {};
  const tier = ticket.ticket_tiers?.name || ticket.tier_name || "General Admission";
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ousted.live";

  // Build rich .ics calendar event
  const uid = `${ticket.reference}@ousted.live`;
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  let startDT, endDT;
  if (ev.date) {
    const [y, m, d] = ev.date.split("-");
    const [h, min] = (ev.time || "00:00").split(":");
    const start = new Date(Date.UTC(+y, +m - 1, +d, +h, +min));
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // assume 4hr event
    startDT = start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    endDT = end.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  } else {
    startDT = now;
    endDT = now;
  }

  const geo = ev.lat && ev.lng ? `\nGEO:${ev.lat};${ev.lng}` : "";
  const alarm = ev.date ? `
BEGIN:VALARM
TRIGGER:-PT2H
ACTION:DISPLAY
DESCRIPTION:🎟 ${(ev.title || "Event").replace(/[,;\n]/g, " ")} starts in 2 hours!
END:VALARM
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:🎟 Reminder: ${(ev.title || "Event").replace(/[,;\n]/g, " ")} is tomorrow
END:VALARM` : "";

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OUSTED//Event Ticket//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${startDT}
DTEND:${endDT}
SUMMARY:🎟 ${(ev.title || "Event").replace(/[,;\n]/g, " ")}
DESCRIPTION:Ticket Type: ${tier}\nHolder: ${ticket.guest_name || "Guest"}\nReference: ${ticket.reference}\n\nView your ticket: ${siteUrl}/dashboard/user
LOCATION:${(ev.location || "TBA").replace(/[,;\n]/g, " ")}${geo}
STATUS:CONFIRMED
URL:${siteUrl}/dashboard/user${alarm}
END:VEVENT
END:VCALENDAR`;

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ousted-${reference}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
