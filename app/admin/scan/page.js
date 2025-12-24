"use client";
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
// ... rest of your code
export default function AdminScanner() {
  const [status, setStatus] = useState("Ready to Scan");

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 280 });
    scanner.render(async (hash) => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('ticket_hash', hash)
        .single();

      if (data && data.status === 'active') {
        await supabase.from('tickets').update({ status: 'used' }).eq('id', data.id);
        setStatus("✅ ACCESS GRANTED");
      } else {
        setStatus("❌ INVALID OR USED TICKET");
      }
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div id="reader" className="w-full max-w-sm rounded-3xl overflow-hidden border-4 border-white shadow-2xl" />
      <div className="mt-8 text-2xl font-black text-gray-900">{status}</div>
    </div>
  );
}
