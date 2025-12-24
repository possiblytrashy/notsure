"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Added useRouter
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, MapPin, Calendar, ShieldCheck, Loader2 } from 'lucide-react';
import Script from 'next/script';

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    async function get() {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) return console.error("Error fetching event:", error);
      setEvent(data);
      if (data?.ticket_tiers?.length > 0) setSelectedTier(0);
    }
    if (id) get();
  }, [id]);

  const handlePurchase = async (e) => {
    if (e) e.preventDefault();
    
    // Safety check: if script isn't there, try to wait or alert
    if (typeof window.PaystackPop === 'undefined') {
      alert("Payment system is still initializing. Please wait 2 seconds and try again.");
      return;
    }

    if (selectedTier === null || !event || isProcessing) return;
    
    setIsProcessing(true);
    const tier = event.ticket_tiers[selectedTier];
    const amountInPesewas = Math.round(parseFloat(tier.price) * 100);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to purchase tickets");
      setIsProcessing(false);
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

    try {
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: user.email,
        amount: amountInPesewas,
        currency: 'GHS',
        callback: async (response) => {
          const { error } = await supabase.from('tickets').insert([{
            event_id: id,
            user_id: user.id,
            tier_name: tier.name,
            amount: tier.price,
            reference: response.reference,
            status: 'paid'
          }]);

          if (error) {
            alert("Payment successful! Please screenshot your reference: " + response.reference);
          } else {
            router.push('/dashboard/tickets');
          }
          setIsProcessing(false);
        },
        onClose: () => setIsProcessing(false)
      });

      handler.openIframe();
    } catch (err) {
      console.error("Paystack Setup Error:", err);
      setIsProcessing(false);
    }
  };

  if (!event) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading...</div>;

  const nextImg = () => setCurrentImg((prev) => (prev + 1) % event.images.length);
  const prevImg = () => setCurrentImg((prev) => (prev - 1 + event.images.length) % event.images.length);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      {/* 1. Force the script to load immediately */}
      <Script 
        src="https://js.paystack.co/v1/inline.js" 
        strategy="beforeInteractive"
        onLoad={() => setIsScriptLoaded(true)}
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', alignItems: 'start' }}>
        
        {/* IMAGE CAROUSEL */}
        <div style={{ position: 'relative', borderRadius: '40px', overflow: 'hidden', height: '600px', boxShadow: '0 30px 60px rgba(0,0,0,0.1)' }}>
          <img 
            src={event.images[currentImg]} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
          {event.images.length > 1 && (
            <>
              <button type="button" onClick={prevImg} style={{ ...baseArrowStyle, left: '20px' }}><ChevronLeft /></button>
              <button type="button" onClick={nextImg} style={{ ...baseArrowStyle, right: '20px' }}><ChevronRight /></button>
            </>
          )}
        </div>

        {/* INFO & PURCHASE */}
        <div style={{ padding: '20px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-2px' }}>{event.title}</h1>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
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
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between'
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
              {isProcessing ? <Loader2 className="animate-spin" /> : `GET ${event.ticket_tiers[selectedTier]?.name.toUpperCase() || 'TICKET'}S`}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '20px', color: '#94a3b8', fontSize: '12px' }}>
            <ShieldCheck size={14} style={{ verticalAlign: 'middle' }} /> Secure Payment via Paystack
          </div>
        </div>
      </div>
    </div>
  );
}

// STYLES
const baseArrowStyle = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.8)', border: 'none', padding: '12px', borderRadius: '50%', cursor: 'pointer', zIndex: 10 };
const checkoutBtn = (disabled) => ({ width: '100%', background: disabled ? '#94a3b8' : '#000', color: '#fff', padding: '25px', borderRadius: '24px', border: 'none', fontWeight: 900, fontSize: '18px', marginTop: '30px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center' });
const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 };
