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
         * UPDATED QUERY:
         * Changed 'location_name' to 'location' based on your error log.
         * Note: If 'image_urls' also errors, change it to 'images'.
         */
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            events!event_id (
              id,
              title,
              date,
              location,
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
        console.error("Error loading wallet:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndTickets();
  }, [router]);

  const handleLogout = async () => {
    await supabase.signOut();
    router.push('/login');
  };

  const getRideLink = (type, lat, lng, name) => {
    if (!lat || !lng) return null;
    const encodedName = encodeURIComponent(name || 'Venue');
    return type === 'uber' 
      ? `https://uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodedName}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  };

  // --- STYLES ---
  const styles = {
    page: { minHeight: '100vh', background: '#fcfdfe', padding: '24px 16px 100px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto 40px' },
    logo: { fontSize: '28px', fontWeight: 950, margin: 0, letterSpacing: '-1.5px' },
    walletGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '24px', maxWidth: '600px', margin: '0 auto' },
    card: { background: '#fff', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', position: 'relative' },
    cardMedia: (img) => ({ height: '160px', background: img ? `url(${img}) center/cover` : '#0f172a', position: 'relative' }),
    cardBody: { padding: '24px' },
    eventTitle: { margin: '8px 0 12px', fontSize: '20px', fontWeight: 900, color: '#0f172a' },
    metaRow: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' },
    metaItem: { display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', fontWeight: 600 },
    badge: (isScanned) => ({ 
      position: 'absolute', top: '15px', right: '15px', 
      background: '#fff', color: isScanned ? '#94a3b8' : '#10b981',
      padding: '6px 14px', borderRadius: '12px', fontSize: '11px', fontWeight: 900,
      display: 'flex', gap: '6px', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }),
    actionButtonGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    qrBtn: { padding: '16px', background: '#000', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    mapBtn: { padding: '16px', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '20px' },
    modalCard: { background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '32px', padding: '32px', textAlign: 'center', position: 'relative' },
    rideOption: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '18px', background: '#f8fafc', border: '1px solid #f1f5f9', marginBottom: '10px', textDecoration: 'none' }
  };

  if (loading) return <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.logo}>VAULT</h1>
        <button onClick={handleLogout} style={{background: '#fff', border: '1px solid #f1f5f9', width: '45px', height: '45px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <LogOut size={18} />
        </button>
      </div>

      <div style={styles.walletGrid}>
        {tickets.map((ticket) => (
          <div key={ticket.id} style={styles.card}>
            <div style={styles.cardMedia(ticket.events?.image_urls?.[0])}>
              <div style={styles.badge(ticket.is_scanned)}>
                {ticket.is_scanned ? <CheckCircle2 size={12}/> : <Clock size={12}/>}
                {ticket.is_scanned ? 'USED' : 'VALID'}
              </div>
            </div>

            <div style={styles.cardBody}>
              <span style={{fontSize: '10px', fontWeight: 900, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1px'}}>{ticket.tier_name}</span>
              <h2 style={styles.eventTitle}>{ticket.events?.title}</h2>
              
              <div style={styles.metaRow}>
                <div style={styles.metaItem}><Calendar size={14}/> {ticket.events?.date}</div>
                <div style={styles.metaItem}><MapPin size={14}/> {ticket.events?.location}</div>
              </div>

              <div style={styles.actionButtonGroup}>
                <button style={styles.qrBtn} onClick={() => setSelectedTicket(ticket)} disabled={ticket.is_scanned}>
                  <QrCode size={18} /> TICKET
                </button>
                <button style={styles.mapBtn} onClick={() => setShowLocationModal(ticket)}>
                  <Navigation size={18} /> TRAVEL
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QR MODAL */}
      {selectedTicket && (
        <div style={styles.overlay} onClick={() => setSelectedTicket(null)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={{fontWeight: 900, fontSize: '22px', marginBottom: '20px'}}>Entry Pass</h3>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedTicket.reference}`} 
              style={{width: '200px', marginBottom: '20px'}} alt="QR" 
            />
            <div style={{fontFamily: 'monospace', background: '#f8fafc', padding: '10px', borderRadius: '10px', fontWeight: 'bold'}}>{selectedTicket.reference}</div>
          </div>
        </div>
      )}

      {/* TRAVEL MODAL */}
      {showLocationModal && (
        <div style={styles.overlay} onClick={() => setShowLocationModal(null)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={{fontWeight: 900, fontSize: '22px', marginBottom: '5px'}}>Travel Options</h3>
            <p style={{fontSize: '13px', color: '#64748b', marginBottom: '24px'}}>{showLocationModal.events?.location}</p>

            <a href={getRideLink('uber', showLocationModal.events?.latitude, showLocationModal.events?.longitude, showLocationModal.events?.title)} target="_blank" rel="noreferrer" style={styles.rideOption}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <Car size={20} />
                <div style={{textAlign: 'left'}}><p style={{margin: 0, fontWeight: 800}}>Uber Ride</p></div>
              </div>
              <ChevronRight size={18} />
            </a>

            <a href={getRideLink('google', showLocationModal.events?.latitude, showLocationModal.events?.longitude)} target="_blank" rel="noreferrer" style={styles.rideOption}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <MapIcon size={20} />
                <div style={{textAlign: 'left'}}><p style={{margin: 0, fontWeight: 800}}>Google Maps</p></div>
              </div>
              <ChevronRight size={18} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
