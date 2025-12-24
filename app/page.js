"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from('events').select('*');
      setEvents(data || []);
    };
    fetchEvents();
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 py-10"
      >
        <h1 className="text-6xl font-extrabold text-gray-900 tracking-tight">
          Find your <span className="text-lumina-500">spark.</span>
        </h1>
        <div className="relative max-w-xl mx-auto mt-8">
          <input 
            type="text" placeholder="Search events..."
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-white shadow-lg border-none outline-none focus:ring-2 focus:ring-lumina-500"
          />
          <Search className="absolute left-4 top-4 text-gray-400" />
        </div>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {events.map((event) => (
          <Link key={event.id} href={`/events/${event.id}`}>
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100"
            >
              <div className="h-48 bg-gray-200 relative">
                <img src={event.image_url || "https://placehold.co/600x400"} alt={event.title} className="w-full h-full object-cover"/>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800">{event.title}</h3>
                <p className="text-lumina-600 font-medium mt-1">GHS {event.price}</p>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm text-gray-500">{event.date}</span>
                  <button className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold">Buy Ticket</button>
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
