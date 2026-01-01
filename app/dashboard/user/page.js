"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Ticket, Calendar, MapPin, QrCode, LogOut, 
  Loader2, CheckCircle2, Navigation, 
  Car, Map as MapIcon, ChevronRight, ExternalLink,
  Clock, ShieldCheck, TrendingUp, DollarSign, Copy, Users
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

  useEffect(() => {
    fetchVaultData();
  }, []);

  const fetchVaultData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      // 1. Fetch Tickets
      const { data: ticketData } = await supabase
        .from('tickets')
        .select(`*, events!event_id (id, title, date, time, location, lat, lng, image_url)`)
        .eq('guest_email', user.email)
        .order('created_at', { ascending: false });
      
      setTickets(ticketData || []);

      // 2. Check if User is a Reseller
      const { data: resellerData } = await supabase
        .from('resellers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setResellerProfile(resellerData);

      if (resellerData) {
        // 3. If Reseller, fetch their active links
        const { data: links } = await supabase
          .from('event_resellers')
          .select(`*, events:event_id (title, image_url, price)`)
          .eq('reseller_id', resellerData.id);
        setMyResellerLinks(links || []);
      }

    } catch (err) {
      console.error("Vault Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinProgram = async (e) => {
    e.preventDefault();
    // In a real app, you would collect bank details here and send to Paystack API to create a subaccount
    // For now, we just create the profile row
    const { error } = await supabase.from('resellers').insert([{ user_id: user.id }]);
    if (!error) {
        setShowJoinForm(false);
        fetchVaultData(); // Refresh to show dashboard
    }
  };

  const handleGenerateLink = async (event) => {
    if (!resellerProfile) return;
    
    // Generate a unique code: user-event-random
    const uniqueCode = `${user.email.split('@')[0]}-${event.id.slice(0,4)}`.toLowerCase();

    const { error } = await supabase.from('event_resellers').insert([{
        reseller_id: resellerProfile.id,
        event_id: event.id,
        unique_code: uniqueCode
    }]);

    if (!error) {
        alert("Link Generated!");
        fetchVaultData(); // Refresh lists
    }
  };

  const openMarketplace = async () => {
    // Fetch events that allow reselling and aren't already in my links
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('allows_resellers', true)
      .eq('is_published', true);
    
    // Filter out events I already sell (client side for simplicity)
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

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div style={{ background: '#111', padding: '20px', borderRadius: '24px', border: '1px solid #222' }}>
                <div style={{ color: '#666', fontSize: '12px', fontWeight: '700', marginBottom: '5px' }}>TOTAL EARNED</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>GH₵ {resellerProfile.total_earned}</div>
            </div>
            <div style={{ background: '#111', padding: '20px', borderRadius: '24px', border: '1px solid #222' }}>
                <div style={{ color: '#666', fontSize: '12px', fontWeight: '700', marginBottom: '5px' }}>ACTIVE LINKS</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{myResellerLinks.length}</div>
            </div>
        </div>

        {/* Active Links List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {myResellerLinks.map(link => (
                <div key={link.id} style={{ display: 'flex', alignItems: 'center', background: '#111', padding: '15px', borderRadius: '20px', border: '1px solid #222' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: `url(${link.events?.image_url}) center/cover`, marginRight: '15px' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{link.events?.title}</div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{link.sales_count} Sales • {link.clicks} Clicks</div>
                    </div>
                    <button onClick={() => copyLink(link.unique_code)} style={{ background: '#222', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Copy size={16} />
                    </button>
                </div>
            ))}
        </div>
    </div>
  );

  if (loading) return <div style={{height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Loader2 className="animate-spin" color="#CDa434" /></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '20px 20px 100px', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '500px', margin: '0 auto 30px' }}>
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0 }}>THE VAULT</h1>
            <span style={{ fontSize: '11px', color: '#666', letterSpacing: '2px', fontWeight: 'bold' }}>ACCESS GRANTED</span>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={{ background: '#111', border: '1px solid #222', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LogOut size={16} /></button>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* RESELLER SECTION */}
        {resellerProfile ? <ResellerStats /> : <JoinResellerCard />}
        
        {/* TICKET WALLET SECTION */}
        <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#666', letterSpacing: '1px', marginBottom: '15px' }}>MY TICKETS</h2>
        
        {tickets.length === 0 ? (
           <p style={{ opacity: 0.3, fontSize: '13px', textAlign: 'center', padding: '40px' }}>Your wallet is empty.</p>
        ) : (
           tickets.map(ticket => (
             <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} style={{ background: '#111', borderRadius: '24px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #222', position: 'relative' }}>
                <div style={{ height: '140px', background: `url(${ticket.events?.image_url}) center/cover` }}>
                    <div style={{ position: 'absolute', top: 15, left: 15, background: '#CDa434', color: '#000', fontSize: '10px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px' }}>{ticket.tier_name}</div>
                </div>
                <div style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px' }}>{ticket.events?.title}</h3>
                    <p style={{ fontSize: '12px', color: '#666' }}>{ticket.events?.date} @ {ticket.events?.location}</p>
                </div>
             </div>
           ))
        )}
      </div>

      {/* MARKETPLACE MODAL */}
      {showMarketplace && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '20px' }}>
            <div style={{ flex: 1, maxWidth: '500px', margin: '0 auto', width: '100%', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Event Marketplace</h2>
                    <button onClick={() => setShowMarketplace(false)} style={{ background: 'none', border: 'none', color: '#fff' }}><CheckCircle2 /></button>
                </div>
                {availableEvents.map(event => (
                    <div key={event.id} style={{ background: '#161616', borderRadius: '20px', padding: '20px', marginBottom: '15px', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <h3 style={{ fontWeight: 'bold' }}>{event.title}</h3>
                            <span style={{ color: '#CDa434', fontWeight: 'bold' }}>Earn 10%</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>Base Price: GH₵ {event.price || 'Varies'}</p>
                        <button 
                            onClick={() => handleGenerateLink(event)}
                            style={{ width: '100%', padding: '12px', background: '#fff', color: '#000', borderRadius: '12px', fontWeight: '800', border: 'none', cursor: 'pointer' }}
                        >
                            Promote & Earn
                        </button>
                    </div>
                ))}
                {availableEvents.length === 0 && <p style={{color: '#666', textAlign: 'center'}}>No new events available to resell.</p>}
            </div>
        </div>
      )}

      {/* JOIN FORM MODAL (Simplified) */}
      {showJoinForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#161616', padding: '30px', borderRadius: '30px', maxWidth: '400px', width: '100%', border: '1px solid #333' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '10px' }}>Setup Payouts</h3>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>We need your bank details to send your 10% commission automatically.</p>
                
                <input type="text" placeholder="Bank Name" style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #333', borderRadius: '12px', color: '#fff', marginBottom: '10px' }} />
                <input type="text" placeholder="Account Number" style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #333', borderRadius: '12px', color: '#fff', marginBottom: '20px' }} />
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setShowJoinForm(false)} style={{ flex: 1, padding: '15px', background: 'transparent', color: '#fff', border: '1px solid #333', borderRadius: '12px', fontWeight: 'bold' }}>Cancel</button>
                    <button onClick={handleJoinProgram} style={{ flex: 1, padding: '15px', background: '#CDa434', color: '#000', border: 'none', borderRadius: '12px', fontWeight: '900' }}>Confirm</button>
                </div>
            </div>
        </div>
      )}
      
      {/* Existing Ticket/Transport Modals would go here... */}
    </div>
  );
}
