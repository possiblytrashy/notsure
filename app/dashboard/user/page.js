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

        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            events!event_id (
              id, title, date, time, location, lat, lng, image_url
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

  /**
   * RIDE HAILING DEEP LINKS
   * These work best on mobile devices where the apps are installed.
   */
  const openRideApp = (type, lat, lng) => {
    if (!lat || !lng) {
      alert("Venue coordinates not set for this event.");
      return;
    }

    let url = "";
    switch (type) {
      case 'uber':
        url = `uber://?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`;
        break;
      case 'bolt':
        // Bolt uses a specific format for destination
        url = `bolt://explore?dropoff_lat=${lat}&dropoff_lng=${lng}`;
        break;
      case 'yango':
        // Yango (popular in Ghana/luxury markets) uses this scheme
        url = `yango://?finish_lat=${lat}&finish_lng=${lng}`;
        break;
      case 'google':
        url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        break;
    }

    // Attempt to open the app link
    window.location.href = url;
    
    // Fallback for desktop/if app is missing (redirect to store or web after 500ms)
    setTimeout(() => {
        if (type === 'uber') window.open(`https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`);
        if (type === 'google') window.open(url);
    }, 500);
  };

  if (loading) return (
    <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff'}}>
      <Loader2 className="animate-spin" size={30} strokeWidth={1} color="#CDa434" />
      <p style={{marginTop: '20px', fontSize: '10px', letterSpacing: '4px', fontWeight: 'bold', opacity: 0.6}}>INITIALIZING VAULT</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '20px 20px 100px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '500px', margin: '0 auto 40px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-1px', margin: 0 }}>THE VAULT</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}>
            <ShieldCheck size={12} color="#CDa434" />
            <span style={{ fontSize: '11px', fontWeight: '600' }}>SECURE ACCESS</span>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer' }}>
          <LogOut size={18} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px', maxWidth: '500px', margin: '0 auto' }}>
        {tickets.map((ticket) => (
          <div key={ticket.id} style={{ background: '#111', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            
            <div style={{ height: '180px', background: `linear-gradient(to bottom, transparent, #111), url(${ticket.events?.image_url}) center/cover`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: '20px', left: '20px', background: '#CDa434', color: '#000', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: '900' }}>
                {ticket.tier_name || 'VIP'}
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 15px' }}>{ticket.events?.title}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', opacity: 0.6, fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={14}/> {ticket.events?.date}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14}/> {ticket.events?.location}</div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setSelectedTicket(ticket)}
                  style={{ flex: 2, background: '#fff', color: '#000', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: '800', cursor: 'pointer' }}
                >
                  VIEW TICKET
                </button>
                <button 
                  onClick={() => setShowLocationModal(ticket)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Navigation size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TRANSPORT MODAL */}
      {showLocationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowLocationModal(null)}>
          <div style={{ background: '#0a0a0a', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', padding: '30px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>Transport Concierge</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <RideButton label="Uber" onClick={() => openRideApp('uber', showLocationModal.events?.lat, showLocationModal.events?.lng)} />
                <RideButton label="Bolt" onClick={() => openRideApp('bolt', showLocationModal.events?.lat, showLocationModal.events?.lng)} />
                <RideButton label="Yango" onClick={() => openRideApp('yango', showLocationModal.events?.lat, showLocationModal.events?.lng)} />
                <RideButton label="Google Maps" onClick={() => openRideApp('google', showLocationModal.events?.lat, showLocationModal.events?.lng)} isSecondary />
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {selectedTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedTicket(null)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '30px', marginBottom: '20px' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedTicket.reference}`} alt="QR" />
            </div>
            <p style={{ fontWeight: '800', opacity: 0.5 }}>{selectedTicket.reference}</p>
            <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 30px', borderRadius: '20px', marginTop: '20px' }}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for Ride Buttons to keep code clean
function RideButton({ label, onClick, isSecondary }) {
    return (
        <button 
            onClick={onClick}
            style={{ 
                width: '100%', 
                padding: '18px', 
                borderRadius: '15px', 
                border: isSecondary ? '1px solid rgba(255,255,255,0.1)' : 'none', 
                background: isSecondary ? 'transparent' : '#fff', 
                color: isSecondary ? '#fff' : '#000', 
                fontWeight: '900', 
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}
        >
            {label} <ChevronRight size={16} />
        </button>
    );
}
