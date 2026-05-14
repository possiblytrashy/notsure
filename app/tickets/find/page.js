"use client";
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Mail, Hash, Loader2, Search, Download, ArrowLeft, Ticket } from 'lucide-react';

export default function FindTicketPage() {
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // We join the events table to get the title for the ticket display
    const { data, error: dbError } = await supabase
      .from('tickets')
      .select('*, events(title, location, date)')
      .eq('guest_email', email.trim())
      .eq('reference', reference.trim())
      .single();

    if (dbError || !data) {
      setError("Ticket not found. Please ensure the Email and Reference ID are correct.");
      setLoading(false);
    } else {
      setTicket(data);
      setLoading(false);
    }
  };

  if (ticket) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${ticket.reference}`;
    
    return (
      <div className="printable-ticket" style={{ maxWidth: '500px', margin: '40px auto', padding: '20px' }}>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .printable-ticket, .printable-ticket * { visibility: visible; }
            .printable-ticket { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>
        
        <div style={ticketCard}>
          <div className="no-print" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <button onClick={() => setTicket(null)} style={backBtn}><ArrowLeft size={16}/> Back</button>
          </div>

          <Ticket size={40} style={{ marginBottom: '10px' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0' }}>YOUR TICKET</h2>
          <p style={{ color: '#64748b', marginBottom: '25px' }}>{ticket.events?.title}</p>

          <div style={blackBox}>
             <div style={{ marginBottom: '15px' }}>
                <p style={label}>ATTENDEE</p>
                <p style={value}>{ticket.guest_name || "Guest"}</p>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={label}>TIER</p>
                  <p style={value}>{ticket.tier_name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={label}>PRICE</p>
                  <p style={value}>GHS {ticket.amount}</p>
                </div>
             </div>
          </div>

          <div style={{ margin: '20px 0' }}>
            <img src={qrUrl} alt="QR Code" style={{ width: '200px', height: '200px', borderRadius: '12px' }} />
            <p style={{ marginTop: '15px', fontSize: '12px', fontWeight: 800, color: '#94a3b8' }}>ID: {ticket.reference}</p>
          </div>

          <button onClick={() => window.print()} style={downloadBtn} className="no-print">
            <Download size={18} style={{ marginRight: '8px' }} /> SAVE AS PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '100px auto', padding: '20px' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '32px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '10px', letterSpacing: '-1px' }}>Find Ticket</h1>
        <p style={{ color: '#64748b', marginBottom: '30px' }}>Enter the details used during checkout.</p>

        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={inputBox}>
            <Mail size={18} color="#94a3b8" />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={inputField} 
            />
          </div>
          
          <div style={inputBox}>
            <Hash size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Paystack Reference" 
              value={reference} 
              onChange={(e) => setReference(e.target.value)} 
              required 
              style={inputField} 
            />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: 600 }}>{error}</p>}

          <button type="submit" disabled={loading} style={submitBtn}>
            {loading ? <Loader2 className="animate-spin" /> : <><Search size={18} style={{marginRight: '8px'}}/> LOCATE TICKET</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// STYLES
const ticketCard = { textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' };
const blackBox = { background: '#000', color: '#fff', padding: '25px', borderRadius: '24px', textAlign: 'left', marginBottom: '25px' };
const label = { margin: '0 0 4px 0', fontSize: '10px', opacity: 0.6, fontWeight: 700, letterSpacing: '1px' };
const value = { margin: 0, fontWeight: 800, fontSize: '16px' };
const inputBox = { display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '18px 20px', borderRadius: '20px', border: '1px solid #e2e8f0' };
const inputField = { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontWeight: 600 };
const submitBtn = { width: '100%', background: '#000', color: '#fff', padding: '20px', borderRadius: '20px', border: 'none', fontWeight: 900, fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' };
const downloadBtn = { width: '100%', background: '#f1f5f9', color: '#000', padding: '18px', borderRadius: '18px', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' };
const backBtn = { background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' };
