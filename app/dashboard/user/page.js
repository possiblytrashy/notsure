"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Ticket, Calendar, MapPin, QrCode, LogOut, 
  Loader2, CheckCircle2, X, Navigation, 
  Car, Map as MapIcon, ChevronRight, ExternalLink,
  Clock, ShieldCheck
} from 'lucide-react';

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(null);

  useEffect(() => {
    const fetchUserAndTickets = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }
        setUser(user);

        // MATCHING YOUR SCHEMA: lat, lng, image_url, location, time
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            events!event_id (
              id,
              title,
              date,
              time,
              location,
              lat,
              lng,
              image_url
            )
          `)
          .eq('guest_email', user.email) 
          .order('created_at', { ascending: false });

        if (ticketError) throw ticketError;
        setTickets(ticketData || []);

      } catch (err) {
        console.error("Vault Access Error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndTickets();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getRideLink = (type, lat, lng, name) => {
    if (!lat || !lng) return null;
    return type === 'uber' 
      ? `https://uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  if (loading) return (
    <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff'}}>
      <Loader2 className="animate-spin" size={30} strokeWidth={1} color="#CDa434" />
      <p style={{marginTop: '20px', fontSize: '10px', letterSpacing: '4px', fontWeight: 'bold', opacity: 0.6}}>INITIALIZING VAULT</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '20px 20px 100px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '500px', margin: '0 auto 40px', paddingTop: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-1px', margin: 0 }}>THE VAULT</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}>
            <ShieldCheck size={12} color="#CDa434" />
            <span style={{ fontSize: '11px', fontWeight: '600' }}>SECURE ACCESS</span>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LogOut size={18} />
        </button>
      </div>

      {/* TICKETS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px', maxWidth: '500px', margin: '0 auto' }}>
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '30px' }}>
            <p style={{ opacity: 0.4, fontSize: '14px' }}>No active passes found in your vault.</p>
          </div>
        ) : tickets.map((ticket) => (
          <div key={ticket.id} style={{ background: 'rgba(20,20,20,1)', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            {/* IMAGE AREA */}
            <div style={{ height: '200px', background: `linear-gradient(to bottom, transparent, #141414), url(${ticket.events?.image_url}) center/cover`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: '20px', left: '20px', background: '#CDa434', color: '#000', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: '900' }}>
                {ticket.tier_name?.toUpperCase() || 'VIP'}
              </div>
              {ticket.is_scanned && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ border: '2px solid #fff', padding: '10px 20px', borderRadius: '12px', fontWeight: '900', letterSpacing: '2px' }}>USED</div>
                </div>
              )}
            </div>

            {/* CONTENT */}
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 15px', color: '#fff' }}>{ticket.events?.title}</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                  <Calendar size={14} color="#CDa434" /> {ticket.events?.date}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                  <Clock size={14} color="#CDa434" /> {ticket.events?.time || 'Night'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', gridColumn: 'span 2' }}>
                  <MapPin size={14} color="#CDa434" /> <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{ticket.events?.location}</span>
                </div>
              </div>

              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setSelectedTicket(ticket)}
                  disabled={ticket.is_scanned}
                  style={{ flex: 2, background: '#fff', color: '#000', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <QrCode size={18} /> VIEW PASS
                </button>
                <button 
                  onClick={() => setShowLocationModal(ticket)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '16px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Navigation size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QR MODAL (GHOST THEME) */}
      {selectedTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(10px)' }} onClick={() => setSelectedTicket(null)}>
          <div style={{ width: '100%', maxWidth: '350px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <p style={{ color: '#CDa434', fontWeight: '900', fontSize: '10px', letterSpacing: '3px', marginBottom: '20px' }}>ADMIT ONE</p>
            <div style={{ background: '#fff', padding: '25px', borderRadius: '40px', display: 'inline-block', marginBottom: '30px', boxShadow: '0 0 50px rgba(205,164,52,0.2)' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedTicket.reference}&color=000000&bgcolor=ffffff`} 
                style={{ width: '220px', height: '220px', display: 'block' }} 
                alt="QR" 
              />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '5px' }}>{selectedTicket.guest_name}</h3>
            <p style={{ opacity: 0.5, fontSize: '13px', fontFamily: 'monospace' }}>{selectedTicket.reference}</p>
            <button onClick={() => setSelectedTicket(null)} style={{ marginTop: '40px', background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '10px 20px', borderRadius: '30px', cursor: 'pointer', fontSize: '12px' }}>CLOSE</button>
          </div>
        </div>
      )}

      {/* TRANSPORT MODAL */}
      {showLocationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowLocationModal(null)}>
          <div style={{ background: '#111', width: '100%', maxWidth: '500px', borderTopLeftRadius: '40px', borderTopRightRadius: '40px', padding: '40px 30px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 30px' }} />
            <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '10px' }}>Transport</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '30px' }}>{showLocationModal.events?.location}</p>

            <a href={getRideLink('uber', showLocationModal.events?.lat, showLocationModal.events?.lng)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: '#fff', borderRadius: '20px', marginBottom: '12px', textDecoration: 'none', color: '#000' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <Car size={24} />
                <span style={{ fontWeight: '800' }}>Request Uber</span>
              </div>
              <ChevronRight size={20} />
            </a>

            <a href={getRideLink('google', showLocationModal.events?.lat, showLocationModal.events?.lng)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', textDecoration: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <MapIcon size={24} />
                <span style={{ fontWeight: '800' }}>Google Maps</span>
              </div>
              <ExternalLink size={20} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
