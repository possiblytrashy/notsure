"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Tag, 
  Info,
  Ticket as TicketIcon,
  Globe,
  Share2
} from 'lucide-react';

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  
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

  // --- 2. INITIALIZATION & DATA SYNC ---
  useEffect(() => {
    async function init() {
      try {
        // Fetch Event with related ticket tiers
        const { data: eventData, error } = await supabase
          .from('events')
          .select(`
            *,
            ticket_tiers (*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        setEvent(eventData);

        // Auto-select first tier if available
        if (eventData?.ticket_tiers?.length > 0) {
          setSelectedTier(0);
        }

        // Check Auth Status for pre-filling forms
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          setGuestEmail(currentUser.email);
          setGuestName(currentUser.user_metadata?.full_name || '');
        }
      } catch (err) {
        console.error("Error loading event:", err);
      } finally {
        setFetching(false);
      }
    }
    if (id) init();
  }, [id]);

  // --- 3. PAYMENT GATEWAY INTEGRATION ---
  const loadPaystackScript = () => {
    return new Promise((resolve) => {
      if (window.PaystackPop) return resolve(window.PaystackPop);
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => resolve(window.PaystackPop);
      document.body.appendChild(script);
    });
  };

  const recordPayment = async (response, tier) => {
    const ticketData = {
      event_id: id,
      tier_name: tier.name,
      amount: parseFloat(tier.price),
      reference: response.reference,
      status: 'paid',
      user_id: user ? user.id : null,
      guest_email: guestEmail,
      guest_name: guestName
    };

    const { error } = await supabase.from('tickets').insert([ticketData]);

    setPaymentSuccess({
      reference: response.reference,
      tier: tier.name,
      price: tier.price,
      customer: guestName || "Guest",
      dbError: !!error
    });
    
    setIsProcessing(false);
  };

  const handlePurchase = async (e) => {
    if (e) e.preventDefault();
    if (selectedTier === null || !event || isProcessing) return;
    
    setIsProcessing(true);

    try {
      const PaystackPop = await loadPaystackScript();
      const tier = event.ticket_tiers[selectedTier];
      
      const handler = PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: guestEmail.trim(),
        amount: Math.round(parseFloat(tier.price) * 100),
        currency: "GHS",
        callback: function(res) { recordPayment(res, tier); },
        onClose: function() { setIsProcessing(false); }
      });
      handler.openIframe();
    } catch (err) {
      console.error("Payment setup failed:", err);
      setIsProcessing(false);
    }
  };

  // --- 4. SUCCESS COMPONENT (THE TICKET) ---
  if (paymentSuccess) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${paymentSuccess.reference}`;
    
    return (
      <div style={ticketWrapper}>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .printable-ticket, .printable-ticket * { visibility: visible; }
            .printable-ticket { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>

        <div className="printable-ticket" style={ticketCard}>
          <div style={{ textAlign: 'center' }}>
            <div style={successIconWrap} className="no-print">
              <CheckCircle2 size={40} color="#22c55e" />
            </div>
            <h2 style={ticketTitle}>{paymentSuccess.dbError ? "PAYMENT VERIFIED" : "ACCESS GRANTED"}</h2>
            <p style={ticketSubTitle}>{event.title}</p>
            
            {paymentSuccess.dbError && (
              <div style={warningBox}>
                <AlertCircle size={14} />
                <span>Save this screenshot. Connection to database is slow.</span>
              </div>
            )}

            <div style={ticketDataRibbon}>
              <div style={ribbonItem}>
                <span style={ribbonLabel}>ATTENDEE</span>
                <span style={ribbonValue}>{paymentSuccess.customer}</span>
              </div>
              <div style={ribbonItem}>
                <span style={ribbonLabel}>TIER</span>
                <span style={ribbonValue}>{paymentSuccess.tier}</span>
              </div>
              <div style={ribbonItem}>
                <span style={ribbonLabel}>REFERENCE</span>
                <span style={ribbonValue}>{paymentSuccess.reference.substring(0, 10)}</span>
              </div>
            </div>

            <div style={qrSection}>
              <img src={qrUrl} alt="Ticket QR" style={qrImg} />
              <div style={scanLine} className="no-print"></div>
              <p style={refText}>REF: {paymentSuccess.reference}</p>
            </div>

            <div style={ticketActions} className="no-print">
              <button onClick={() => window.print()} style={btnSecondary}>
                <Download size={18} /> SAVE PDF
              </button>
              <button onClick={() => window.location.reload()} style={btnPrimary}>
                DONE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 5. MAIN EVENT UI ---
  if (fetching) return (
    <div style={loadingOverlay}>
      <Loader2 className="animate-spin" size={48} color="#000" />
      <p style={{ fontWeight: 800, marginTop: '20px' }}>SECURELY LOADING EXPERIENCE...</p>
    </div>
  );

  return (
    <div style={pageLayout}>
      {/* HEADER NAVIGATION */}
      <div style={navBar}>
        <button onClick={() => router.back()} style={backBtn}>
          <ChevronLeft size={20} /> BACK TO DISCOVER
        </button>
        <button style={shareBtn}><Share2 size={18} /></button>
      </div>

      <div style={contentGrid}>
        
        {/* LEFT COLUMN: MULTI-IMAGE GALLERY */}
        <div style={galleryColumn}>
          <div style={mainDisplayFrame}>
            <img 
              src={event.images?.[currentImg] || 'https://via.placeholder.com/800x1000'} 
              style={mainImg} 
              alt="Event Poster" 
            />
            {event.images?.length > 1 && (
              <div style={galleryNav}>
                <button 
                  style={navArrow} 
                  onClick={() => setCurrentImg(prev => (prev === 0 ? event.images.length - 1 : prev - 1))}
                >
                  <ChevronLeft />
                </button>
                <button 
                  style={navArrow} 
                  onClick={() => setCurrentImg(prev => (prev === event.images.length - 1 ? 0 : prev + 1))}
                >
                  <ChevronRight />
                </button>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {event.images?.length > 1 && (
            <div style={thumbStrip}>
              {event.images.map((img, i) => (
                <div 
                  key={i} 
                  onClick={() => setCurrentImg(i)}
                  style={thumbWrap(currentImg === i)}
                >
                  <img src={img} style={thumbImg} />
                </div>
              ))}
            </div>
          )}

          {/* Description Block */}
          <div style={descriptionSection}>
            <h3 style={sectionLabel}>ABOUT THIS EXPERIENCE</h3>
            <p style={eventDescription}>{event.description}</p>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILS & CHECKOUT */}
        <div style={sidebarColumn}>
          <div style={stickyContent}>
            <div style={eventHeader}>
              <span style={categoryBadge}>{event.category || 'Special Event'}</span>
              <h1 style={eventTitle}>{event.title}</h1>
            </div>

            {/* SPECS GRID */}
            <div style={specsGrid}>
              <div style={specItem}>
                <Calendar size={20} color="#0ea5e9" />
                <div>
                  <p style={specLabel}>DATE</p>
                  <p style={specValue}>{event.date}</p>
                </div>
              </div>
              <div style={specItem}>
                <Clock size={20} color="#8b5cf6" />
                <div>
                  <p style={specLabel}>TIME</p>
                  <p style={specValue}>{event.time}</p>
                </div>
              </div>
              <div style={specItem}>
                <MapPin size={20} color="#f43f5e" />
                <div>
                  <p style={specLabel}>LOCATION</p>
                  <p style={specValue}>{event.location}</p>
                </div>
              </div>
              <div style={specItem}>
                <Globe size={20} color="#10b981" />
                <div>
                  <p style={specLabel}>VISIBILITY</p>
                  <p style={specValue}>Public Event</p>
                </div>
              </div>
            </div>

            {/* CHECKOUT FORM */}
            <div style={checkoutCard}>
              <form onSubmit={handlePurchase}>
                <div style={formSection}>
                  <h3 style={formHeading}>1. YOUR DETAILS</h3>
                  <div style={inputContainer}>
                    <User size={18} color="#94a3b8" />
                    <input 
                      style={cleanInput} 
                      placeholder="Full Name" 
                      value={guestName} 
                      onChange={(e) => setGuestName(e.target.value)} 
                      required 
                    />
                  </div>
                  <div style={inputContainer}>
                    <Mail size={18} color="#94a3b8" />
                    <input 
                      type="email" 
                      style={cleanInput} 
                      placeholder="Email Address" 
                      value={guestEmail} 
                      onChange={(e) => setGuestEmail(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div style={formSection}>
                  <h3 style={formHeading}>2. CHOOSE ACCESS LEVEL</h3>
                  <div style={tiersWrapper}>
                    {event.ticket_tiers?.map((tier, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedTier(idx)} 
                        style={tierSelectionCard(selectedTier === idx)}
                      >
                        <div style={tierInfo}>
                          <p style={tierName}>{tier.name}</p>
                          <p style={tierDesc}>{tier.description || 'General Admission'}</p>
                        </div>
                        <div style={tierPrice}>GHS {tier.price}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isProcessing || selectedTier === null} 
                  style={finalSubmitBtn(isProcessing || selectedTier === null)}
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>GET ACCESS NOW <ChevronRight size={20} /></>
                  )}
                </button>
              </form>

              <div style={trustFooter}>
                <ShieldCheck size={14} />
                <span>Encrypted Payment Processing by Paystack</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- FULL STYLING ENGINE (NO TRUNCATION) ---

const pageLayout = { maxWidth: '1300px', margin: '0 auto', padding: '20px 24px 100px', fontFamily: '"Inter", sans-serif' };
const navBar = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' };
const backBtn = { background: '#f8fafc', border: '1px solid #f1f5f9', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' };
const shareBtn = { width: '40px', height: '40px', borderRadius: '12px', background: '#fff', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const contentGrid = { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '60px' };

// GALLERY STYLES
const galleryColumn = { display: 'flex', flexDirection: 'column', gap: '30px' };
const mainDisplayFrame = { width: '100%', borderRadius: '40px', overflow: 'hidden', height: '700px', backgroundColor: '#f1f5f9', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' };
const mainImg = { width: '100%', height: '100%', objectFit: 'cover' };
const galleryNav = { position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '15px' };
const navArrow = { width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };

const thumbStrip = { display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' };
const thumbWrap = (active) => ({ width: '90px', height: '90px', borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', border: active ? '3px solid #000' : '3px solid transparent', transition: '0.2s', flexShrink: 0 });
const thumbImg = { width: '100%', height: '100%', objectFit: 'cover' };

const descriptionSection = { background: '#fff', padding: '40px', borderRadius: '32px', border: '1px solid #f1f5f9' };
const sectionLabel = { fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '2px', marginBottom: '20px' };
const eventDescription = { fontSize: '17px', lineHeight: '1.8', color: '#334155', margin: 0 };

// SIDEBAR STYLES
const sidebarColumn = { position: 'relative' };
const stickyContent = { position: 'sticky', top: '40px', display: 'flex', flexDirection: 'column', gap: '30px' };
const eventHeader = { borderLeft: '5px solid #000', paddingLeft: '20px' };
const categoryBadge = { background: '#000', color: '#fff', padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '15px', display: 'inline-block' };
const eventTitle = { fontSize: '48px', fontWeight: 950, letterSpacing: '-2px', margin: 0, lineHeight: 1 };

const specsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const specItem = { display: 'flex', gap: '15px', alignItems: 'center', padding: '15px', background: '#f8fafc', borderRadius: '20px' };
const specLabel = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', margin: 0 };
const specValue = { fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 };

// CHECKOUT STYLES
const checkoutCard = { background: '#fff', borderRadius: '35px', padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' };
const formSection = { marginBottom: '30px' };
const formHeading = { fontSize: '14px', fontWeight: 900, marginBottom: '20px', color: '#0f172a' };
const inputContainer = { display: 'flex', alignItems: 'center', gap: '12px', background: '#f1f5f9', padding: '16px 20px', borderRadius: '18px', marginBottom: '12px' };
const cleanInput = { background: 'none', border: 'none', outline: 'none', width: '100%', fontSize: '15px', fontWeight: 600 };

const tiersWrapper = { display: 'flex', flexDirection: 'column', gap: '12px' };
const tierSelectionCard = (active) => ({ 
  padding: '20px', borderRadius: '22px', border: active ? '2px solid #000' : '2px solid #f1f5f9', 
  background: active ? '#f8fafc' : '#fff', cursor: 'pointer', display: 'flex', 
  justifyContent: 'space-between', alignItems: 'center', transition: '0.2s' 
});
const tierName = { fontWeight: 800, fontSize: '16px', margin: 0 };
const tierDesc = { fontSize: '12px', color: '#64748b', margin: '4px 0 0' };
const tierPrice = { fontSize: '18px', fontWeight: 900, color: '#000' };

const finalSubmitBtn = (dis) => ({ width: '100%', background: dis ? '#cbd5e1' : '#000', color: '#fff', padding: '22px', borderRadius: '22px', border: 'none', fontWeight: 900, fontSize: '18px', cursor: dis ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', gap: '10px', transition: 'transform 0.2s' });
const trustFooter = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8', marginTop: '20px', fontWeight: 600 };

const loadingOverlay = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };

// TICKET COMPONENT STYLES
const ticketWrapper = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fcfdfe', padding: '40px' };
const ticketCard = { maxWidth: '480px', width: '100%', background: '#fff', borderRadius: '40px', padding: '50px', boxShadow: '0 40px 80px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9' };
const successIconWrap = { width: '80px', height: '80px', borderRadius: '25px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px' };
const ticketTitle = { fontSize: '28px', fontWeight: 950, letterSpacing: '-1px', margin: '0 0 10px' };
const ticketSubTitle = { fontSize: '16px', color: '#64748b', margin: '0 0 30px' };
const warningBox = { background: '#fff7ed', color: '#c2410c', padding: '12px', borderRadius: '12px', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '25px', fontWeight: 600 };

const ticketDataRibbon = { background: '#000', borderRadius: '24px', padding: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', textAlign: 'left', marginBottom: '30px', color: '#fff' };
const ribbonItem = { display: 'flex', flexDirection: 'column', gap: '4px' };
const ribbonLabel = { fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' };
const ribbonValue = { fontSize: '14px', fontWeight: 700 };

const qrSection = { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' };
const qrImg = { width: '200px', height: '200px', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '10px' };
const scanLine = { position: 'absolute', width: '220px', height: '2px', background: 'rgba(34, 197, 94, 0.5)', top: '50%', boxShadow: '0 0 15px #22c55e' };
const refText = { marginTop: '15px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' };

const ticketActions = { display: 'flex', gap: '15px' };
const btnPrimary = { flex: 1, background: '#000', color: '#fff', border: 'none', padding: '18px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer' };
const btnSecondary = { flex: 1, background: '#f1f5f9', color: '#000', border: 'none', padding: '18px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
