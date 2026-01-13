"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Calendar, MapPin, LogOut, Loader2, 
  Navigation, ChevronRight, ShieldCheck
} from 'lucide-react';

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Data States
  const [tickets, setTickets] = useState([]);
  
  // UI States
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        await fetchVaultData(user);
      }
    };
    checkUser();
  }, [router]);

  const fetchVaultData = async (currentUser) => {
    if (!currentUser?.id) return; 

    try {
      setLoading(true);
      
      // Fetch Tickets with Event Details AND Tier Names
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *, 
          events!event_id (id, title, date, time, location, lat, lng, image_url),
          ticket_tiers:tier_id (name)
        `)
        .eq('guest_email', currentUser.email)
        .order('created_at', { ascending: false });
      
      if (ticketError) throw ticketError;
      setTickets(ticketData || []);

    } catch (err) {
      console.error("Vault Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const openRideApp = (type, lat, lng) => {
    if (!lat || !lng) {
      alert("Venue coordinates not set for this event.");
      return;
    }
    let url = "";
    switch (type) {
      case 'uber': url = `uber://?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`; break;
      case 'bolt': url = `bolt://explore?dropoff_lat=${lat}&dropoff_lng=${lng}`; break;
      case 'yango': url = `yango://?finish_lat=${lat}&finish_lng=${lng}`; break;
      case 'google': url = `https://www.google.com/maps/search/?api=1&query=$${lat},${lng}`; break;
    }
    window.location.href = url;
    setTimeout(() => {
        if (type === 'uber') window.open(`https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`);
    }, 500);
  };

  // --- SUB-COMPONENTS ---

  const RideButton = ({ label, onClick, isSecondary }) => (
    <button 
        onClick={onClick}
        style={{ 
            width: '100%', padding: '18px', borderRadius: '15px', 
            border: isSecondary ? '1px solid rgba(255,255,255,0.1)' : 'none', 
            background: isSecondary ? 'transparent' : '#fff', 
            color: isSecondary ? '#fff' : '#000', 
            fontWeight: '900', fontSize: '14px', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'
        }}
    >
        {label} <ChevronRight size={16} />
    </button>
  );

  if (loading) return (
    <div style={{height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      <Loader2 className="animate-spin" color="#CDa434" size={30} />
      <p style={{marginTop: '20px', fontSize: '10px', letterSpacing: '4px', color: '#fff', fontWeight: 'bold', opacity: 0.6}}>INITIALIZING VAULT</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '20px 20px 100px', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '500px', margin: '0 auto 30px' }}>
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0 }}>THE VAULT</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}>
              <ShieldCheck size={12} color="#CDa434" />
              <span style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', fontWeight: 'bold' }}>ACCESS GRANTED</span>
            </div>
        </div>
        <button onClick={handleLogout} style={{ background: '#111', border: '1px solid #222', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LogOut size={18} />
        </button>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#666', letterSpacing: '1px', marginBottom: '15px' }}>MY TICKETS</h2>
        
        {tickets.length === 0 ? (
           <p style={{ opacity: 0.3, fontSize: '13px', textAlign: 'center', padding: '40px' }}>Your wallet is empty.</p>
        ) : (
           tickets.map(ticket => (
             <div key={ticket.id} style={{ background: '#111', borderRadius: '24px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #222', position: 'relative' }}>
                <div style={{ height: '160px', background: `linear-gradient(to bottom, transparent, #111), url(${ticket.events?.image_url}) center/cover`, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 15, left: 15, background: '#CDa434', color: '#000', fontSize: '10px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px' }}>
                      {ticket.ticket_tiers?.name || 'VIP'}
                    </div>
                </div>
                <div style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px' }}>{ticket.events?.title}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px', opacity: 0.6, fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={14}/> {ticket.events?.date}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14}/> {ticket.events?.location}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setSelectedTicket(ticket)} style={{ flex: 2, background: '#fff', color: '#000', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: '800', cursor: 'pointer' }}>VIEW TICKET</button>
                      <button onClick={() => setShowLocationModal(ticket)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Navigation size={18} /></button>
                    </div>
                </div>
             </div>
           ))
        )}
      </div>

      {/* TRANSPORT MODAL */}
      {showLocationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowLocationModal(null)}>
          <div style={{ background: '#0a0a0a', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', padding: '30px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>Transport Concierge</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px' }}>
                <RideButton label="Uber" onClick={() => openRideApp('uber', showLocationModal.events?.lat, showLocationModal.events?.lng)} />
                <RideButton label="Bolt" onClick={() => openRideApp('bolt', showLocationModal.events?.lat, showLocationModal.events?.lng)} />
                <RideButton label="Yango" onClick={() => openRideApp('yango', showLocationModal.events?.lat, showLocationModal.events?.lng)} />
                <RideButton label="Google Maps" onClick={() => openRideApp('google', showLocationModal.events?.lat, showLocationModal.events?.lng)} isSecondary />
            </div>
          </div>
        </div>
      )}

      {/* QR TICKET MODAL */}
      {selectedTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedTicket(null)}>
          <div style={{ textAlign: 'center', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#fff', padding: '25px', borderRadius: '30px', marginBottom: '20px' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${selectedTicket.reference}`} alt="QR" />
            </div>
            <p style={{ fontWeight: '800', fontSize: '18px', color: '#fff', marginBottom: '5px' }}>{selectedTicket.events?.title}</p>
            <p style={{ fontWeight: '800', opacity: 0.5, color: '#fff', letterSpacing: '2px' }}>{selectedTicket.reference}</p>
            <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 40px', borderRadius: '25px', marginTop: '30px', fontWeight: 'bold', cursor: 'pointer' }}>CLOSE</button>
          </div>
        </div>
      )}

    </div>
  );
}
