"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, MapPin, Calendar, ShieldCheck, Loader2, User, Mail, CheckCircle2 } from 'lucide-react';

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  
  // Data States
  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  
  // Form States (Guest Checkout)
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  
  // UI States
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      // 1. Fetch Event
      const { data: eventData, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) return console.error("Event fetch error:", error);
      setEvent(eventData);
      if (eventData?.ticket_tiers?.length > 0) setSelectedTier(0);

      // 2. Check Auth Status (for auto-fill)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        setGuestEmail(currentUser.email);
        // Try to get name from metadata if it exists
        setGuestName(currentUser.user_metadata?.full_name || '');
      }
    }
    if (id) init();
  }, [id]);

  // FORCE SCRIPT LOADER (Nuclear Option)
  const loadPaystackScript = () => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) {
        resolve(window.PaystackPop);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => resolve(window.PaystackPop);
      script.onerror = () => reject(new Error('Paystack script failed to load'));
      document.body.appendChild(script);
    });
  };

  const handlePurchase = async (e) => {
    if (e) e.preventDefault();
    if (selectedTier === null || !event || isProcessing) return;

    // Validation
    if (!guestEmail || !guestEmail.includes('@')) {
      alert("Please enter a valid email address.");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Ensure Script is Loaded
      const PaystackPop = await loadPaystackScript();
      
      const tier = event.ticket_tiers[selectedTier];
      const amountInPesewas = Math.round(parseFloat(tier.price) * 100);
      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

      // 2. Initialize Paystack Setup
      const handler = PaystackPop.setup({
        key: publicKey,
        email: guestEmail.trim(),
        amount: amountInPesewas,
        currency: "GHS",
        metadata: {
          custom_fields: [
            { display_name: "Event", variable_name: "event_title", value: event.title },
            { display_name: "Attendee", variable_name: "attendee_name", value: guestName || "Guest" }
          ]
        },
        // Using explicit function to ensure context is correct
        callback: async function(response) {
          const ticketData = {
            event_id: id,
            tier_name: tier.name,
            amount: tier.price,
            reference: response.reference,
            status: 'paid',
            user_id: user ? user.id : null,
            guest_email: guestEmail,
            guest_name: guestName
          };

          const { error } = await supabase.from('tickets').insert([ticketData]);

          if (error) {
            console.error("Save Error:", error);
            alert("Payment successful! Please save your reference: " + response.reference);
          } else {
            setPaymentSuccess(true);
          }
          setIsProcessing(false);
        },
        onClose: function() {
          setIsProcessing(false);
        }
      });

      handler.openIframe();

    } catch (error) {
      console.error("Purchase Error:", error);
      alert("Could not load payment gateway. Check your connection.");
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div style={{ maxWidth: '500px', margin: '100px auto', textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}>
        <CheckCircle2 size={80} color="#22c55e" style={{ marginBottom: '20px' }} />
        <h2 style={{ fontSize: '32px', fontWeight: 900 }}>Ticket Secured!</h2>
        <p style={{ color: '#64748b', marginBottom: '30px' }}>Your ticket for <b>{event.title}</b> has been sent to <b>{guestEmail}</b>.</p>
        <button onClick={() => user ? router.push('/dashboard/tickets') : window.location.reload()} style={checkoutBtn(false)}>
          {user ? "View in Dashboard" : "Return to Event"}
        </button>
      </div>
    );
  }

  if (!event) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading...</div>;

  const nextImg = () => setCurrentImg((prev) => (prev + 1) % event.images.length);
  const prevImg = () => setCurrentImg((prev) => (prev - 1 + event.images.length) % event.images.length);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', alignItems: 'start' }}>
        
        {/* LEFT: IMAGE CAROUSEL */}
        <div style={{ position: 'relative', borderRadius: '40px', overflow: 'hidden', height: '600px', boxShadow: '0 30px 60px rgba(0,0,0,0.1)', background: '#f1f5f9' }}>
          {event.images && event.images.length > 0 ? (
            <img src={event.images[currentImg]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Image</div>
          )}
          {event.images?.length > 1 && (
            <>
              <button type="button" onClick={prevImg} style={{ ...baseArrowStyle, left: '20px' }}><ChevronLeft /></button>
              <button type="button" onClick={nextImg} style={{ ...baseArrowStyle, right: '20px' }}><ChevronRight /></button>
            </>
          )}
        </div>

        {/* RIGHT: DETAILS & GUEST FORM */}
        <div style={{ padding: '10px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-2px', lineHeight: 1 }}>{event.title}</h1>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
             <span style={badgeStyle}><Calendar size={14}/> {event.date}</span>
             <span style={badgeStyle}><MapPin size={14}/> {event.location}</span>
          </div>

          <form onSubmit={handlePurchase}>
            <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <h3 style={{ fontWeight: 900, fontSize: '18px', margin: '0 0 5px 0' }}>Contact Information</h3>
               
               <div style={inputBox}>
                  <User size={18} color="#94a3b8" />
                  <input type="text" placeholder="Full Name" value={guestName} onChange={(e)=>setGuestName(e.target.value)} required style={inputField} />
               </div>

               <div style={inputBox}>
                  <Mail size={18} color="#94a3b8" />
                  <input type="email" placeholder="Email Address" value={guestEmail} onChange={(e)=>setGuestEmail(e.target.value)} required style={inputField} />
               </div>
            </div>

            <h3 style={{ fontWeight: 900, fontSize: '18px', margin: '0 0 15px 0' }}>Select Ticket</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {event.ticket_tiers?.map((tier, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedTier(idx)}
                  style={{ 
                    padding: '20px', borderRadius: '24px', border: '2px solid', 
                    borderColor: selectedTier === idx ? '#0ea5e9' : 'rgba(0,0,0,0.05)',
                    background: selectedTier === idx ? '#f0f9ff' : 'white',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s'
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '17px' }}>{tier.name}</span>
                  <span style={{ fontWeight: 900, color: '#0ea5e9', fontSize: '17px' }}>GHS {tier.price}</span>
                </div>
              ))}
            </div>

            <button 
              type="submit" 
              disabled={isProcessing || selectedTier === null}
              style={checkoutBtn(isProcessing || selectedTier === null)}
            >
              {isProcessing ? (
                <><Loader2 className="animate-spin" style={{ marginRight: '10px' }} /> PROCESSING...</>
              ) : (
                `CONFIRM & PAY GHS ${event.ticket_tiers?.[selectedTier]?.price || '0.00'}`
              )}
            </button>
          </form>
          
          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
            <ShieldCheck size={16} /> 256-bit Secure Payment via Paystack
          </div>
        </div>
      </div>
    </div>
  );
}

// STYLES
const baseArrowStyle = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.95)', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, display: 'flex', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };
const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '10px 18px', borderRadius: '14px', fontSize: '14px', fontWeight: 700, color: '#475569' };
const inputBox = { display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '18px 20px', borderRadius: '20px', border: '1px solid #e2e8f0' };
const inputField = { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '16px', fontWeight: 600 };
const checkoutBtn = (disabled) => ({ 
  width: '100%', 
  background: disabled ? '#cbd5e1' : '#000', 
  color: '#fff', 
  padding: '24px', 
  borderRadius: '24px', 
  border: 'none', 
  fontWeight: 900, 
  fontSize: '18px', 
  marginTop: '30px', 
  cursor: disabled ? 'not-allowed' : 'pointer', 
  display: 'flex', 
  justifyContent: 'center', 
  alignItems: 'center',
  transition: 'all 0.3s ease'
});
