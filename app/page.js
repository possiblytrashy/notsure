"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, MapPin, Ticket, Zap } from 'lucide-react';
import Link from 'next/link';
import './globals.css'

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .order('date', { ascending: true });
      setEvents(data || []);
      setLoading(false);
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
          <h1 className="text-7xl md:text-8xl font-black text-gray-900 tracking-tighter leading-none">
            LUMINA<span className="text-indigo-600">.</span>
          </h1>
        </motion.div>
        <p className="text-xl text-gray-500 font-medium">Discover and book the city's most exclusive events.</p>
        
        <div className="relative mt-10">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-14 pr-6 py-5 rounded-3xl bg-white shadow-2xl shadow-indigo-100/50 border-none outline-none focus:ring-2 focus:ring-indigo-500 text-lg transition-all"
          />
          <Search className="absolute left-5 top-5 text-gray-400" size={24} />
        </div>
      </section>

      {/* Grid Section */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[1, 2, 3].map(i => <div key={i} className="h-[450px] bg-gray-100 animate-pulse rounded-[2.5rem]" />)}
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredEvents.map((event) => (
              <motion.div 
                layout
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                key={event.id}
              >
                <Link href={`/events/${event.id}`}>
                  <div className="group bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 h-full flex flex-col relative">
                    {/* Live Badge */}
                    <div className="absolute top-5 right-5 z-10 bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg uppercase tracking-widest">
                      <Zap size={10} fill="currentColor" /> Live
                    </div>

                    <div className="h-64 bg-indigo-50 relative overflow-hidden">
                      {event.images?.[0] ? (
                        <img 
                          src={event.images[0]} 
                          alt={event.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center">
                          <Ticket className="text-white/20" size={80} />
                        </div>
                      )}
                    </div>

                    <div className="p-8 flex flex-col flex-grow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-2xl font-black text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors">
                          {event.title}
                        </h3>
                      </div>
                      
                      <p className="text-indigo-600 font-black text-xl mb-4">GHS {event.price.toFixed(2)}</p>

                      <div className="space-y-2 mt-auto">
                        <div className="flex items-center text-gray-400 gap-2 text-sm font-bold uppercase tracking-tighter">
                          <Calendar size={14} />
                          {new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                        </div>
                        <div className="flex items-center text-gray-400 gap-2 text-sm font-bold uppercase tracking-tighter">
                          <MapPin size={14} />
                          {event.location || "Venue TBD"}
                        </div>
                      </div>

                      <button className="w-full mt-8 py-4 bg-gray-900 text-white rounded-2xl font-black group-hover:bg-indigo-600 transition-all shadow-xl shadow-gray-200 uppercase text-xs tracking-widest">
                        Secure Spot
                      </button>
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
