"use client";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Search, QrCode, ShieldCheck, Loader2, AlertTriangle, Check, Copy, Calendar, MapPin } from 'lucide-react';

// Public client — RLS will restrict what's visible
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function QRDisplay({ reference }) {
  const [qrData, setQrData] = useState(reference);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch signed QR from server
    fetch(`/api/tickets/qr-data?ref=${encodeURIComponent(reference)}&email=ussd`)
      .then(r => r.json())
      .then(d => { setQrData(d.qr_data || reference); setLoading(false); })
      .catch(() => setLoading(false));
  }, [reference]);

  const copy = () => { navigator.clipboard.writeText(reference); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 20, display: 'inline-block', boxShadow: '0 8px 30px rgba(0,0,0,.1)', marginBottom: 16 }}>
        {loading
          ? <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={28} color="#CDA434" style={{ animation: 'spin .8s linear infinite' }} />
            </div>
          : <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=000000&qzone=2`}
              alt="Ticket QR Code" style={{ width: 200, height: 200, display: 'block' }} />
        }
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <code style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#334155' }}>{reference}</code>
        <button onClick={copy} style={{ background: copied ? '#f0fdf4' : '#f8fafc', border: `1px solid ${copied ? '#86efac' : '#e2e8f0'}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: copied ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        <ShieldCheck size={11} color="#22c55e" /> Cryptographically signed · Show at entry gate
      </p>
    </div>
  );
}

export default function FindTicketPage() {
  const searchParams = useSearchParams();
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Pre-fill from USSD SMS link: ?ref=XXXX
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReference(ref);
      // Auto-search when ref is in URL
      autoSearch(ref);
    }
  }, [searchParams]);

  const autoSearch = async (ref) => {
    setLoading(true);
    setError('');
    const { data } = await supabase
      .from('tickets')
      .select('*, events!event_id(id,title,date,time,location,image_url), ticket_tiers:tier_id(name)')
      .eq('reference', ref)
      .eq('status', 'valid');
    setLoading(false);
    setSearched(true);
    if (data?.length) {
      setTickets(data);
    } else {
      setError('No valid tickets found for this reference. The payment may still be processing — check back in a minute.');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!reference.trim() && !phone.trim()) { setError('Enter a reference or phone number'); return; }
    setLoading(true); setError(''); setSearched(false);

    let query = supabase.from('tickets')
      .select('*, events!event_id(id,title,date,time,location,image_url), ticket_tiers:tier_id(name)')
      .eq('status', 'valid');

    if (reference.trim()) {
      query = query.eq('reference', reference.trim().toUpperCase());
    } else {
      // Search by phone — USSD tickets stored as ussd-233XXXXXXXXX@ousted.live
      const normalised = phone.trim().replace(/^0/, '233');
      query = query.ilike('guest_email', `ussd-${normalised}%`);
    }

    const { data } = await query.limit(10);
    setLoading(false);
    setSearched(true);
    if (data?.length) {
      setTickets(data);
    } else {
      setError('No tickets found. If you just paid, please wait 1–2 minutes and try again.');
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px 80px', fontFamily: 'inherit' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 52, height: 52, background: '#000', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22 }}>🎟</div>
        <h1 style={{ fontSize: 26, fontWeight: 950, margin: '0 0 8px', letterSpacing: '-1px' }}>Find My Ticket</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 600 }}>Enter your reference from the SMS or your phone number to retrieve your tickets.</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} style={{ background: '#fff', borderRadius: 24, padding: '22px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.05)', marginBottom: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px', marginBottom: 7 }}>REFERENCE</label>
          <input value={reference} onChange={e => setReference(e.target.value.toUpperCase())}
            placeholder="e.g. USSD-M3X9K2-ABC123"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box', letterSpacing: '0.5px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', color: '#94a3b8' }}>
          <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
          <span style={{ fontSize: 11, fontWeight: 700 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px', marginBottom: 7 }}>PHONE NUMBER (USSD PURCHASES)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="e.g. 0241234567"
            type="tel"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={14} color="#ef4444" />
            <p style={{ margin: 0, fontSize: 12, color: '#ef4444', fontWeight: 700 }}>{error}</p>
          </div>
        )}
        <button type="submit" disabled={loading}
          style={{ width: '100%', background: loading ? '#94a3b8' : '#000', color: '#fff', border: 'none', padding: '14px', borderRadius: 14, fontWeight: 900, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? <><Loader2 size={15} style={{ animation: 'spin .8s linear infinite' }} /> Searching...</> : <><Search size={15} /> Find Tickets</>}
        </button>
      </form>

      {/* Results */}
      {tickets.map((ticket, i) => {
        const ev = ticket.events || {};
        const tier = ticket.ticket_tiers?.name || ticket.tier_name || 'General Admission';
        return (
          <div key={ticket.id} style={{ background: '#fff', borderRadius: 24, overflow: 'hidden', marginBottom: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.06)', animation: 'fadeUp .4s ease' }}>
            {/* Event image banner */}
            {ev.image_url && (
              <div style={{ height: 120, background: `url(${ev.image_url}) center/cover`, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 0%,rgba(0,0,0,.7) 100%)' }} />
                <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14 }}>
                  <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 950, margin: 0, letterSpacing: '-.3px' }}>{ev.title}</h3>
                </div>
              </div>
            )}
            <div style={{ padding: '18px' }}>
              {!ev.image_url && <h3 style={{ fontSize: 17, fontWeight: 950, margin: '0 0 12px', letterSpacing: '-.3px' }}>{ev.title || 'Event'}</h3>}

              {/* Ticket details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                {[
                  ['🎟 TIER', tier],
                  ['💳 PAID', `GHS ${Number(ticket.base_amount || ticket.amount || 0).toFixed(2)}`],
                  ['📅 DATE', ev.date ? new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBA'],
                  ['📍 VENUE', ev.location || 'TBA'],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 3px', fontSize: 8, color: '#94a3b8', fontWeight: 900, letterSpacing: '1.5px' }}>{l}</p>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Perforated divider */}
              <div style={{ position: 'relative', margin: '0 -18px 18px', height: 14, background: '#f8fafc', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: -7, width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0' }} />
                <div style={{ flex: 1, margin: '0 12px', borderTop: '2px dashed #e2e8f0' }} />
                <div style={{ position: 'absolute', right: -7, width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0' }} />
              </div>

              {/* QR Code */}
              <QRDisplay reference={ticket.reference} />

              {/* Status */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
                <div style={{ background: ticket.is_scanned ? '#f8fafc' : '#f0fdf4', border: `1px solid ${ticket.is_scanned ? '#e2e8f0' : '#86efac'}`, borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: ticket.is_scanned ? '#94a3b8' : '#22c55e' }} />
                  <span style={{ fontSize: 10, fontWeight: 900, color: ticket.is_scanned ? '#94a3b8' : '#16a34a', letterSpacing: '1px' }}>
                    {ticket.is_scanned ? 'USED' : 'VALID — READY FOR ENTRY'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {searched && !tickets.length && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p style={{ fontWeight: 700 }}>No tickets found</p>
        </div>
      )}
    </div>
  );
}
