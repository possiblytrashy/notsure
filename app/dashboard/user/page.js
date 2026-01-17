// FILE: app/dashboard/page.js
// REPLACE your existing dashboard with this version

"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Calendar, MapPin, LogOut, Loader2, 
  Navigation, ChevronRight, ShieldCheck, DollarSign, TrendingUp
} from 'lucide-react';

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isReseller, setIsReseller] = useState(false);
  const [resellerStats, setResellerStats] = useState(null);
  
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
        await checkResellerStatus(user.id);
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

  const checkResellerStatus = async (userId) => {
    try {
      const { data: reseller } = await supabase
        .from('resellers')
        .select('id, is_active, total_earned')
        .eq('user_id', userId)
        .maybeSingle();

      if (reseller?.is_active) {
        setIsReseller(true);
        
        // Get quick stats
        const { data: stats } = await supabase
          .rpc('get_reseller_stats', { p_reseller_id: reseller.id });
        
        if (stats && stats.length > 0) {
          setResellerStats(stats[0]);
        }
      }
    } catch (err) {
      console.error('Reseller check error:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };


const openRideApp = (type, lat, lng, locationName = 'Event Location') => {
  if (!lat || !lng) {
    alert("Venue coordinates not set for this event.");
    return;
  }

  const encodedName = encodeURIComponent(locationName);
  
  const deepLinks = {
    uber: `uber://?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodedName}`,
    uberWeb: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodedName}`,
    
    bolt: `bolt://riderequest?destination_latitude=${lat}&destination_longitude=${lng}`,
    boltWeb: `https://bolt.eu/`,
    
    yango: `yango://route?end-lat=${lat}&end-lon=${lng}`,
    yangoWeb: `https://yango.com/`,
    
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
  };

  if (type === 'google') {
    // Google Maps always opens in browser/app correctly
    window.open(deepLinks.google, '_blank');
    return;
  }

  // For rideshare apps: try deep link with fallback
  const tryDeepLink = () => {
    // Attempt to open the app
    window.location.href = deepLinks[type];
    
    // Set up fallback to web version
    const startTime = Date.now();
    
    const checkAppOpened = () => {
      if (Date.now() - startTime < 2500) {
        // Still within timeout window
        if (document.hidden || document.webkitHidden) {
          // App successfully opened (page is hidden)
          return;
        }
      } else {
        // Timeout reached, app didn't open
        const webFallback = deepLinks[`${type}Web`];
        if (webFallback) {
          const shouldOpenWeb = confirm(
            `${type.charAt(0).toUpperCase() + type.slice(1)} app not installed. Open website instead?`
          );
          if (shouldOpenWeb) {
            window.open(webFallback, '_blank');
          }
        }
      }
    };

    setTimeout(checkAppOpened, 2500);
    
    // Also listen for visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // App opened successfully
        clearTimeout(checkAppOpened);
      }
    }, { once: true });
  };

  tryDeepLink();
};

// Updated RideButton component call - pass location name
const RideButtonWithLocation = ({ label, type, lat, lng, locationName }) => (
  <button 
    onClick={() => openRideApp(type, lat, lng, locationName)}
    style={{ 
      width: '100%', 
      padding: '18px', 
      borderRadius: '15px', 
      border: type === 'google' ? '1px solid rgba(255,255,255,0.1)' : 'none', 
      background: type === 'google' ? 'transparent' : '#fff', 
      color: type === 'google' ? '#fff' : '#000', 
      fontWeight: '900', 
      fontSize: '14px', 
      cursor: 'pointer',
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '10px'
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
        
        {/* Reseller Quick Access */}
        {isReseller ? (
          <div style={{ 
            background: 'linear-gradient(135deg, #CDa434 0%, #b8912d 100%)', 
            borderRadius: '20px', 
            padding: '24px', 
            marginBottom: '30px',
            cursor: 'pointer'
          }}
          onClick={() => router.push('/reseller/dashboard')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={20} color="#000" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(0,0,0,0.7)', fontWeight: '700' }}>RESELLER</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#000' }}>
                    GHS {resellerStats?.total_earned?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
              <ChevronRight size={24} color="#000" />
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'rgba(0,0,0,0.8)', fontWeight: '600' }}>
              <span>📊 {resellerStats?.total_sales || 0} sales</span>
              <span>👆 {resellerStats?.total_clicks || 0} clicks</span>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '20px',
            padding: '20px',
            marginBottom: '30px',
            textAlign: 'center'
          }}>
            <TrendingUp size={32} color="#CDa434" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 8px' }}>
              Become a Reseller
            </h3>
            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px' }}>
              Earn 10% commission by promoting events
            </p>
            <button
              onClick={() => router.push('/reseller/onboard')}
              style={{
                background: '#CDa434',
                color: '#000',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Get Started
            </button>
          </div>
        )}

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
  <div 
    style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.8)', 
      zIndex: 1000, 
      display: 'flex', 
      alignItems: 'flex-end' 
    }} 
    onClick={() => setShowLocationModal(null)}
  >
    <div 
      style={{ 
        background: '#0a0a0a', 
        width: '100%', 
        borderTopLeftRadius: '30px', 
        borderTopRightRadius: '30px', 
        padding: '30px', 
        border: '1px solid rgba(255,255,255,0.1)' 
      }} 
      onClick={e => e.stopPropagation()}
    >
      <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>
        Transport Concierge
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px' }}>
        <RideButtonWithLocation 
          label="Uber" 
          type="uber"
          lat={showLocationModal.events?.lat}
          lng={showLocationModal.events?.lng}
          locationName={showLocationModal.events?.location || showLocationModal.events?.title}
        />
        <RideButtonWithLocation 
          label="Bolt" 
          type="bolt"
          lat={showLocationModal.events?.lat}
          lng={showLocationModal.events?.lng}
          locationName={showLocationModal.events?.location || showLocationModal.events?.title}
        />
        <RideButtonWithLocation 
          label="Yango" 
          type="yango"
          lat={showLocationModal.events?.lat}
          lng={showLocationModal.events?.lng}
          locationName={showLocationModal.events?.location || showLocationModal.events?.title}
        />
        <RideButtonWithLocation 
          label="Google Maps" 
          type="google"
          lat={showLocationModal.events?.lat}
          lng={showLocationModal.events?.lng}
          locationName={showLocationModal.events?.location || showLocationModal.events?.title}
        />
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
