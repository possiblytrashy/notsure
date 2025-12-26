"use client";
import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';

export default function AdvancedScanner() {
  const [status, setStatus] = useState({ message: 'Ready to scan', color: '#666', details: '' });

  const verifyTicket = async (decodedText) => {
    // 1. CLEAN THE DATA: If the QR is a URL, get just the ID after the last slash
    // Example: "https://ousted.com/ticket/REF123" becomes "REF123"
    const cleanedRef = decodedText.includes('/') 
      ? decodedText.split('/').pop().trim() 
      : decodedText.trim();

    setStatus({ message: 'Verifying...', color: '#0ea5e9', details: cleanedRef });

    try {
      // 2. QUERY THE CORRECT COLUMN: We use 'reference' instead of 'qr_code'
      const { data, error } = await supabase
        .from('tickets')
        .select('*, events(title)')
        .eq('reference', cleanedRef)
        .single();

      if (error || !data) {
        console.error("Supabase Error:", error);
        setStatus({ message: 'INVALID TICKET', color: '#ef4444', details: `Ref: ${cleanedRef} not found.` });
        return;
      }

      // 3. CHECK STATUS: Use the column 'is_scanned' or 'is_used'
      if (data.is_scanned) {
        setStatus({ 
          message: 'ALREADY USED', 
          color: '#f59e0b', 
          details: `Scanned at: ${new Date(data.updated_at).toLocaleTimeString()}` 
        });
      } else {
        // 4. UPDATE STATUS: Mark as used
        const { error: updateErr } = await supabase
          .from('tickets')
          .update({ 
            is_scanned: true,
            // We can also track when it was scanned
          })
          .eq('id', data.id);

        if (updateErr) throw updateErr;

        setStatus({ 
          message: 'VALID TICKET', 
          color: '#22c55e', 
          details: `${data.events.title} - ${data.guest_name}` 
        });
      }
    } catch (err) {
      console.error("Scanner System Error:", err);
      setStatus({ message: 'SYSTEM ERROR', color: '#000', details: 'Check connection.' });
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0 
    });

    scanner.render(
      (text) => {
        // Stop scanner briefly to prevent double-scans
        verifyTicket(text);
      }, 
      (err) => { /* ignore normal scanning errors */ }
    );

    return () => scanner.clear();
  }, []);

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '120px 20px', textAlign: 'center' }}>
      <h2 style={{fontWeight: 900, marginBottom: '20px'}}>Ticket Scanner</h2>
      
      <div style={{ 
        background: status.color, 
        color: 'white', 
        padding: '30px', 
        borderRadius: '30px', 
        marginBottom: '20px', 
        transition: 'all 0.3s ease'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 900, marginBottom: '5px' }}>{status.message}</div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>{status.details}</div>
      </div>

      <div id="reader" style={{ 
        borderRadius: '30px', 
        overflow: 'hidden', 
        background: 'white',
        border: '1px solid #eee' 
      }}></div>

      <button 
        onClick={() => window.location.reload()}
        style={{marginTop: '30px', background: '#f4f4f5', border: 'none', padding: '12px 20px', borderRadius: '15px', fontWeight: 700, cursor: 'pointer'}}
      >
        Reset Scanner
      </button>
    </div>
  );
}
