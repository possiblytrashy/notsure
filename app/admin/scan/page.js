"use client";
import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '@/lib/supabase';

export default function Scanner() {
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
    
    scanner.render(async (decodedText) => {
      scanner.clear();
      
      // Check Ticket in DB
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('ticket_number', decodedText)
        .single();

      if (data) {
        if (data.status === 'valid') {
          await supabase.from('tickets').update({ status: 'redeemed' }).eq('id', data.id);
          setScanResult({ success: true, msg: "Valid Ticket! Access Granted." });
        } else {
          setScanResult({ success: false, msg: "Warning: Ticket already used!" });
        }
      } else {
        setScanResult({ success: false, msg: "Invalid Ticket Number." });
      }
    });
  }, []);

  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <h1 className="text-2xl font-bold">Gate Scanner</h1>
      <div id="reader" className="overflow-hidden rounded-2xl border-2 border-lumina-500"></div>
      
      {scanResult && (
        <div className={`p-4 rounded-xl text-white font-bold ${scanResult.success ? 'bg-green-500' : 'bg-red-500'}`}>
          {scanResult.msg}
        </div>
      )}
      
      <button onClick={() => window.location.reload()} className="text-sm text-gray-500 underline">
        Reset Scanner
      </button>
    </div>
  );
}
