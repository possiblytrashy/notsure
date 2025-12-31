"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Ticket, Calendar, MapPin, QrCode, LogOut, 
  Loader2, Clock, CheckCircle2, X, AlertCircle,
  Navigation, Car, Map as MapIcon, ChevronRight,
  ExternalLink, Info
} from 'lucide-react';

/**
 * USER DASHBOARD (WALLET)
 * Features:
 * - Luxury Ticket Wallet UI
 * - Map Integration (Venue Directions)
 * - Rideshare Deep-linking (Uber/Bolt)
 * - Secure QR Generation
 */

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

        // Fetching tickets with linked event and tier data
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            events (
              id,
              title,
              date,
              event_time,
              location_name,
              latitude,
              longitude,
              image_urls
            )
          `)
          .eq('guest_email', user.email) 
          .order('created_at', { ascending: false });

        if (ticketError) throw ticketError;
        setTickets(ticketData || []);

      } catch (err) {
        console.error("Error loading wallet:", err);
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

  // Logic for Ride-hailing Deep Links
  const getRideLink = (type, lat, lng, name) => {
    const encodedName = encodeURIComponent(name);
    if (type === 'uber') {
      return `https://uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodedName}`;
    }
    if (type === 'bolt') {
      // Bolt uses a specific intent or universal link structure
      return `https://bolt.eu/ride/?lat=${lat}&lng=${lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  };

  // --- STYLES ---
  const styles = {
    page: { 
      minHeight: '100vh', 
      background: '#fcfdfe', 
      padding: '24px 16px 100px', 
      fontFamily: 'inherit' 
    },
    header: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      maxWidth: '600px', 
      margin: '0 auto 40px' 
    },
    logo: { 
      fontSize: '28px', 
      fontWeight: 950, 
      margin: 0, 
      letterSpacing: '-1.5px', 
      color: '#0f172a' 
    },
    walletGrid: { 
      display: 'grid', 
      gridTemplateColumns: '1fr', 
      gap: '24px', 
      maxWidth: '600px', 
      margin: '0 auto' 
    },
    card: { 
      background: '#fff', 
      borderRadius: '32px', 
      overflow: 'hidden', 
      boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)', 
      border: '1px solid #f1f5f9', 
      position: 'relative' 
    },
    cardMedia: (img) => ({ 
      height: '180px', 
      background: img ? `url(${img}) center/cover` : '#0f172a', 
      position: 'relative' 
    }),
    cardBody: { padding: '28px' },
    eventTitle: { 
      margin: '8px 0 12px', 
      fontSize: '22px', 
      fontWeight: 900, 
      color: '#0f172a', 
      letterSpacing: '-0.5px' 
    },
    metaRow: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px', 
      marginBottom: '24px' 
    },
    metaItem: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px', 
      color: '#64748b', 
      fontSize: '14px', 
      fontWeight: 600 
    },
    badge: (isScanned) => ({ 
      position: 'absolute', top: '20px', right: '20px', 
      background: isScanned ? 'rgba(255,255,255,0.9)' : '#fff', 
      color: isScanned ? '#94a3b8' : '#000',
      padding: '8px 16px', borderRadius: '14px', 
      fontSize: '11px', fontWeight: 900, display: 'flex', gap: '8px', alignItems: 'center',
      boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
      backdropFilter: 'blur(4px)'
    }),
    actionButtonGroup: { 
      display: 'grid', 
      gridTemplateColumns: '1.2fr 1fr', 
      gap: '12px' 
    },
    qrBtn: { 
      padding: '18px', 
      background: '#000', 
      color: '#fff', 
      border: 'none', 
      borderRadius: '20px', 
      fontWeight: 800, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '10px', 
      cursor: 'pointer',
      fontSize: '14px'
    },
    mapBtn: { 
      padding: '18px', 
      background: '#f8fafc', 
      color: '#0f172a', 
      border: '1px solid #e2e8f0', 
      borderRadius: '20px', 
      fontWeight: 800, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '10px', 
      cursor: 'pointer',
      fontSize: '14px'
    },
    overlay: { 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(15, 23, 42, 0.9)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000, 
      backdropFilter: 'blur(12px)', 
      padding: '20px' 
    },
    modalCard: { 
      background: '#fff', 
      width: '100%', 
      maxWidth: '400px', 
      borderRadius: '36px', 
      padding: '40px 30px', 
      textAlign: 'center', 
      position: 'relative',
      boxShadow: '0 30px 60px rgba(0,0,0,0.2)'
    },
    rideOption: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px',
      borderRadius: '20px',
      background: '#f8fafc',
      border: '1px solid #f1f5f9',
      marginBottom: '12px',
      textDecoration: 'none',
      transition: 'transform 0.2s ease'
    }
  };

  if (loading) return (
    <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px'}}>
      <Loader2 className="animate-spin" size={40} strokeWidth={1} />
      <p style={{fontWeight: 900, fontSize: '12px', letterSpacing: '2px', color: '#94a3b8'}}>LOADING ASSETS</p>
    </div>
  );

  return (
    <div style={styles.page}>
      {/* --- HEADER --- */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.logo}>VAULT</h1>
          <p style={{margin: '4px 0 0', fontSize: '13px', color: '#94a3b8', fontWeight: 600}}>Secure Digital Passports</p>
        </div>
        <button onClick={handleLogout} style={{background: '#fff', border: '1px solid #f1f5f9', width: '50px', height: '50px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.03)'}}>
          <LogOut size={20} color="#0f172a" />
        </button>
      </div>

      {/* --- TICKETS LIST --- */}
      <div style={styles.walletGrid}>
        {tickets.length === 0 ? (
           <div style={{textAlign: 'center', padding: '80px 40px', color: '#94a3b8', background: '#fff', borderRadius: '40px', border: '2px dashed #f1f5f9'}}>
             <div style={{background: '#f8fafc', width: '80px', height: '80px', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'}}>
               <Ticket size={32} style={{opacity: 0.5}} />
             </div>
             <h3 style={{color: '#0f172a', fontWeight: 900, margin: '0 0 8px'}}>Empty Vault</h3>
             <p style={{fontSize: '14px', fontWeight: 500, lineHeight: '1.5'}}>No active experiences found for <br/><strong>{user?.email}</strong></p>
           </div>
        ) : tickets.map((ticket) => (
          <div key={ticket.id} style={styles.card}>
            {/* Ticket Header Image */}
            <div style={styles.cardMedia(ticket.events?.image_urls?.[0])}>
               <div style={styles.badge(ticket.is_scanned)}>
                 {ticket.is_scanned ? <CheckCircle2 size={14}/> : <div style={{width: 8, height: 8, background: '#10b981', borderRadius: '50%'}}/>}
                 {ticket.is_scanned ? 'REDEEMED' : 'VALID ACCESS'}
               </div>
               <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)'}} />
               <div style={{position: 'absolute', bottom: '20px', left: '20px'}}>
                  <span style={{fontSize: '11px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '2px'}}>{ticket.tier_name || 'Standard'}</span>
               </div>
            </div>

            <div style={styles.cardBody}>
              <h2 style={styles.eventTitle}>{ticket.events?.title || 'Private Event'}</h2>
              
              <div style={styles.metaRow}>
                <div style={styles.metaItem}>
                  <Calendar size={16} color="#94a3b8" /> 
                  <span>{ticket.events?.date || 'Date TBA'} • {ticket.events?.event_time || 'Check Invite'}</span>
                </div>
                <div style={styles.metaItem}>
                  <MapPin size={16} color="#94a3b8" /> 
                  <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{ticket.events?.location_name || 'Venue Secure'}</span>
                </div>
              </div>

              <div style={styles.actionButtonGroup}>
                <button 
                  style={{...styles.qrBtn, opacity: ticket.is_scanned ? 0.5 : 1}} 
                  onClick={() => setSelectedTicket(ticket)}
                  disabled={ticket.is_scanned}
                >
                  {ticket.is_scanned ? 'PASSPORT USED' : <><QrCode size={18} /> OPEN QR</>}
                </button>
                
                <button 
                  style={styles.mapBtn}
                  onClick={() => setShowLocationModal(ticket)}
                >
                  <Navigation size={18} /> TRAVEL
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- MODAL: QR SCANNER --- */}
      {selectedTicket && (
        <div style={styles.overlay} onClick={() => setSelectedTicket(null)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedTicket(null)} style={{position: 'absolute', top: '24px', right: '24px', background: '#f8fafc', border: 'none', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <X size={20} color="#0f172a"/>
            </button>
            
            <div style={{marginBottom: '32px'}}>
              <h3 style={{margin: '0 0 6px 0', fontWeight: 950, fontSize: '24px', letterSpacing: '-1px'}}>Access Key</h3>
              <p style={{margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px'}}>
                {selectedTicket.guest_name}
              </p>
            </div>

            <div style={{background: '#fff', padding: '20px', borderRadius: '32px', border: '1px solid #f1f5f9', display: 'inline-block', marginBottom: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)'}}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`REF:${selectedTicket.reference}|EVT:${selectedTicket.event_id}`)}`} 
                style={{width: '220px', height: '220px', borderRadius: '12px'}} 
                alt="Secure Access QR" 
              />
            </div>
            
            <div style={{fontFamily: 'monospace', background: '#f8fafc', color: '#0f172a', padding: '12px 20px', borderRadius: '14px', fontSize: '14px', fontWeight: '800', display: 'block', marginBottom: '32px', border: '1px solid #e2e8f0'}}>
              {selectedTicket.reference}
            </div>

            <div style={{background: '#0f172a', padding: '20px', borderRadius: '24px', display: 'flex', gap: '14px', alignItems: 'center', textAlign: 'left', color: '#fff'}}>
              <div style={{background: 'rgba(255,255,255,0.1)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <Info size={20} color="#38bdf8" />
              </div>
              <p style={{fontSize: '12px', lineHeight: '1.5', margin: 0, fontWeight: 500, opacity: 0.9}}>
                One-time valid entry. Screen brightness should be at maximum for scanning.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: TRAVEL & RIDESHARE --- */}
      {showLocationModal && (
        <div style={styles.overlay} onClick={() => setShowLocationModal(null)}>
          <div style={{...styles.modalCard, maxWidth: '450px'}} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowLocationModal(null)} style={{position: 'absolute', top: '24px', right: '24px', background: '#f8fafc', border: 'none', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <X size={20} color="#0f172a"/>
            </button>

            <div style={{textAlign: 'left', marginBottom: '32px'}}>
              <h3 style={{margin: '0 0 6px 0', fontWeight: 950, fontSize: '24px', letterSpacing: '-1px'}}>Travel Concierge</h3>
              <p style={{margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 600}}>
                {showLocationModal.events?.location_name}
              </p>
            </div>

            {/* Google Maps Embed Preview */}
            <div style={{width: '100%', height: '180px', borderRadius: '24px', background: '#f1f5f9', marginBottom: '32px', overflow: 'hidden', border: '1px solid #e2e8f0'}}>
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                style={{border: 0}}
                src={`https://www.google.com/maps/embed/v1/place?key=YOUR_GOOGLE_MAPS_API_KEY&q=${showLocationModal.events?.latitude},${showLocationModal.events?.longitude}`}
                allowFullScreen
              ></iframe>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {/* Uber Option */}
              <a 
                href={getRideLink('uber', showLocationModal.events?.latitude, showLocationModal.events?.longitude, showLocationModal.events?.title)}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.rideOption}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                  <div style={{background: '#000', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Car size={20} color="#fff" />
                  </div>
                  <div style={{textAlign: 'left'}}>
                    <p style={{margin: 0, fontWeight: 900, fontSize: '15px', color: '#0f172a'}}>Request Uber</p>
                    <p style={{margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600}}>Direct to venue gates</p>
                  </div>
                </div>
                <ChevronRight size={18} color="#cbd5e1" />
              </a>

              {/* Google Maps Option */}
              <a 
                href={getRideLink('maps', showLocationModal.events?.latitude, showLocationModal.events?.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                style={{...styles.rideOption, background: '#fff', border: '2px solid #f1f5f9'}}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                  <div style={{background: '#f1f5f9', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <MapIcon size={20} color="#0f172a" />
                  </div>
                  <div style={{textAlign: 'left'}}>
                    <p style={{margin: 0, fontWeight: 900, fontSize: '15px', color: '#0f172a'}}>View on Maps</p>
                    <p style={{margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 600}}>Get GPS directions</p>
                  </div>
                </div>
                <ExternalLink size={18} color="#cbd5e1" />
              </a>
            </div>

            <p style={{marginTop: '32px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px'}}>
              Arrive in style. Plan for traffic in Accra.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
