"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Ticket, Calendar, MapPin, QrCode, LogOut, 
  Loader2, CheckCircle2, Navigation, 
  Car, Map as MapIcon, ChevronRight, ExternalLink,
  Clock, ShieldCheck, TrendingUp, DollarSign, Copy, Users, X
} from 'lucide-react';

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Data States
  const [tickets, setTickets] = useState([]);
  const [resellerProfile, setResellerProfile] = useState(null);
  const [availableEvents, setAvailableEvents] = useState([]); // For the marketplace
  const [myResellerLinks, setMyResellerLinks] = useState([]); // Links they already own
  
  // UI States
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(null);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Form States
  const [payoutForm, setPayoutForm] = useState({ bank_name: '', account_number: '' });

  useEffect(() => {
    fetchVaultData();
  }, []);

  const fetchVaultData = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) { 
        router.push('/login'); 
        return; 
      }
      setUser(user);

      // 1. Fetch Tickets with Event Details
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`*, events!event_id (id, title, date, time, location, lat, lng, image_url)`)
        .eq('guest_email', user.email)
        .order('created_at', { ascending: false });
      
      if (ticketError) throw ticketError;
      setTickets(ticketData || []);

      // 2. Check if User is a Reseller
      const { data: resellerData } = await supabase
        .from('resellers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(); 
      
      setResellerProfile(resellerData);

      if (resellerData) {
        // 3. If Reseller, fetch their active links
        const { data: links } = await supabase
          .from('event_resellers')
          .select(`*, events:event_id (id, title, image_url, price)`)
          .eq('reseller_id', resellerData.id);
        setMyResellerLinks(links || []);
      }

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

  /**
   * RIDE HAILING DEEP LINKS
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
        url = `bolt://explore?dropoff_lat=${lat}&dropoff_lng=${lng}`;
        break;
      case 'yango':
        url = `yango://?finish_lat=${lat}&finish_lng=${lng}`;
        break;
      case 'google':
        url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        break;
    }

    window.location.href = url;
    
    // Fallback for desktop/missing app
    setTimeout(() => {
        if (type === 'uber') window.open(`https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`);
        if (type === 'google') window.open(url);
    }, 500);
  };

  const handleJoinProgram = async (e) => {
    e.preventDefault();
    if (!payoutForm.bank_name || !payoutForm.account_number) {
        alert("Please fill in your payout details.");
        return;
    }

    const { error } = await supabase
        .from('resellers')
        .insert([{ 
            user_id: user.id,
            bank_name: payoutForm.bank_name,
            account_number: payoutForm.account_number,
            is_active: true
        }]);

    if (!error) {
        setShowJoinForm(false);
        fetchVaultData(); 
    } else {
        alert(error.message);
    }
  };

  const handleGenerateLink = async (event) => {
    if (!resellerProfile) return;
    
    // Clean unique code generation
    const userSlug = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const eventSlug = event.title.toLowerCase().replace(/\s+/g, '-').slice(0, 10);
    const uniqueCode = `${userSlug}-${eventSlug}`;

    const { error } = await supabase.from('event_resellers').insert([{
        reseller_id: resellerProfile.id,
        event_id: event.id,
        unique_code: uniqueCode
    }]);

    if (!error) {
        alert("Link Generated!");
        setShowMarketplace(false);
        fetchVaultData();
    } else {
        if (error.code === '23505') alert("You already have a link for this event.");
        else alert(error.message);
    }
  };

  const openMarketplace = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('allows_resellers', true)
      .eq('is_published', true);
    
    const myEventIds = myResellerLinks.map(l => l.event_id);
    const available = data?.filter(e => !myEventIds.includes(e.id)) || [];
    
    setAvailableEvents(available);
    setShowMarketplace(true);
  };

  const copyLink = (code) => {
    const url = `${window.location.origin}/event/checkout?ref=${code}`;
    navigator.clipboard.writeText(url);
    alert("Reseller Link Copied!");
  };

  // --- SUB-COMPONENTS ---

  const RideButton = ({ label, onClick, isSecondary }) => (
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
            alignItems: 'center',
            marginBottom: '10px'
        }}
    >
        {label} <ChevronRight size={16} />
    </button>
  );

  const JoinResellerCard = () => (
    <div style={{ background: 'linear-gradient(135deg, #CDa434 0%, #F5D76E 100%)', borderRadius: '30px', padding: '24px', color: '#000', marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
            <h3 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 10px' }}>THE INNER CIRCLE</h3>
            <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '20px', maxWidth: '80%' }}>
                Become an authorized partner. Sell tickets to exclusive events and earn <span style={{fontSize: '16px', fontWeight: '900'}}>10% commission</span> on every sale instantly.
            </p>
            <button 
                onClick={() => setShowJoinForm(true)}
                style={{ background: '#000', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                Start Earning <ChevronRight size={16} />
            </button>
        </div>
        <TrendingUp size={120} style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.15, color: '#000' }} />
    </div>
  );

  const ResellerStats = () => (
    <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#CDa434', letterSpacing: '1px' }}>PARTNER DASHBOARD</h2>
            <button onClick={openMarketplace} style={{ fontSize: '12px', background: 'rgba(205, 164, 52, 0.1)', color: '#CDa434', border: '1px solid #CDa434', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>+ Find Events</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div style={{ background: '#111', padding: '20px', borderRadius: '24px', border: '1px solid #222' }}>
                <div style={{ color: '#666', fontSize: '12px', fontWeight: '700', marginBottom: '5px' }}>TOTAL EARNED</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>GH₵ {resellerProfile?.total_earned || 0}</div>
            </div>
            <div style={{ background: '#111', padding: '20px', borderRadius: '24px', border: '1px solid #222' }}>
                <div style={{ color: '#666', fontSize: '12px', fontWeight: '700', marginBottom: '5px' }}>ACTIVE LINKS</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{myResellerLinks.length}</div>
            </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {myResellerLinks.map(link => (
                <div key={link.id} style={{ display: 'flex', alignItems: 'center', background: '#111', padding: '15px', borderRadius: '20px', border: '1px solid #222' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: `url(${link.events?.image_url}) center/cover`, marginRight: '15px' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{link.events?.title}</div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{link.sales_count || 0} Sales • {link.clicks || 0} Clicks</div>
                    </div>
                    <button onClick={() => copyLink(link.unique_code)} style={{ background: '#222', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Copy size={16} />
                    </button>
                </div>
            ))}
            {myResellerLinks.length === 0 && (
                <p style={{textAlign: 'center', color: '#444', fontSize: '13px', padding: '20px'}}>No links yet. Click "+ Find Events" to start.</p>
            )}
        </div>
    </div>
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
        
        {/* RESELLER SECTION - Dynamic Transition */}
        {resellerProfile ? <ResellerStats /> : <JoinResellerCard />}
        
        {/* TICKET WALLET SECTION */}
        <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#666', letterSpacing: '1px', marginBottom: '15px' }}>MY TICKETS</h2>
        
        {tickets.length === 0 ? (
           <p style={{ opacity: 0.3, fontSize: '13px', textAlign: 'center', padding: '40px' }}>Your wallet is empty.</p>
        ) : (
           tickets.map(ticket => (
             <div key={ticket.id} style={{ background: '#111', borderRadius: '24px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #222', position: 'relative' }}>
                <div style={{ height: '160px', background: `linear-gradient(to bottom, transparent, #111), url(${ticket.events?.image_url}) center/cover`, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 15, left: 15, background: '#CDa434', color: '#000', fontSize: '10px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px' }}>
                      {ticket.tier_name || 'VIP'}
                    </div>
                </div>
                <div style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px' }}>{ticket.events?.title}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px', opacity: 0.6, fontSize: '13px' }}>
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

      {/* MARKETPLACE MODAL */}
      {showMarketplace && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '20px' }}>
            <div style={{ flex: 1, maxWidth: '500px', margin: '0 auto', width: '100%', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', marginTop: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Event Marketplace</h2>
                    <button onClick={() => setShowMarketplace(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '50%' }}><X size={20}/></button>
                </div>
                {availableEvents.map(event => (
                    <div key={event.id} style={{ background: '#111', borderRadius: '20px', padding: '20px', marginBottom: '15px', border: '1px solid #222' }}>
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                          <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: `url(${event.image_url}) center/cover` }} />
                          <div>
                            <h3 style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px' }}>{event.title}</h3>
                            <span style={{ color: '#CDa434', fontSize: '12px', fontWeight: '800' }}>EARN 10% (GH₵ {(event.price * 0.1).toFixed(2)})</span>
                          </div>
                        </div>
                        <button 
                            onClick={() => handleGenerateLink(event)}
                            style={{ width: '100%', padding: '12px', background: '#fff', color: '#000', borderRadius: '12px', fontWeight: '800', border: 'none', cursor: 'pointer' }}
                        >
                            Promote & Earn
                        </button>
                    </div>
                ))}
                {availableEvents.length === 0 && <p style={{color: '#666', textAlign: 'center', marginTop: '40px'}}>No new events available to resell.</p>}
            </div>
        </div>
      )}

      {/* JOIN FORM MODAL */}
      {showJoinForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#161616', padding: '30px', borderRadius: '30px', maxWidth: '400px', width: '100%', border: '1px solid #333' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '10px' }}>Setup Payouts</h3>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Enter your details to receive commissions automatically.</p>
                
                <input 
                  type="text" 
                  placeholder="Bank Name" 
                  value={payoutForm.bank_name}
                  onChange={(e) => setPayoutForm({...payoutForm, bank_name: e.target.value})}
                  style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #333', borderRadius: '12px', color: '#fff', marginBottom: '10px' }} 
                />
                <input 
                  type="text" 
                  placeholder="Account Number" 
                  value={payoutForm.account_number}
                  onChange={(e) => setPayoutForm({...payoutForm, account_number: e.target.value})}
                  style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #333', borderRadius: '12px', color: '#fff', marginBottom: '20px' }} 
                />
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setShowJoinForm(false)} style={{ flex: 1, padding: '15px', background: 'transparent', color: '#fff', border: '1px solid #333', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleJoinProgram} style={{ flex: 1, padding: '15px', background: '#CDa434', color: '#000', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}>Confirm</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
