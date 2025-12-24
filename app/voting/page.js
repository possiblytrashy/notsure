"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CreditCard, Loader2, CheckCircle } from 'lucide-react';

export default function PublicVoting({ eventId }) {
  const [event, setEvent] = useState(null);
  const [options, setOptions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: eventData } = await supabase.from('events').select('*').eq('id', eventId).single();
      const { data: optionsData } = await supabase.from('voting_options').select('*').eq('event_id', eventId);
      setEvent(eventData);
      setOptions(optionsData);
    };
    fetchData();
  }, [eventId]);

  const handleVote = async () => {
    if (!selectedId) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in");

      // 1. SIMULATED PAYMENT LOGIC
      // In production, you would trigger Stripe/PayPal here
      const paymentSuccessful = true; 
      const mockPaymentId = "pay_" + Math.random().toString(36).substr(2, 9);

      if (paymentSuccessful) {
        const { error } = await supabase.from('votes').insert([{
          option_id: selectedId,
          user_id: user.id,
          event_id: eventId,
          paid: true,
          payment_intent_id: mockPaymentId
        }]);
        
        if (error) throw error;
        alert("Vote cast successfully!");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!event) return <Loader2 className="animate-spin" />;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '120px 20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontWeight: 950, fontSize: '40px' }}>{event.title}</h1>
        <div style={feeBadgeS}>VOTING FEE: ${event.vote_fee}</div>
      </header>

      <div style={gridS}>
        {options.map(opt => (
          <div 
            key={opt.id} 
            onClick={() => setSelectedId(opt.id)}
            style={{ ...cardS, border: selectedId === opt.id ? '3px solid #000' : '1px solid #eee' }}
          >
            <h3 style={{ margin: 0 }}>{opt.title}</h3>
            {selectedId === opt.id && <CheckCircle size={20} style={{ color: '#000' }} />}
          </div>
        ))}
      </div>

      <button 
        onClick={handleVote} 
        disabled={!selectedId || processing} 
        style={voteBtnS}
      >
        {processing ? <Loader2 className="animate-spin" /> : `PAY $${event.vote_fee} & VOTE`}
      </button>
    </div>
  );
}

const feeBadgeS = { display: 'inline-block', padding: '8px 20px', background: '#e73c7e', color: '#fff', borderRadius: '50px', fontWeight: 900, fontSize: '12px' };
const gridS = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const cardS = { padding: '30px', background: '#fff', borderRadius: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const voteBtnS = { width: '100%', marginTop: '30px', padding: '25px', background: '#000', color: '#fff', borderRadius: '25px', fontWeight: 900, cursor: 'pointer', border: 'none' };
