 "use client";
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic'; 
import { supabase } from '../../../lib/supabase'; 
import { 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Loader2, 
  User, 
  Mail, 
  CheckCircle2, 
  Download, 
  Clock, 
  Share2,
  AlertCircle,
  Navigation,
  Car
} from 'lucide-react';

/**
 * LUXURY MAP COMPONENT
 * Dynamically imported to prevent Hydration errors (Error #321)
 * and to ensure Leaflet/Mapbox only loads on the client side.
 */
const LuxuryMap = dynamic(() => import('../../../components/LuxuryMap'), { 
  ssr: false,
  loading: () => (
    <div style={{
      height: '100%', 
      background: '#f1f5f9', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center'
    }}>
      <Loader2 className="animate-spin" />
    </div>
  )
});

// --- HELPER FUNCTIONS ---
const formatDate = (dateString) => {
  if (!dateString) return 'Date TBA';
  const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

const formatTime = (timeString) => {
    if (!timeString) return 'Time TBA';
    return timeString.substring(0, 5);
};

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref'); 
    
  // --- 1. STATE MANAGEMENT ---
  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [soldCounts, setSoldCounts] = useState({});
  const [reseller, setReseller] = useState(null);
  const [isResellerMode, setIsResellerMode] = useState(false);

  // --- 2. DATA INITIALIZATION ---
  const activeTier = useMemo(() => {
    return event?.ticket_tiers?.find(t => t.id === selectedTier);
  }, [event, selectedTier]);
  
  useEffect(() => {
    async function init() {
      try {
        // 1. Fetch Event Data with Organizer Payout Info
        const { data: eventData, error } = await supabase
        .from('events')
        .select(`
          *,
          organizers:organizer_profile_id (
            business_name,
            paystack_subaccount_code
          ),
          ticket_tiers (*) 
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (eventData.is_deleted) { setEvent('DELETED'); return; }

      // 2. Fetch real-time sold counts from tickets table
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('tier_id')
        .eq('event_id', id)
        .eq('status', 'valid');

      const counts = {};
      ticketData?.forEach(t => {
        counts[t.tier_id] = (counts[t.tier_id] || 0) + 1;
      });

      setSoldCounts(counts);
      setEvent(eventData);

      if (eventData.ticket_tiers?.length > 0) {
        setSelectedTier(eventData.ticket_tiers[0].id);
      }
        
        // Pre-fill user data if logged in
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          setGuestEmail(currentUser.email);
          setGuestName(currentUser.user_metadata?.full_name || '');
        }
      } catch (err) {
        console.error("Error loading event:", err);
        setEvent(null);
      } finally {
        setFetching(false);
      }
    }
    if (id) init();
  }, [id]);
useEffect(() => {
  if (!paymentSuccess?.reference) return;

  const fetchTicket = async () => {
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('reference', paymentSuccess.reference)
      .single();

    if (data) setTicket(data);
  };

  const interval = setInterval(fetchTicket, 2000);
  return () => clearInterval(interval);
}, [paymentSuccess]);
  // --- RESELLER VALIDATION & ANALYTICS ---
useEffect(() => {
    const validateReseller = async () => {
      if (!refCode || !id) return;
      
      try {
        const { data, error } = await supabase
          .from('event_resellers')
          .select(`
            *,
            resellers!reseller_id ( 
              id, 
              paystack_subaccount_code 
            )
          `)
          .eq('unique_code', refCode)
          .eq('event_id', id)
          .single();

        if (error) {
          console.error("Reseller Validation Error:", error.message);
          return;
        }

        if (data) {
          setReseller(data);
          setIsResellerMode(true);
          await supabase.rpc('increment_reseller_clicks', { link_id: data.id });
        }
      } catch (err) {
        console.error("Critical Reseller Error:", err);
      }
    };

    if (refCode) {
      localStorage.setItem('active_reseller_code', refCode);
      console.log("Reseller attribution captured:", refCode);
      validateReseller();
    }
  }, [refCode, id]); // Added proper dependency array

  // --- REAL-TIME TICKET UPDATES ---
  useEffect(() => {
    const channel = supabase
      .channel('realtime_tickets')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'tickets',
        filter: `event_id=eq.${id}` 
    }, (payload) => {
        setSoldCounts(prev => ({
          ...prev,
          [payload.new.tier_id]: (prev[payload.new.tier_id] || 0) + 1
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const getDisplayPrice = (originalPrice) => {
    if (!originalPrice) return 0;
    // Apply the 10% Luxury Reseller Markup if in reseller mode
    if (isResellerMode) {
      return (Number(originalPrice) * 1.10).toFixed(2);
    }
    return originalPrice;
  };
    
  // --- 3. RIDESHARING CONCIERGE LOGIC ---
  const handleRide = (type) => {
    if (!event.lat || !event.lng) return;
    
    const lat = event.lat;
    const lng = event.lng;
    const label = encodeURIComponent(event.location || event.title);

    const urls = {
      google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      apple: `maps://?q=${label}&ll=${lat},${lng}`,
      uber: `uber://?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${label}`,
      bolt: `bolt://ride?action=setDest&destination_lat=${lat}&destination_lng=${lng}&destination_name=${label}`,
      yango: `yango://?finish_lat=${lat}&finish_lon=${lng}`
    };

    const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (type === 'maps') {
      window.open(isApple ? urls.apple : urls.google, '_blank');
    } else {
      window.open(urls[type], '_blank');
    }
  };

  // --- 4. SECURE PAYSTACK TRANSACTION LOGIC ---
const loadPaystackScript = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return;

    if (window.PaystackPop) {
      return resolve(window.PaystackPop);
    }

    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) {
      existing.onload = () => resolve(window.PaystackPop);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = reject;
    document.body.appendChild(script);
  });
};


  const handlePurchase = async (e) => {
  if (e && e.preventDefault) e.preventDefault();
  
  if (!guestEmail || !guestEmail.includes('@')) {
    alert("Luxury Access requires a valid email.");
    return;
  }

  setIsProcessing(true);

  try {
    // 1. Get the secure session from your backend
    const res = await fetch('/api/checkout/secure-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: id,
        tier_id: selectedTier,
        email: guestEmail.trim(),
        guest_name: guestName,
        reseller_code: refCode || "DIRECT"
      })
    });

    const data = await res.json();
    console.log("FRONTEND_RECEIVE_CHECK:", data.access_code);

    if (!data.access_code) {
      alert(`Concierge Error: ${data.error || "Secure session failed"}`);
      setIsProcessing(false);
      return;
    }

    // 2. Calculate amount for the frontend setup (Must match backend exactly)
    // If your price is 50 GHS, this becomes 5000
    const displayPrice = getDisplayPrice(activeTier.price);
    const amountInPesewas = Math.round(parseFloat(displayPrice) * 100);

    const PaystackPop = await loadPaystackScript();
    // Inside handlePurchase, right before handler.openIframe()
const currentTierRef = activeTier; // Capture the current tier object

const handler = PaystackPop.setup({
  key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  access_code: data.access_code,
  email: guestEmail.trim(),
  amount: amountInPesewas,
  currency: "GHS",
  onSuccess: async (response) => {
  setPaymentSuccess({ reference: response.reference });
},
  onCancel: () => setIsProcessing(false)
});
    
    handler.openIframe();

  } catch (err) {
    console.error("Initialization Error:", err);
    alert(`Concierge Error: ${err.message}`);
    setIsProcessing(false);
  }
};

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title || 'Luxury Experience',
          text: `Join me at ${event?.title}`,
          url: shareUrl,
        });
      } catch (err) { console.log(err); }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard");
    }
  };

  // --- LOADING RENDER ---
  if (fetching) return (
    <div style={styles.loadingOverlay}>
      <Loader2 className="animate-spin" size={48} color="#000" />
      <p style={{ fontWeight: 800, marginTop: '20px', letterSpacing: '2px' }}>AUTHENTICATING ACCESS...</p>
    </div>
  );

  // --- ERROR RENDER ---
  if (event === 'DELETED' || !event) return (
    <div style={styles.loadingOverlay}>
      <AlertCircle size={48} color="#ef4444" />
      <h2 style={{ marginTop: '20px', fontWeight: 900 }}>EXPERIENCE UNAVAILABLE</h2>
      <button onClick={() => router.push('/')} style={styles.btnPrimary}>RETURN HOME</button>
    </div>
  );



  // --- 5. SUCCESS STATE (TICKET VIEW) ---
  if (paymentSuccess) {
// Inside the if (paymentSuccess) block
const qrPayload = encodeURIComponent(paymentSuccess.reference);
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${qrPayload}&qzone=2&format=png`;
return (
  <div style={styles.ticketWrapper}>
    <div style={styles.ticketCard} className="printable-ticket">
      <div style={{ textAlign: 'center' }}>
        <div style={styles.successIconWrap}><CheckCircle2 size={40} color="#22c55e" /></div>
        <h2 style={styles.ticketTitle}>ACCESS GRANTED</h2>
         <div style={styles.ticketDataRibbon}>
              <div style={styles.ribbonItem}>
                <span style={styles.ribbonLabel}>ATTENDEE</span>
                <span style={styles.ribbonValue}>{paymentSuccess.customer}</span>
              </div>
              <div style={styles.ribbonItem}>
                <span style={styles.ribbonLabel}>TIER</span>
                <span style={styles.ribbonValue}>{paymentSuccess.tier}</span>
              </div>
            </div>
        
        <div style={styles.qrSection}>
           <div style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <img 
    src={ticket.qr_code_url} 
    alt="Digital Access Key" 
    style={styles.qrImg} 
    // Add this error handler to see if the image is actually blocked
    onError={(e) => {
       e.target.style.display = 'none'; 
       console.error("QR Failed to Load"); 
    }}
  />
</div>
           <p style={styles.refText}>SECURE REF: {paymentSuccess.reference}</p>
        </div>
   

            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
              <div style={styles.mapContainer}>
                <LuxuryMap lat={event.lat} lng={event.lng} />
                <div style={styles.mapOverlay}>
                    <p style={{margin: 0, fontWeight: 800, fontSize: '12px'}}>{event.location}</p>
                    <button onClick={() => handleRide('maps')} style={styles.mapActionBtn}>
                      <Navigation size={12}/>
                    </button>
                </div>
              </div>
            </div>

            <div style={styles.conciergeBox}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                   <Car size={18} color="#000" />
                   <span style={{fontSize: '12px', fontWeight: 900}}>TRAVEL SUITE</span>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px'}}>
                   <button type="button" onClick={() => handleRide('uber')} style={styles.rideBtn}>Uber</button>
                   <button type="button" onClick={() => handleRide('bolt')} style={styles.rideBtn}>Bolt</button>
                   <button type="button" onClick={() => handleRide('yango')} style={styles.rideBtn}>Yango</button>
                </div>
            </div>

            <div style={styles.ticketActions}>
              <button onClick={() => window.print()} style={styles.btnSecondary}><Download size={18} /> SAVE PDF</button>
              <button onClick={() => window.location.reload()} style={styles.btnPrimary}>DONE</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 6. MAIN EVENT PAGE RENDER ---
  return (
    <div style={styles.pageLayout}>
      <style>{`
        * { box-sizing: border-box; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        @media (max-width: 1024px) {
          .content-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .main-frame { height: 450px !important; }
          .sticky-box { position: relative !important; top: 0 !important; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.6s ease-out forwards; }
      `}</style>

      <div style={styles.navBar} className="fade-in">
        <button onClick={() => router.back()} style={styles.backBtn}><ChevronLeft size={20} /> BACK</button>
        <button onClick={handleShare} style={styles.shareBtn}><Share2 size={18} /></button>
      </div>

      <div style={styles.contentGrid} className="content-grid fade-in">
        {/* GALLERY COLUMN */}
        <div style={styles.galleryColumn}>
          <div style={styles.mainDisplayFrame} className="main-frame">
            <img src={event.images?.[currentImg] || 'https://via.placeholder.com/800'} style={styles.mainImg} alt="Visual" />
            {event.images?.length > 1 && (
              <div style={styles.galleryNav}>
                <button style={styles.navArrow} onClick={() => setCurrentImg(prev => (prev === 0 ? event.images.length - 1 : prev - 1))}><ChevronLeft /></button>
                <button style={styles.navArrow} onClick={() => setCurrentImg(prev => (prev === event.images.length - 1 ? 0 : prev + 1))}><ChevronRight /></button>
              </div>
            )}
          </div>
          
          <div style={styles.thumbStrip}>
            {event.images?.map((img, i) => (
              <div key={i} onClick={() => setCurrentImg(i)} style={styles.thumbWrap(currentImg === i)}>
                <img src={img} style={styles.thumbImg} alt="Thumbnail" />
              </div>
            ))}
          </div>

          <div style={styles.descriptionSection}>
            <h3 style={styles.sectionLabel}>EXPERIENCE DETAILS</h3>
            <p style={styles.eventDescription}>{event.description}</p>
          </div>
        </div>

        {/* CHECKOUT SIDEBAR */}
        <div style={styles.sidebarColumn}>
          <div style={styles.stickyContent} className="sticky-box">
            <div style={styles.eventHeader}>
              <span style={styles.categoryBadge}>{event.category || 'Luxury Experience'}</span>
              <h1 style={styles.eventTitle}>{event.title}</h1>
            </div>

            <div style={styles.specsContainer}>
                <div style={styles.specsGrid}>
                    <div style={styles.specItem}>
                        <Calendar size={20} color="#0ea5e9" />
                        <div>
                            <p style={styles.specLabel}>DATE</p>
                            <p style={styles.specValue}>{formatDate(event.date)}</p>
                        </div>
                    </div>
                    <div style={styles.specItem}>
                        <Clock size={20} color="#f43f5e" />
                        <div>
                            <p style={styles.specLabel}>TIME</p>
                            <p style={styles.specValue}>{formatTime(event.time)}</p>
                        </div>
                    </div>
                </div>
                <div style={{...styles.specItem, marginTop: '15px'}}>
                    <MapPin size={20} color="#10b981" />
                    <div>
                        <p style={styles.specLabel}>LOCATION</p>
                        <p style={styles.specValue}>{event.location || 'Venue TBA'}</p>
                    </div>
                </div>
            </div>

            <div style={styles.checkoutCard}>
              <form onSubmit={handlePurchase}>
                <div style={styles.formSection}>
                  <h3 style={styles.formHeading}>1. GUEST IDENTITY</h3>
                  <div style={styles.inputContainer}><User size={18} color="#94a3b8" /><input style={styles.cleanInput} placeholder="Full Name" value={guestName} onChange={(e) => setGuestName(e.target.value)} required /></div>
                  <div style={styles.inputContainer}><Mail size={18} color="#94a3b8" /><input type="email" style={styles.cleanInput} placeholder="Email" value={guestEmail}  onChange={(e) => setGuestEmail(e.target.value)}  required /></div>
              </div>
              <div style={styles.formSection}>
                  <h3 style={styles.formHeading}>2. SELECT TIER</h3>
                  <div style={styles.tiersWrapper}>
                  {event.ticket_tiers?.map((tier) => {
                    const soldOut = tier.max_quantity > 0 && (soldCounts[tier.id] || 0) >= tier.max_quantity;
                    const displayPrice = getDisplayPrice(tier.price);
                    
                    return (
                        <div 
                        key={tier.id} 
                        onClick={() => !soldOut && setSelectedTier(tier.id)} 
                        style={styles.tierSelectionCard(selectedTier === tier.id, soldOut)}
                        >
                        <div style={styles.tierInfo}>
                            <p style={styles.tierName}>{tier.name} {soldOut && <span style={{color: '#ef4444'}}>(SOLD OUT)</span>}</p>
                            <p style={styles.tierDesc}>{tier.description}</p>
                        </div>
                        <div style={styles.tierPrice}>GHS {displayPrice}</div>
                        </div>
                    );
                    })}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isProcessing || selectedTier === null} 
                  style={styles.finalSubmitBtn(isProcessing || selectedTier === null)}
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <>GET ACCESS <ChevronRight size={20} /></>}
                </button>
              </form>
              <div style={styles.trustFooter}><ShieldCheck size={14} /><span>Secure Payments via Paystack</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 7. STYLES TOOLKIT ---
// Every property restored to ensure 1:1 visual match with your luxury design.
const styles = {
  pageLayout: { 
    maxWidth: '1300px', 
    margin: '0 auto', 
    padding: '20px 16px 100px', 
    fontFamily: '"Inter", sans-serif', 
    overflowX: 'hidden' 
  },
  navBar: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    marginBottom: '30px' 
  },
  backBtn: { 
    background: '#f8fafc', 
    border: '1px solid #f1f5f9', 
    padding: '10px 20px', 
    borderRadius: '12px', 
    fontWeight: 700, 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    cursor: 'pointer',
    fontSize: '13px'
  },
  shareBtn: { 
    width: '40px', 
    height: '40px', 
    borderRadius: '12px', 
    background: '#fff', 
    border: '1px solid #f1f5f9', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    cursor: 'pointer' 
  },
  contentGrid: { 
    display: 'grid', 
    gridTemplateColumns: '1.4fr 1fr', 
    gap: '60px' 
  },
  galleryColumn: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '30px' 
  },
  mainDisplayFrame: { 
    width: '100%', 
    borderRadius: '40px', 
    overflow: 'hidden', 
    height: '700px', 
    backgroundColor: '#f1f5f9', 
    position: 'relative', 
    boxShadow: '0 20px 40px rgba(0,0,0,0.05)' 
  },
  mainImg: { 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover' 
  },
  galleryNav: { 
    position: 'absolute', 
    bottom: '30px', 
    left: '50%', 
    transform: 'translateX(-50%)', 
    display: 'flex', 
    gap: '15px' 
  },
  navArrow: { 
    width: '44px', 
    height: '44px', 
    borderRadius: '50%', 
    background: '#fff', 
    border: 'none', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    cursor: 'pointer', 
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
  },
  thumbStrip: { 
    display: 'flex', 
    gap: '12px', 
    overflowX: 'auto', 
    paddingBottom: '10px' 
  },
  thumbWrap: (active) => ({ 
    width: '80px', 
    height: '80px', 
    borderRadius: '16px', 
    border: active ? '3px solid #000' : '3px solid transparent', 
    overflow: 'hidden', 
    cursor: 'pointer', 
    flexShrink: 0 
  }),
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  descriptionSection: { 
    background: '#fff', 
    padding: '40px', 
    borderRadius: '32px', 
    border: '1px solid #f1f5f9' 
  },
  sectionLabel: { 
    fontSize: '11px', 
    fontWeight: 900, 
    color: '#94a3b8', 
    letterSpacing: '2px', 
    marginBottom: '20px', 
    textTransform: 'uppercase' 
  },
  eventDescription: { 
    fontSize: '17px', 
    lineHeight: '1.8', 
    color: '#334155', 
    margin: 0 
  },
  sidebarColumn: { position: 'relative' },
  stickyContent: { 
    position: 'sticky', 
    top: '40px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '30px' 
  },
  eventHeader: { borderLeft: '5px solid #000', paddingLeft: '20px' },
  categoryBadge: { 
    background: '#000', 
    color: '#fff', 
    padding: '5px 12px', 
    borderRadius: '8px', 
    fontSize: '11px', 
    fontWeight: 800, 
    textTransform: 'uppercase', 
    marginBottom: '15px', 
    display: 'inline-block' 
  },
  eventTitle: { 
    fontSize: '48px', 
    fontWeight: 950, 
    letterSpacing: '-2px', 
    margin: 0, 
    lineHeight: 1 
  },
  specsContainer: { display: 'flex', flexDirection: 'column' },
  specsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  specItem: { 
    display: 'flex', 
    gap: '15px', 
    alignItems: 'center', 
    padding: '15px', 
    background: '#f8fafc', 
    borderRadius: '20px' 
  },
  specLabel: { fontSize: '10px', fontWeight: 800, color: '#94a3b8', margin: 0 },
  specValue: { fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 },
  checkoutCard: { 
    background: '#fff', 
    borderRadius: '35px', 
    padding: '40px', 
    boxShadow: '0 30px 60px rgba(0,0,0,0.06)', 
    border: '1px solid #f1f5f9' 
  },
  formSection: { marginBottom: '30px' },
  formHeading: { fontSize: '14px', fontWeight: 900, marginBottom: '20px', color: '#0f172a' },
  inputContainer: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    background: '#f1f5f9', 
    padding: '16px 20px', 
    borderRadius: '18px', 
    marginBottom: '12px' 
  },
  cleanInput: { 
    background: 'none', 
    border: 'none', 
    outline: 'none', 
    width: '100%', 
    fontSize: '15px', 
    fontWeight: 600 
  },
  tiersWrapper: { display: 'flex', flexDirection: 'column', gap: '12px' },
  tierSelectionCard: (active, soldOut) => ({ 
    padding: '20px', 
    borderRadius: '22px', 
    border: active ? '2px solid #000' : '2px solid #f1f5f9', 
    background: active ? '#f8fafc' : (soldOut ? '#f1f5f9' : '#fff'), 
    cursor: soldOut ? 'not-allowed' : 'pointer', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    opacity: soldOut ? 0.6 : 1
  }),
  tierInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  tierName: { fontWeight: 800, fontSize: '16px', margin: 0 },
  tierDesc: { fontSize: '12px', color: '#64748b', margin: 0 },
  tierPrice: { fontSize: '18px', fontWeight: 900, color: '#000' },
  finalSubmitBtn: (dis) => ({ 
    width: '100%', 
    background: dis ? '#cbd5e1' : '#000', 
    color: '#fff', 
    padding: '22px', 
    borderRadius: '22px', 
    border: 'none', 
    fontWeight: 900, 
    fontSize: '18px', 
    cursor: dis ? 'not-allowed' : 'pointer', 
    display: 'flex', 
    justifyContent: 'center', 
    gap: '10px' 
  }),
  trustFooter: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '8px', 
    fontSize: '12px', 
    color: '#94a3b8', 
    marginTop: '20px', 
    fontWeight: 600 
  },
  loadingOverlay: { 
    height: '100vh', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    background: '#fff' 
  },
  ticketWrapper: { 
    minHeight: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    background: '#fcfdfe', 
    padding: '20px' 
  },
  ticketCard: { 
    maxWidth: '480px', 
    width: '100%', 
    background: '#fff', 
    borderRadius: '40px', 
    padding: '50px', 
    boxShadow: '0 40px 80px rgba(0,0,0,0.12)', 
    border: '1px solid #f1f5f9' 
  },
  successIconWrap: { 
    width: '80px', 
    height: '80px', 
    borderRadius: '25px', 
    background: '#f0fdf4', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    margin: '0 auto 25px' 
  },
  ticketTitle: { 
    fontSize: '28px', 
    fontWeight: 950, 
    letterSpacing: '-1px', 
    margin: '0 0 10px' 
  },
  ticketSubTitle: { fontSize: '16px', color: '#64748b', margin: '0 0 30px' },
  ticketDataRibbon: { 
    background: '#000', 
    borderRadius: '24px', 
    padding: '25px', 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: '20px', 
    textAlign: 'left', 
    marginBottom: '30px', 
    color: '#fff' 
  },
  ribbonItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  ribbonLabel: { 
    fontSize: '9px', 
    fontWeight: 800, 
    color: 'rgba(255,255,255,0.5)', 
    textTransform: 'uppercase' 
  },
  ribbonValue: { fontSize: '14px', fontWeight: 700 },
  qrSection: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    marginBottom: '30px' 
  },
  qrImg: { 
    width: '200px', 
    height: '200px', 
    borderRadius: '20px', 
    border: '1px solid #f1f5f9', 
    padding: '10px' 
  },
  refText: { 
    marginTop: '15px', 
    fontSize: '11px', 
    fontWeight: 800, 
    color: '#94a3b8', 
    letterSpacing: '1px' 
  },
  ticketActions: { display: 'flex', gap: '15px' },
  btnPrimary: { 
    flex: 1, 
    background: '#000', 
    color: '#fff', 
    border: 'none', 
    padding: '18px', 
    borderRadius: '18px', 
    fontWeight: 800, 
    cursor: 'pointer' 
  },
  btnSecondary: { 
    flex: 1, 
    background: '#f1f5f9', 
    color: '#000', 
    border: 'none', 
    padding: '18px', 
    borderRadius: '18px', 
    fontWeight: 800, 
    cursor: 'pointer', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '8px' 
  },
  mapContainer: { 
    height: '350px', 
    borderRadius: '30px', 
    overflow: 'hidden', 
    position: 'relative', 
    border: '1px solid #f1f5f9', 
    zIndex: 0 
  },
  mapOverlay: { 
    position: 'absolute', 
    bottom: '20px', 
    left: '20px', 
    right: '20px', 
    background: '#fff', 
    padding: '10px 15px', 
    borderRadius: '20px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)', 
    zIndex: 999 
  },
  mapActionBtn: { 
    background: '#000', 
    color: '#fff', 
    border: 'none', 
    padding: '10px', 
    borderRadius: '12px', 
    fontSize: '11px', 
    fontWeight: 900, 
    cursor: 'pointer', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px' 
  },
  conciergeBox: { 
    background: '#f8fafc', 
    padding: '25px', 
    borderRadius: '25px', 
    marginBottom: '30px', 
    border: '1px solid #f1f5f9' 
  },
  rideBtn: { 
    background: '#fff', 
    border: '1px solid #e2e8f0', 
    padding: '12px', 
    borderRadius: '15px', 
    fontSize: '13px', 
    fontWeight: 800, 
    cursor: 'pointer', 
    flex: 1 
  },
};
