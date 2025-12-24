"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Zap, Ticket, Calendar, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getEvents() {
      try {
        // We select everything but REMOVE the .eq() filter that was causing the 400 error
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;
        setEvents(data || []);
      } catch (e) {
        console.error("Database mismatch - check if columns exist:", e.message);
        // Fallback: This ensures you see STYLES even if the DB is empty/broken
        setEvents([{ id: 'test', title: 'Example Event', price: 0, date: new Date().toISOString() }]);
      } finally {
        setLoading(false);
      }
    }
    getEvents();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Test Bar: If this is RED, Tailwind is working */}
      <div className="h-1 w-full bg-red-600 fixed top-0 z-[100]" />

      <section className="text-center py-20 space-y-4">
        <h1 className="text-7xl font-black tracking-tighter text-slate-900">
          LUMINA<span className="text-lumina-500">.</span>
        </h1>
        <p className="text-slate-500 font-medium">Premium Event Access</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-6 max-w-7xl mx-auto">
        {events.map((event) => (
          <div key={event.id} className="glass-card p-6 flex flex-col gap-4">
            <div className="h-48 bg-lumina-100 rounded-2xl overflow-hidden relative">
               <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded-full text-[10px] font-bold">LIVE</div>
               {event.images?.[0] && <img src={event.images[0]} className="w-full h-full object-cover" />}
            </div>
            <h2 className="text-xl font-bold">{event.title}</h2>
            <p className="text-lumina-600 font-black">GHS {event.price}</p>
            <Link href={`/events/${event.id}`} className="bg-slate-900 text-white text-center py-3 rounded-xl font-bold text-xs uppercase tracking-widest">
              View Event
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
