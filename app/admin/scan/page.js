"use client";
import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';

export default function AdvancedScanner() {
  const [status, setStatus] = useState({ message: 'Ready to scan', color: '#666' });

  const verifyTicket = async (decodedText) => {
    setStatus({ message: 'Verifying...', color: '#0ea5e9' });
    
    const { data, error } = await supabase
      .from('tickets')
      .select('*, events(title)')
      .eq('qr_code', decodedText)
      .single();

    if (error || !data) {
      setStatus({ message: 'INVALID TICKET', color: '#ef4444' });
    } else if (data.is_scanned) {
      setStatus({ message: 'ALREADY USED', color: '#f59e0b' });
    } else {
      await supabase.from('tickets').update({ is_scanned: true }).eq('id', data.id);
      setStatus({ message: `VALID: ${data.events.title}`, color: '#22c55e' });
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 });
    scanner.render(verifyTicket, (err) => {});
    return () => scanner.clear();
  }, []);

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ background: status.color, color: 'white', padding: '20px', borderRadius: '20px', marginBottom: '20px', fontWeight: 900 }}>
        {status.message}
      </div>
      <div id="reader" style={{ borderRadius: '30px', overflow: 'hidden', background: 'white' }}></div>
    </div>
  );
}
