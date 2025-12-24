"use client";
import { motion } from 'framer-motion';
import { Heart, Zap } from 'lucide-react';

export default function VotingPage({ candidates }) {
  const handleVote = async (candidateId) => {
    const res = await fetch('/api/pay', {
      method: 'POST',
      body: JSON.stringify({
        type: 'VOTE',
        id: candidateId,
        amount: 1.00, // Price per vote
        email: 'voter@example.com',
        phone: '233XXXXXXXXX'
      })
    });
    const { url } = await res.json();
    window.location.href = url; // Redirect to Mobile Money
  };
useEffect(() => {
  // Listen for real-time vote updates from Supabase
  const channel = supabase
    .channel('realtime_votes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'candidates' }, payload => {
       // Update your local state here
       console.log('New Vote Received!', payload.new);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {candidates?.map(c => (
        <motion.div 
          whileTap={{ scale: 0.95 }}
          className="bg-white/80 backdrop-blur-lg rounded-3xl p-4 shadow-xl border border-white"
        >
          <img src={c.image_url} className="w-full aspect-square object-cover rounded-2xl mb-3" />
          <h3 className="font-bold text-gray-800 text-center">{c.name}</h3>
          <p className="text-xs text-center text-gray-500 mb-4">{c.vote_count} Votes</p>
          <button 
            onClick={() => handleVote(c.id)}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg"
          >
            <Zap size={16} fill="white" /> VOTE
          </button>
        </motion.div>
      ))}
    </div>
  );
}
