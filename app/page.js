"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Search, Calendar, MapPin, Ticket } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 max-w-3xl mx-auto"
      >
        <h1 className="text-7xl font-black text-gray-900 tracking-tight leading-none">
          Find your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-500">spark.</span>
        </h1>
        <p className="text-xl text-gray-500 font-medium">The most premium experiences in the city, curated for you.</p>
        
        <div className="relative mt-10">
          <input 
            type="text" placeholder="Search for events, concerts, or venues..."
            className="w-full pl-14 pr-6 py-5 rounded-3xl bg-white shadow-2xl shadow-indigo-100 border-none outline-none focus:ring-2 focus:ring-indigo-500 text-lg"
          />
          <Search className="absolute left-5 top-5 text-gray-400" size={24} />
        </div>
      </motion.div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[1, 2, 3].map(i => <div key={i} className="h-96 bg-gray-100 animate-pulse rounded-[2.5rem]" />)}
        </div>
      ) : events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <motion.div 
                whileHover={{ y: -10 }}
                className="group bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 h-full flex flex-col"
              >
                {/* Image Section */}
                <div className="h-64 bg-indigo-50 relative overflow-hidden">
                  {event.images?.[0] ? (
                    <img 
                      src={event.images[0]} 
                      alt={event.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Ticket className="text-white/20" size={80} />
                    </div>
                  )}
                  <div className="absolute top-5 left-5 bg-white/90 backdrop-blur px-4 py-2 rounded-2xl font-black text-sm text-indigo-600 shadow-sm">
                    GHS {event.price}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-8 flex flex-col flex-grow">
                  <h3 className="text-2xl font-black text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors">
                    {event.title}
                  </h3>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center text-gray-500 gap-2 text-sm font-semibold">
                      <Calendar size={16} className="text-indigo-400" />
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center text-gray-500 gap-2 text-sm font-semibold">
                      <MapPin size={16} className="text-indigo-400" />
                      {event.location || "Secret Venue"}
                    </div>
                  </div>

                  <div className="mt-8">
                    <button className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold group-hover:bg-indigo-600 transition-all shadow-lg shadow-gray-200">
                      Book Now
                    </button>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400 font-bold text-xl uppercase tracking-widest">No events live right now.</p>
          <p className="text-gray-400 text-sm mt-2">Check back in a few hours!</p>
        </div>
      )}
    </div>
  );
}
