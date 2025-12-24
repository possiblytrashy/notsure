"use client";
import { useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect } from 'react';

export default function Scanner() {
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 });
    scanner.render((result) => setScanResult(result), (err) => console.log(err));
    return () => scanner.clear();
  }, []);

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <h2 style={{ fontWeight: 900, fontSize: '32px' }}>Ticket Scanner</h2>
      <div id="reader" style={{ borderRadius: '25px', overflow: 'hidden', border: 'none', background: 'white', padding: '20px' }}></div>
      {scanResult && (
        <div style={{ marginTop: '20px', padding: '20px', background: '#22c55e', color: 'white', borderRadius: '20px', fontWeight: 900 }}>
          VALID TICKET: {scanResult}
        </div>
      )}
    </div>
  );
}
