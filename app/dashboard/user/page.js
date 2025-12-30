"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Ticket, Calendar, MapPin, QrCode, LogOut, 
  Loader2, Clock, CheckCircle2, X, AlertCircle
} from 'lucide-react';

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    const fetchUserAndTickets = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }
        setUser(user);

        // MATCHING YOUR SCHEMA: Using 'guest_email' as per your SQL table definition
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            events (
              id,
              title,
              date,
              location,
              images
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

  // --- STYLES ---
  const styles = {
    page: { minHeight: '100vh', background: '#f8fafc', padding: '20px', fontFamily: 'Inter, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', maxWidth: '600px', margin: '0 auto 30px' },
    logo: { fontSize: '24px', fontWeight: 950, margin: 0, letterSpacing: '-1px' },
    walletGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '20px', maxWidth: '600px', margin: '0 auto' },
    card: { background: '#fff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', border: '1px solid #f0f0f0', position: 'relative' },
    cardMedia: (img) => ({ height: '140px', background: img ? `url(${img}) center/cover` : '#000', position: 'relative' }),
    cardBody: { padding: '24px' },
    eventTitle: { margin: '0 0 10px', fontSize: '20px', fontWeight: 900, color: '#0f172a' },
    metaRow: { display: 'flex', flexWrap: 'wrap', gap: '15px', color: '#64748b', fontSize: '13px', fontWeight: 600, marginBottom: '20px' },
    metaItem: { display: 'flex', alignItems: 'center', gap: '6px' },
    badge: (isScanned) => ({ 
      position: 'absolute', top: '15px', right: '15px', 
      background: isScanned ? '#f1f5f9' : '#ffffff', 
      color: isScanned ? '#94a3b8' : '#16a34a',
      padding: '6px 12px', borderRadius: '20px', 
      fontSize: '11px', fontWeight: 800, display: 'flex', gap: '6px', alignItems: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }),
    qrBtn: { width: '100%', padding: '16px', background: '#000', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)', padding: '20px' },
    modalCard: { background: '#fff', width: '100%', maxWidth: '350px', borderRadius: '30px', padding: '40px 30px', textAlign: 'center', position: 'relative' },
    qrImage: { width: '220px', height: '220px', margin: '0 auto 20px', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '10px' },
    refDisplay: { fontFamily: 'monospace', background: '#f8fafc', color: '#64748b', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block', marginBottom: '20px', border: '1px solid #f1f5f9' }
  };

  if (loading) return <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.logo}>MY WALLET</h1>
          <p style={{margin: 0, fontSize: '12px', color: '#64748b'}}>{user?.email}</p>
        </div>
        <button onClick={handleLogout} style={{background: '#fff', border: '1px solid #eee', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
          <LogOut size={16} />
        </button>
      </div>

      <div style={styles.walletGrid}>
        {tickets.length === 0 ? (
           <div style={{textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: '#fff', borderRadius: '30px', border: '1px dashed #cbd5e1'}}>
             <Ticket size={48} style={{marginBottom: '20px', opacity: 0.3}} />
             <p style={{fontWeight: 600}}>No tickets found in your wallet.</p>
             <p style={{fontSize: '12px'}}>Ensure you used {user?.email} during checkout.</p>
           </div>
        ) : tickets.map((ticket) => (
          <div key={ticket.id} style={styles.card}>
            <div style={styles.cardMedia(ticket.events?.images?.[0])}>
               <div style={styles.badge(ticket.is_scanned)}>
                 {ticket.is_scanned ? <CheckCircle2 size={12}/> : <Clock size={12}/>}
                 {ticket.is_scanned ? 'USED' : 'VALID ENTRY'}
               </div>
            </div>

            <div style={styles.cardBody}>
              <span style={{fontSize: '10px', fontWeight: 900, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1px'}}>{ticket.tier_name || 'Standard'}</span>
              <h2 style={styles.eventTitle}>{ticket.events?.title || 'Unknown Event'}</h2>
              
              <div style={styles.metaRow}>
                <div style={styles.metaItem}><Calendar size={14}/> {ticket.events?.date || 'TBA'}</div>
                <div style={styles.metaItem}><MapPin size={14}/> {ticket.events?.location || 'TBA'}</div>
              </div>

              <button 
                style={styles.qrBtn} 
                onClick={() => setSelectedTicket(ticket)}
                disabled={ticket.is_scanned}
              >
                {ticket.is_scanned ? 'TICKET USED' : <><QrCode size={18} /> VIEW TICKET QR</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedTicket && (
        <div style={styles.overlay} onClick={() => setSelectedTicket(null)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedTicket(null)} style={{position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer'}}>
              <X size={24} color="#94a3b8"/>
            </button>
            
            <h3 style={{margin: '0 0 5px 0', fontWeight: 950, fontSize: '22px', letterSpacing: '-1px'}}>ENTRY PASS</h3>
            <p style={{margin: '0 0 25px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px'}}>
              {selectedTicket.guest_name}
            </p>

            {/* SECURITY: Tie QR to Reference AND Event ID to prevent cross-event fraud */}
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`REF:${selectedTicket.reference}|EVT:${selectedTicket.event_id}`)}`} 
              style={styles.qrImage} 
              alt="Secure Ticket QR" 
            />
            
            <div style={styles.refDisplay}>
              {selectedTicket.reference}
            </div>

            <div style={{background: '#f0fdf4', padding: '15px', borderRadius: '15px', display: 'flex', gap: '10px', alignItems: 'center', textAlign: 'left'}}>
              <AlertCircle size={16} color="#22c55e" />
              <p style={{fontSize: '11px', color: '#166534', margin: 0, fontWeight: 600}}>
                Valid for one entry. Present this at the venue gate for scanning.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
