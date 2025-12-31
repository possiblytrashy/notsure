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
 * LUXURY USER DASHBOARD (THE VAULT)
 * Optimized for Schema: public.tickets
 * Features: Map Integration & Ridesharing
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

        /**
         * FIXING THE 400 ERROR:
         * 1. We use events!event_id to be explicit about the relationship.
         * 2. We match the column names to your 'events' table. 
         * NOTE: Ensure your 'events' table has: title, date, location_name, latitude, longitude, image_urls
         */
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            id,
            guest_email,
            guest_name,
            tier_name,
            reference,
            is_scanned,
            event_id,
            events!event_id (
              id,
              title,
              date,
              location_name,
              latitude,
              longitude,
              image_urls
            )
          `)
          .eq('guest_email', user.email) 
          .order('created_at', { ascending: false });

        if (ticketError) {
          console.error("Query Error Details:", ticketError.message);
          throw ticketError;
        }
        
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

  // Rideshare Deep-link Logic
  const getRideLink = (type, lat, lng, name) => {
    const encodedName = encodeURIComponent(name || 'Event Venue');
    if (!lat || !lng) return "#";
    
    if (type === 'uber') {
      return `https://uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodedName}`;
    }
    if (type === 'google') {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return "#";
  };

  // --- LUXURY DESIGN SYSTEM STYLES ---
  const styles = {
    page: { minHeight: '100vh', background: '#fcfdfe', padding: '24px 16px 100px', fontFamily: 'inherit' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto 40px' },
    logo: { fontSize: '28px', fontWeight: 950, margin: 0, letterSpacing: '-1.5px', color: '#0f172a' },
    walletGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '24px', maxWidth: '600px', margin: '0 auto' },
    card: { background: '#fff', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', position: 'relative' },
    cardMedia: (img) => ({ height: '180px', background: img ? `url(${img}) center/cover` : '#0f172a', position: 'relative' }),
    cardBody: { padding: '28px' },
    eventTitle: { margin: '8px 0 12px', fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' },
    metaRow: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' },
    metaItem: { display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '14px', fontWeight: 600 },
    badge: (isScanned) => ({ 
      position: 'absolute', top: '20px', right: '20px', 
      background: isScanned ? 'rgba(255,255,255,0.9)' : '#fff', 
      color: isScanned ? '#94a3b8' : '#000',
      padding: '8px 16px', borderRadius: '14px', 
      fontSize: '11px', fontWeight: 900, display: 'flex', gap: '8px', alignItems: 'center',
      boxShadow: '0 10px 20px rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)'
    }),
    actionButtonGroup: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' },
    qrBtn: { padding: '18px', background: '#000', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' },
    mapBtn: { padding: '18px', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(12px)', padding: '20px' },
    modalCard: { background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '36px', padding: '40px 30px', textAlign: 'center', position: 'relative', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' },
    rideOption: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #f1f5f9', marginBottom: '12px', textDecoration: 'none' }
  };

  if (loading) return (
    <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px'}}>
      <Loader2 className="animate-spin" size={40} strokeWidth={1} />
      <p style={{fontWeight: 900, fontSize: '10px', letterSpacing: '2px', color: '#94a3b8'}}>AUTHENTICATING VAULT</p>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.logo}>VAULT</h1>
          <p style={{margin: '4px 0 0', fontSize: '12px', color: '#94a3b8', fontWeight: 700}}>{user?.email}</p>
        </div>
        <button onClick={handleLogout} style={{background: '#fff', border: '1px solid #f1f5f9', width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
          <LogOut size={18} />
        </button>
      </div>

      <div style={styles.walletGrid}>
        {tickets.length === 0 ? (
           <div style={{textAlign: 'center', padding: '80px 40px', background: '#fff', borderRadius: '40px', border: '2px dashed #f1f5f9'}}>
             <Ticket size={40} style={{opacity: 0.2, marginBottom: '20px'}} />
             <h3 style={{fontWeight: 900, margin: '0 0 10px'}}>No Passes Found</h3>
             <p style={{fontSize: '13px', color: '#94a3b8', fontWeight: 600}}>Your acquired experiences will appear here.</p>
           </div>
        ) : tickets.map((ticket) => (
          <div key={ticket.id} style={styles.card}>
            <div style={styles.cardMedia(ticket.events?.image_urls?.[0])}>
               <div style={styles.badge(ticket.is_scanned)}>
                 {ticket.is_scanned ? <CheckCircle2 size={14}/> : <div style={{width: 8, height: 8, background: '#10b981', borderRadius: '50%'}}/>}
                 {ticket.is_scanned ? 'REDEEMED' : 'VALID ENTRY'}
               </div>
               <div style={{position: 'absolute', bottom: '20px', left: '20px'}}>
                  <span style={{fontSize: '10px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '2px'}}>{ticket.tier_name || 'General Access'}</span>
               </div>
            </div>

            <div style={styles.cardBody}>
              <h2 style={styles.eventTitle}>{ticket.events?.title || 'Private Event'}</h2>
              
              <div style={styles.metaRow}>
                <div style={styles.metaItem}>
                  <Calendar size={16} /> 
                  <span>{ticket.events?.date || 'Date TBA'}</span>
                </div>
                <div style={styles.metaItem}>
                  <MapPin size={16} /> 
                  <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{ticket.events?.location_name || 'Secure Location'}</span>
                </div>
              </div>

              <div style={styles.actionButtonGroup}>
                <button 
                  style={styles.qrBtn} 
                  onClick={() => setSelectedTicket(ticket)}
                  disabled={ticket.is_scanned}
                >
                  <QrCode size={18} /> {ticket.is_scanned ? 'USED' : 'ACCESS QR'}
                </button>
                <button style={styles.mapBtn} onClick={() => setShowLocationModal(ticket)}>
                  <Navigation size={18} /> TRAVEL
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- QR MODAL --- */}
      {selectedTicket && (
        <div style={styles.overlay} onClick={() => setSelectedTicket(null)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedTicket(null)} style={{position: 'absolute', top: '24px', right: '24px', border: 'none', background: 'none', cursor: 'pointer'}}>
              <X size={24} color="#94a3b8"/>
            </button>
            <h3 style={{fontWeight: 950, fontSize: '24px', marginBottom: '8px'}}>Digital Passport</h3>
            <p style={{fontSize: '12px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '30px'}}>{selectedTicket.guest_name}</p>
            
            <div style={{background: '#fff', padding: '20px', borderRadius: '32px', border: '1px solid #f1f5f9', display: 'inline-block', marginBottom: '30px'}}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`REF:${selectedTicket.reference}`)}`} 
                style={{width: '200px', height: '200px'}} 
                alt="QR" 
              />
            </div>
            
            <div style={{fontFamily: 'monospace', background: '#f8fafc', padding: '12px', borderRadius: '12px', fontWeight: '800', marginBottom: '20px'}}>
              {selectedTicket.reference}
            </div>
          </div>
        </div>
      )}

      {/* --- TRAVEL MODAL --- */}
      {showLocationModal && (
        <div style={styles.overlay} onClick={() => setShowLocationModal(null)}>
          <div style={{...styles.modalCard, maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowLocationModal(null)} style={{position: 'absolute', top: '24px', right: '24px', border: 'none', background: 'none', cursor: 'pointer'}}>
              <X size={24} color="#94a3b8"/>
            </button>
            
            <div style={{textAlign: 'left', marginBottom: '30px'}}>
              <h3 style={{fontWeight: 950, fontSize: '22px'}}>Travel Concierge</h3>
              <p style={{fontSize: '13px', color: '#64748b', fontWeight: 600}}>{showLocationModal.events?.location_name}</p>
            </div>

            <a 
              href={getRideLink('uber', showLocationModal.events?.latitude, showLocationModal.events?.longitude, showLocationModal.events?.title)}
              target="_blank" rel="noreferrer"
              style={styles.rideOption}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                <div style={{background: '#000', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Car size={20} color="#fff" />
                </div>
                <div style={{textAlign: 'left'}}>
                  <p style={{margin: 0, fontWeight: 900, fontSize: '14px'}}>Uber Ride</p>
                  <p style={{margin: 0, fontSize: '11px', color: '#94a3b8'}}>Call a driver to venue</p>
                </div>
              </div>
              <ChevronRight size={18} color="#cbd5e1" />
            </a>

            <a 
              href={getRideLink('google', showLocationModal.events?.latitude, showLocationModal.events?.longitude)}
              target="_blank" rel="noreferrer"
              style={{...styles.rideOption, background: '#fff', border: '1px solid #e2e8f0'}}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                <div style={{background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <MapIcon size={20} color="#0f172a" />
                </div>
                <div style={{textAlign: 'left'}}>
                  <p style={{margin: 0, fontWeight: 900, fontSize: '14px'}}>Directions</p>
                  <p style={{margin: 0, fontSize: '11px', color: '#94a3b8'}}>View on Google Maps</p>
                </div>
              </div>
              <ExternalLink size={18} color="#cbd5e1" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
