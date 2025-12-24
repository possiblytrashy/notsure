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
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) {
        console.error("Error fetching event:", error);
        return;
      }
      setEvent(data);
      if (data?.ticket_tiers?.length > 0) setSelectedTier(0);
    }
    if (id) get();
  }, [id]);

  const handlePurchase = async (e) => {
    // Prevent form from refreshing the page
    if (e) e.preventDefault();
    
    if (selectedTier === null || !event) return;
    
    setIsProcessing(true);
    const tier = event.ticket_tiers[selectedTier];
    const amountInPesewas = Math.round(parseFloat(tier.price) * 100);

    // 1. Get current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("Please login to purchase tickets");
      setIsProcessing(false);
      return;
    }

    // 2. Validate Paystack Key and Amount
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      alert("Paystack Public Key is missing in environment variables.");
      setIsProcessing(false);
      return;
    }

    // 3. Initialize Paystack
    try {
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: user.email,
        amount: amountInPesewas,
        currency: 'GHS',
        // Optional: reference: 'OUSTED_' + Math.floor((Math.random() * 1000000000) + 1),
        callback: async (response) => {
          // 4. Save ticket to database on success
          const { error } = await supabase.from('tickets').insert([{
            event_id: id,
            user_id: user.id,
            tier_name: tier.name,
            amount: tier.price,
            reference: response.reference,
            status: 'paid'
          }]);

          if (error) {
            console.error("Supabase Insert Error:", error);
            alert("Payment successful, but ticket record failed. Keep your reference: " + response.reference);
          } else {
            alert("Payment Successful! Your ticket is secured.");
            window.location.href = '/dashboard/tickets';
          }
          setIsProcessing(false);
        },
        onClose: () => {
          setIsProcessing(false);
        }
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
      {/* Load Paystack Inline JS */}
      <Script src="https://js.paystack.co/v1/inline.js" strategy="beforeInteractive" />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', alignItems: 'start' }}>
        
        {/* LEFT: IMAGE CAROUSEL */}
        <div style={{ position: 'relative', borderRadius: '40px', overflow: 'hidden', height: '600px', boxShadow: '0 30px 60px rgba(0,0,0,0.1)', background: '#f1f5f9' }}>
          {event.images && event.images.length > 0 ? (
            <img 
              src={event.images[currentImg]} 
              alt={event.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: '0.5s' }} 
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Image Available</div>
          )}
          
          {event.images?.length > 1 && (
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
          <h1 style={{ fontSize: '48px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-2px', lineHeight: 1 }}>{event.title}</h1>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
             <span style={badgeStyle}><Calendar size={14}/> {event.date}</span>
             <span style={badgeStyle}><MapPin size={14}/> {event.location}</span>
          </div>

          <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: '35px' }}>{event.description}</p>

          <h3 style={{ fontWeight: 900, marginBottom: '15px', fontSize: '20px' }}>Select Experience</h3>
          
          {/* Form wrapper to satisfy Paystack and handle submission */}
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
                    cursor: 'pointer', transition: '0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '18px' }}>{tier.name}</p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Instant Ticket Generation</p>
                  </div>
                  <p style={{ margin: 0, fontWeight: 900, color: '#0ea5e9', fontSize: '18px' }}>GHS {tier.price}</p>
                </div>
              ))}
            </div>

            <button 
              type="submit"
              disabled={isProcessing || selectedTier === null}
              style={checkoutBtn(isProcessing || selectedTier === null)}
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                `GET ${event.ticket_tiers?.[selectedTier]?.name.toUpperCase() || 'TICKET'}S`
              )}
            </button>
          </form>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '20px', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>
            <ShieldCheck size={14} /> Secured by Paystack & OUSTED Auth
          </div>
        </div>

      </div>
    </div>
  );
}

// STYLES
const baseArrowStyle = { 
  position: 'absolute', 
  top: '50%', 
  transform: 'translateY(-50%)', 
  background: 'rgba(255,255,255,0.9)', 
  border: 'none', 
  padding: '12px', 
  borderRadius: '50%', 
  cursor: 'pointer', 
  backdropFilter: 'blur(10px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  zIndex: 10
};

const checkoutBtn = (disabled) => ({
  width: '100%', 
  background: disabled ? '#94a3b8' : '#000', 
  color: '#fff', 
  padding: '22px', 
  borderRadius: '24px', 
  border: 'none', 
  fontWeight: 900, 
  fontSize: '18px', 
  marginTop: '25px', 
  cursor: disabled ? 'not-allowed' : 'pointer', 
  transition: '0.3s',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '70px'
});

const dotsContainer = { position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' };
const dot = { width: '8px', height: '8px', background: 'white', borderRadius: '50%' };
const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#475569' };
