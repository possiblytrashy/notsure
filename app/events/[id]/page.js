"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, MapPin, Calendar, ShieldCheck, Loader2, User, Mail } from 'lucide-react';

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  
  // Data State
  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null); // Store user if logged in
  
  // Form State
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  
  // UI State
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Fetch Event & Check Login Status on Mount
  useEffect(() => {
    async function init() {
      // Get Event
      const { data: eventData, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) return console.error("Event fetch error:", error);
      setEvent(eventData);
      if (eventData?.ticket_tiers?.length > 0) setSelectedTier(0);

      // Check User Session (Don't block if not logged in)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        setGuestEmail(currentUser.email); // Auto-fill email
      }
    }
    if (id) init();
  }, [id]);

  // 2. THE NUCLEAR SCRIPT LOADER (Manual Injection)
  // This ensures the script is absolutely available when we need it
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
      script.onerror = () => reject('Failed to load Paystack script');
      document.body.appendChild(script);
    });
  };

  const handlePurchase = async (e) => {
    e.preventDefault();
    if (selectedTier === null || !event) return;
    
    // VALIDATION
    if (!guestEmail || !guestEmail.includes('@')) {
      alert("Please enter a valid email address to receive your ticket.");
      return;
    }
    
    setIsProcessing(true);

    try {
      // 3. LOAD PAYSTACK MANUALLY
      const PaystackPop = await loadPaystackScript();

      const tier = event.ticket_tiers[selectedTier];
      const amountInPesewas = Math.round(parseFloat(tier.price) * 100);
      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

      if (!publicKey) throw new Error("Paystack Key is missing in env variables");

      // 4. INITIALIZE PAYMENT
      const handler = PaystackPop.setup({
        key: publicKey,
        email: guestEmail, // Use the form input email
        amount: amountInPesewas,
        currency: 'GHS',
        metadata: {
          custom_fields: [
            { display_name: "Event", variable_name: "event_title", value: event.title },
            { display_name: "Customer Name", variable_name: "customer_name", value: guestName || "Guest" },
            { display_name: "Tier", variable_name: "ticket_tier", value: tier.name }
          ]
        },
        callback: async (response) => {
          // 5. SAVE TICKET (Handle Guest vs User)
          const ticketData = {
            event_id: id,
            tier_name: tier.name,
            amount: tier.price,
            reference: response.reference,
            status: 'paid',
            // If user is logged in, save ID. If guest, save null (ensure DB allows NULL)
            user_id: user ? user.id : null, 
            guest_email: guestEmail, // Ensure your DB has this column if you want to save it!
            guest_name: guestName
          };

          const { error } = await supabase.from('tickets').insert([ticketData]);

          if (error) {
            console.error("Supabase Error:", error);
            alert("Payment successful! Please screenshot this Reference ID: " + response.reference);
          } else {
            alert("Ticket Secured! Check your email.");
            // Only redirect to dashboard if they are actually a user
            if (user) {
              router.push('/dashboard/tickets');
            } else {
              // Reload or clear form for guests
              window.location.reload(); 
            }
          }
          setIsProcessing(false);
        },
        onClose: () => {
          setIsProcessing(false);
        }
      });

      handler.openIframe();

    } catch (error) {
      console.error("Purchase Error:", error);
      alert("Something went wrong initializing payment. Please try again.");
      setIsProcessing(false);
    }
  };

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

        {/* RIGHT: FORM & INFO */}
        <div style={{ padding: '20px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-2px', lineHeight: 1 }}>{event.title}</h1>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
             <span style={badgeStyle}><Calendar size={14}/> {event.date}</span>
             <span style={badgeStyle}><MapPin size={14}/> {event.location}</span>
          </div>

          <form onSubmit={handlePurchase}>
            
            {/* GUEST CHECKOUT FIELDS */}
            <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <h3 style={{ fontWeight: 900, fontSize: '16px', margin: 0 }}>Your Details</h3>
               
               <div style={inputContainerStyle}>
                  <User size={18} color="#64748b" />
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    style={inputStyle}
                  />
               </div>

               <div style={inputContainerStyle}>
                  <Mail size={18} color="#64748b" />
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                    style={inputStyle}
                  />
               </div>
               {!user && <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>* No login required. Ticket will be sent here.</p>}
            </div>

            <h3 style={{ fontWeight: 900, marginBottom: '15px', fontSize: '16px' }}>Select Experience</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {event.ticket_tiers?.map((tier, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedTier(idx)}
                  style={{ 
                    padding: '20px', borderRadius: '24px', border: '2px solid', 
                    borderColor: selectedTier === idx ? '#0ea5e9' : 'rgba(0,0,0,0.05)',
                    background: selectedTier === idx ? '#f0f9ff' : 'white',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 800 }}>{tier.name}</p>
                  <p style={{ margin: 0, fontWeight: 900, color: '#0ea5e9' }}>GHS {tier.price}</p>
                </div>
              ))}
            </div>

            <button 
              type="submit"
              disabled={isProcessing || selectedTier === null}
              style={checkoutBtn(isProcessing || selectedTier === null)}
            >
              {isProcessing ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Loader2 className="animate-spin" /> PROCESSING...
                </span>
              ) : (
                `PAY GHS ${event.ticket_tiers?.[selectedTier]?.price || '0.00'}`
              )}
            </button>
          </form>
          
          <div style={{ marginTop: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
            <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Secured by Paystack
          </div>
        </div>

      </div>
    </div>
  );
}

// STYLES
const baseArrowStyle = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const checkoutBtn = (disabled) => ({ width: '100%', background: disabled ? '#94a3b8' : '#000', color: '#fff', padding: '22px', borderRadius: '24px', border: 'none', fontWeight: 900, fontSize: '18px', marginTop: '25px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70px', transition: '0.3s' });
const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#475569' };
const inputContainerStyle = { display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '15px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' };
const inputStyle = { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '16px', fontWeight: 500, color: '#0f172a' };
