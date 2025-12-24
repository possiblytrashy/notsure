"use client";
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Download, Ticket } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
// ... rest of your code
export default function SuccessPage() {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestTicket = async () => {
      // In a real scenario, you'd pass the ticket hash or email via URL params
      // For this example, we fetch the most recent ticket created
      const { data, error } = await supabase
        .from('tickets')
        .select('*, events(title, location, date)')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) setTicket(data);
      setLoading(false);
    };

    fetchLatestTicket();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 py-12">
      {/* Success Animation */}
      <motion.div 
        initial={{ scale: 0, rotate: -180 }} 
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200"
      >
        <CheckCircle className="w-10 h-10 text-white" />
      </motion.div>

      <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Got it! You're in.</h1>
      <p className="text-gray-500 mb-10 max-w-sm">
        Your digital ticket has been sent to your <b>Email</b>. You can also save it directly from here.
      </p>

      {/* Dynamic Ticket Preview Card */}
      {!loading && ticket ? (
        <motion.div 
          initial={{ y: 50, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden mb-10"
        >
          <div className="bg-indigo-600 p-6 text-white text-left">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold leading-tight">{ticket.events.title}</h2>
              <Ticket className="opacity-50" />
            </div>
            <p className="text-indigo-200 text-xs mt-2 font-medium uppercase tracking-widest">
              {ticket.events.date} • {ticket.events.location}
            </p>
          </div>
          
          <div className="p-8 flex flex-col items-center bg-radial-gradient from-white to-gray-50">
            <div className="bg-white p-4 rounded-3xl shadow-inner border border-gray-100 mb-4">
              <img src={ticket.qr_url} alt="QR Code" className="w-40 h-40" />
            </div>
            <p className="font-mono text-sm text-gray-400 font-bold uppercase tracking-widest">
              {ticket.ticket_hash}
            </p>
          </div>
          
          <div className="border-t border-dashed border-gray-200 p-4 bg-gray-50">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Verified Lumina Entry</span>
          </div>
        </motion.div>
      ) : (
        <div className="h-64 flex items-center justify-center">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col w-full max-w-xs gap-3">
        <button 
          onClick={() => window.print()}
          className="bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Download size={18} /> Save to Phone
        </button>
        <Link href="/" className="bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
          Explore More Events <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
