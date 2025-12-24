"use client";
export const dynamic = 'force-dynamic'; // Prevents pre-render errors

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, MapPin, Ticket, Zap } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

 useEffect(() => {
    const fetchEvents = async () => {
      try {
        // REMOVED .eq('is_active', true) because the column is missing in your DB
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('date', { ascending: true });
        
        if (error) {
          console.error("Supabase Error:", error.message);
          // Set dummy data so you can at least see the UI working
          setEvents([{ id: 1, title: "Test Event", price: 0, date: new Date() }]);
        } else {
          setEvents(data || []);
        }
      } catch (err) {
        console.error("Connection Error:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const filteredEvents = events.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-16 min-h-screen">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <h1 className="text-7xl md:text-8xl font-black text-slate-900 tracking-tighter leading-none">
            LUMINA<span className="text-lumina-500">.</span>
          </h1>
        </motion.div>
        <p className="text-xl text-slate-500 font-medium italic">Premium experiences, curated for you.</p>
        <div className="fixed top-0 left-0 w-full h-2 bg-red-600 z-[9999]">Tailwind Test</div>
        <div className="relative mt-10">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-white/60 backdrop-blur-md border border-white/40 shadow-2xl focus:ring-2 focus:ring-lumina-500 outline-none transition-all text-lg"
          />
          <Search className="absolute left-6 top-5 text-lumina-500" size={24} />
        </div>
      </section>

      {/* Grid Section */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[1, 2, 3].map(i => <div key={i} className="h-[450px] bg-white/40 glass-card animate-pulse" />)}
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredEvents.map((event) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                key={event.id}
                className="glass-card group flex flex-col h-full overflow-hidden"
              >
                <Link href={`/events/${event.id}`} className="flex flex-col h-full">
                  {/* Image Container */}
                  <div className="h-64 relative overflow-hidden bg-lumina-100">
                    <div className="absolute top-5 right-5 z-10 bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg uppercase tracking-widest">
                      <Zap size={10} fill="currentColor" /> Live
                    </div>

                    {event.images?.[0] ? (
                      <img 
                        src={event.images[0]} 
                        alt={event.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-lumina-500 to-accent-purple flex items-center justify-center">
                        <Ticket className="text-white/20" size={80} />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-8 flex flex-col flex-grow">
                    <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-lumina-600 transition-colors">
                      {event.title}
                    </h3>
                    
                    <p className="text-lumina-600 font-black text-xl mt-2 mb-6">GHS {event.price.toFixed(2)}</p>

                    <div className="space-y-3 mt-auto border-t border-white/20 pt-6">
                      <div className="flex items-center text-slate-500 gap-2 text-sm font-bold uppercase tracking-tighter">
                        <Calendar size={14} className="text-lumina-500" />
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </div>
                      <div className="flex items-center text-slate-500 gap-2 text-sm font-bold uppercase tracking-tighter">
                        <MapPin size={14} className="text-lumina-500" />
                        {event.location || "Secret Venue"}
                      </div>
                    </div>

                    <div className="mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-center group-hover:bg-lumina-600 transition-all shadow-xl uppercase text-xs tracking-widest">
                      Secure Spot
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
