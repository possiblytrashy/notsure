"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Added useRouter for redirect
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, MapPin, Calendar, ShieldCheck, Loader2 } from 'lucide-react';

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function get() {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) return console.error("Event fetch error:", error);
      setEvent(data);
      if (data?.ticket_tiers?.length > 0) setSelectedTier(0);
    }
    if (id) get();
  }, [id]);

  // --- 1. THE FORCE LOADER ---
  // This manually injects the script into the document head when called
  const loadPaystackScript = () => {
    return new Promise((resolve, reject) => {
      // If already loaded, resolve immediately
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
    if (e) e.preventDefault();
    if (selectedTier === null || !event) return;
    
    setIsProcessing(true); // LOCK THE BUTTON

    try {
      // 2. CHECK USER
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please login to purchase tickets");
        setIsProcessing(false);
        return;
      }

      // 3. FORCE SCRIPT LOAD (The Nuclear Option)
      // We wait here until the script is physically ready in the browser
      const PaystackPop = await loadPaystackScript();

      // 4. PREPARE DATA
      const tier = event.ticket_tiers[selectedTier];
      const amountInPesewas = Math.round(parseFloat(tier.price) * 100);
      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

      if (!publicKey) throw new Error("Paystack Key is missing. Check .env file.");

      // 5. LAUNCH POPUP
      const handler = PaystackPop.setup({
        key: publicKey,
        email: user.email,
        amount: amountInPesewas,
        currency: 'GHS',
        metadata: {
          custom_fields: [
            { display_name: "Event", variable_name: "event_title", value: event.title },
            { display_name: "Tier", variable_name: "ticket_tier", value: tier.name }
          ]
        },
        callback: async (response) => {
          // Payment Success Logic
          const { error } = await supabase.from('tickets').insert([{
            event_id: id,
            user_id: user.id,
            tier_name: tier.name,
            amount: tier.price,
            reference: response.reference,
            status: 'paid'
          }]);

          if (error) {
            alert("Payment successful but ticket save failed. Ref: " + response.reference);
          } else {
            alert("Ticket Secured!");
            router.push('/dashboard/tickets');
          }
          setIsProcessing(false);
        },
        onClose: () => {
          alert("Payment window closed.");
          setIsProcessing(false);
        }
      });

      handler.openIframe();

    } catch (error) {
      console.error("Purchase Error:", error);
      alert(`Error: ${error.message || error}`);
      setIsProcessing(false);
    }
  };

  if (!event) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading...</div>;

  const nextImg = () => setCurrentImg((prev) => (prev + 1) % event.images.length);
  const prevImg = () => setCurrentImg((prev) => (prev - 1 + event.images.length) % event.images.length);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      {/* NO SCRIPT TAG HERE ANYMORE - WE LOAD IT MANUALLY IN JS */}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', alignItems: 'start' }}>
        
        {/* LEFT: IMAGES */}
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

        {/* RIGHT: CONTENT */}
        <div style={{ padding: '20px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-2px', lineHeight: 1 }}>{event.title}</h1>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
             <span style={badgeStyle}><Calendar size={14}/> {event.date}</span>
             <span style={badgeStyle}><MapPin size={14}/> {event.location}</span>
          </div>

          <form onSubmit={handlePurchase}>
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
                `GET ${event.ticket_tiers?.[selectedTier]?.name.toUpperCase() || 'TICKET'}S`
              )}
            </button>
          </form>
          
          <div style={{ marginTop: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
            <ShieldCheck size={14} style={{ display: 'inline' }} /> Secured by Paystack
          </div>
        </div>

      </div>
    </div>
  );
}

// STYLES
const baseArrowStyle = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const checkoutBtn = (disabled) => ({ width: '100%', background: disabled ? '#94a3b8' : '#000', color: '#fff', padding: '22px', borderRadius: '24px', border: 'none', fontWeight: 900, fontSize: '18px', marginTop: '25px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70px' });
const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#475569' };
