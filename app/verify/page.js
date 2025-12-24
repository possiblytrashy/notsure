"use client";
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Download } from 'lucide-react';
import Link from 'next/link';

export default function SuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <motion.div 
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
      >
        <CheckCircle className="w-12 h-12 text-green-500" />
      </motion.div>

      <h1 className="text-4xl font-black text-gray-900 mb-2">Payment Received!</h1>
      <p className="text-gray-600 mb-8 max-w-sm">
        Your ticket has been generated and sent to your <b>WhatsApp</b> and <b>Email</b>. 
        See you at the event!
      </p>

      <div className="flex flex-col w-full max-w-xs gap-3">
        <Link href="/" className="bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
          Back to Events <ArrowRight size={18} />
        </Link>
        <button className="bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
          <Download size={18} /> Save Receipt
        </button>
      </div>
    </div>
  );
}
