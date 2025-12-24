"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, MapPin, Calendar, ShieldCheck, Loader2 } from 'lucide-react';
import Script from 'next/script';

export default function EventPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function get() {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      setEvent(data);
      if (data?.ticket_tiers?.length > 0) setSelectedTier(0);
    }
    if (id) get();
  }, [id]);

  const handlePurchase = async () => {
    if (selectedTier === null) return;
    
    setIsProcessing(true);
    const tier = event.ticket_tiers[selectedTier];

    // 1. Get current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to purchase tickets");
      setIsProcessing(false);
      return;
    }

    // 2. Initialize Paystack
    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, // Uses your env variable
      email: user.email,
      amount: parseFloat(tier.price) * 100, // GHS to Pesewas
      currency: 'GHS',
      callback: async (response) => {
        // 3. Save ticket to database on success
        const { error } = await supabase.from('tickets').insert([{
          event_id: id,
          user_id: user.id,
          tier_name: tier.name,
          amount: tier.price,
          reference: response.reference,
          status: 'paid'
        }]);

        if (error) {
          console.error(error);
          alert("Payment successful, but failed to save ticket. Contact support.");
        } else {
          alert("Ticket secured! Redirecting...");
          window.location.href = '/dashboard/tickets';
        }
        setIsProcessing(false);
      },
      onClose: () => setIsProcessing(false)
    });

    handler.openIframe();
  };

  if (!event) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading...</div>;

  const nextImg = () => setCurrentImg((prev) => (prev + 1) % event.images.length);
  const prevImg = () => setCurrentImg((prev) => (prev - 1 + event.images.length) % event.images.length);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      <Script src="https://js.paystack.co/v1/inline.js" />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', alignItems: 'start' }}>
        
        {/* LEFT: IMAGE CAROUSEL */}
        <div style={{ position: 'relative', borderRadius: '40px', overflow: 'hidden', height: '600px', boxShadow: '0 30px 60px rgba(0,0,0,0.1)' }}>
          <img 
            src={event.images[currentImg]} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: '0.5s' }} 
          />
          {event.images.length > 1 && (
            <>
              <button onClick={prevImg} style={{ ...baseArrowStyle, left: '20px' }}><ChevronLeft /></button>
              <button onClick={nextImg} style={{ ...baseArrowStyle, right: '20px' }}><ChevronRight /></button>
              <div style={dotsContainer}>
                {event.images.map((_, i) => (
                  <div key={i} style={{ ...dot, opacity: i === currentImg ? 1 : 0.5 }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: TICKET SELECTION & INFO */}
        <div style={{ padding: '20px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-2px' }}>{event.title}</h1>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
             <span style={badgeStyle}><Calendar size={14}/> {event.date}</span>
             <span style={badgeStyle}><MapPin size={14}/> {event.location}</span>
          </div>

          <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: '40px' }}>{event.description}</p>

          <h3 style={{ fontWeight: 900, marginBottom: '20px', fontSize: '20px' }}>Select Experience</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {event.ticket_tiers?.map((tier, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedTier(idx)}
                style={{ 
                  padding: '20px', borderRadius: '24px', border: '2px solid', 
                  borderColor: selectedTier === idx ? '#0ea5e9' : 'rgba(0,0,0,0.05)',
                  background: selectedTier === idx ? '#f0f9ff' : 'white',
                  cursor: 'pointer', transition: '0.2s', display: 'flex', justifyContent: 'space-between'
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: '18px' }}>{tier.name}</p>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Instant Delivery</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 900, color: '#0ea5e9', fontSize: '18px' }}>GHS {tier.price}</p>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handlePurchase}
            disabled={isProcessing}
            style={checkoutBtn(isProcessing)}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : `GET ${event.ticket_tiers[selectedTier]?.name.toUpperCase() || 'TICKET'} `}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '20px', color: '#64748b', fontSize: '12px' }}>
            <ShieldCheck size={14} /> Secured by Paystack & OUSTED
          </div>
        </div>

      </div>
    </div>
  );
}

// FIXED STYLES
const baseArrowStyle = { 
  position: 'absolute', 
  top: '50%', 
  transform: 'translateY(-50%)', 
  background: 'rgba(255,255,255,0.8)', 
  border: 'none', 
  padding: '12px', 
  borderRadius: '50%', 
  cursor: 'pointer', 
  backdropFilter: 'blur(10px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10
};

const checkoutBtn = (loading) => ({
  width: '100%', 
  background: loading ? '#444' : '#000', 
  color: '#fff', 
  padding: '25px', 
  borderRadius: '24px', 
  border: 'none', 
  fontWeight: 900, 
  fontSize: '18px', 
  marginTop: '30px', 
  cursor: loading ? 'not-allowed' : 'pointer', 
  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
});

const dotsContainer = { position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' };
const dot = { width: '8px', height: '8px', background: 'white', borderRadius: '50%' };
const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.05)', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 };
