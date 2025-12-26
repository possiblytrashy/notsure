"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, MapPin, Calendar, ShieldCheck, Loader2, User, Mail, CheckCircle2, Download } from 'lucide-react';

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: eventData } = await supabase.from('events').select('*').eq('id', id).single();
      setEvent(eventData);
      if (eventData?.ticket_tiers?.length > 0) setSelectedTier(0);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        setGuestEmail(currentUser.email);
        setGuestName(currentUser.user_metadata?.full_name || '');
      }
    }
    if (id) init();
  }, [id]);

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

  const handleDownloadPDF = () => window.print();

  const recordPayment = async (response, tier) => {
    const ticketData = {
      event_id: id,
      tier_name: tier.name,
      amount: parseFloat(tier.price),
      reference: response.reference, // This must exist in your DB
      status: 'paid',
      user_id: user ? user.id : null,
      guest_email: guestEmail,
      guest_name: guestName
    };

    const { error } = await supabase.from('tickets').insert([ticketData]);

    if (error) {
      console.error("Supabase Insertion Error:", error);
      // If DB fails, we still show success to the user so they don't panic, 
      // but we warn them to save the reference.
      setPaymentSuccess({
        reference: response.reference,
        tier: tier.name,
        price: tier.price,
        customer: guestName || "Guest",
        dbError: true 
      });
    } else {
      setPaymentSuccess({
        reference: response.reference,
        tier: tier.name,
        price: tier.price,
        customer: guestName || "Guest",
        dbError: false
      });
    }
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
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${paymentSuccess.reference}`;
    
    return (
      <div className="printable-ticket" style={{ maxWidth: '500px', margin: '40px auto', padding: '20px' }}>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .printable-ticket, .printable-ticket * { visibility: visible; }
            .printable-ticket { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>

        <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}>
          <CheckCircle2 size={50} color="#22c55e" style={{ margin: '0 auto 15px' }} className="no-print" />
          <h2 style={{ fontSize: '24px', fontWeight: 900 }}>{paymentSuccess.dbError ? "PAYMENT VERIFIED" : "TICKET SECURED"}</h2>
          {paymentSuccess.dbError && <p style={{ color: 'red', fontSize: '12px' }}>* Connection busy. Please screenshot this ticket now.</p>}
          <p style={{ color: '#64748b', marginBottom: '25px' }}>{event.title}</p>
          
          <div style={{ background: '#000', color: '#fff', padding: '20px', borderRadius: '24px', textAlign: 'left', marginBottom: '25px' }}>
             <p style={{ margin: '0 0 5px 0', fontSize: '10px', opacity: 0.6 }}>ATTENDEE</p>
             <p style={{ margin: '0 0 15px 0', fontWeight: 700 }}>{paymentSuccess.customer}</p>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: '0 0 5px 0', fontSize: '10px', opacity: 0.6 }}>TYPE</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{paymentSuccess.tier}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '10px', opacity: 0.6 }}>PRICE</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>GHS {paymentSuccess.price}</p>
                </div>
             </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <img src={qrUrl} alt="QR" style={{ width: '160px', height: '160px' }} />
            <p style={{ marginTop: '10px', fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>ID: {paymentSuccess.reference}</p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }} className="no-print">
            <button onClick={handleDownloadPDF} style={{ flex: 1, background: '#f1f5f9', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 700, cursor: 'pointer' }}>SAVE PDF</button>
            <button onClick={() => window.location.reload()} style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 700, cursor: 'pointer' }}>FINISH</button>
          </div>
        </div>
      </div>
    );
  }

  if (!event) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px' }}>
        <div style={{ borderRadius: '40px', overflow: 'hidden', height: '600px', background: '#f1f5f9' }}>
          <img src={event.images?.[currentImg]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div>
          <h1 style={{ fontSize: '42px', fontWeight: 900, marginBottom: '10px' }}>{event.title}</h1>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
             <span style={badgeStyle}><Calendar size={14}/> {event.date}</span>
             <span style={badgeStyle}><MapPin size={14}/> {event.location}</span>
          </div>

          <form onSubmit={handlePurchase}>
            <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <h3 style={{ fontWeight: 800, fontSize: '15px' }}>Buyer Information</h3>
               <div style={inputBox}><User size={18} color="#94a3b8" /><input placeholder="Full Name" value={guestName} onChange={(e)=>setGuestName(e.target.value)} required style={inputField} /></div>
               <div style={inputBox}><Mail size={18} color="#94a3b8" /><input type="email" placeholder="Email Address" value={guestEmail} onChange={(e)=>setGuestEmail(e.target.value)} required style={inputField} /></div>
            </div>

            <h3 style={{ fontWeight: 800, fontSize: '15px', marginBottom: '12px' }}>Select Ticket</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {event.ticket_tiers?.map((tier, idx) => (
                <div key={idx} onClick={() => setSelectedTier(idx)} style={{ padding: '18px', borderRadius: '20px', border: '2px solid', borderColor: selectedTier === idx ? '#0ea5e9' : '#f1f5f9', background: selectedTier === idx ? '#f0f9ff' : 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>{tier.name}</span>
                  <span style={{ fontWeight: 800, color: '#0ea5e9' }}>GHS {tier.price}</span>
                </div>
              ))}
            </div>

            <button type="submit" disabled={isProcessing || selectedTier === null} style={checkoutBtn(isProcessing || selectedTier === null)}>
              {isProcessing ? <Loader2 className="animate-spin" /> : `GET TICKET`}
            </button>
          </form>
          <div style={{ marginTop: '20px', textAlign: 'center', opacity: 0.5, fontSize: '12px' }}>
            <ShieldCheck size={14} style={{ display: 'inline' }} /> Secured by Paystack
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles
const badgeStyle = { display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 };
const inputBox = { display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '15px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' };
const inputField = { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontWeight: 600, fontSize: '14px' };
const checkoutBtn = (dis) => ({ width: '100%', background: dis ? '#cbd5e1' : '#000', color: '#fff', padding: '20px', borderRadius: '20px', border: 'none', fontWeight: 900, fontSize: '16px', marginTop: '25px', cursor: dis ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center' });
