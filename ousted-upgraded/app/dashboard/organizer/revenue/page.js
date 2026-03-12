"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { DollarSign, Download, TrendingUp, Account, ArrowUpRight } from 'lucide-react';

export default function RevenueDashboard() {
  const [sales, setSales] = useState({ total: 0, balance: 0, pending: 0 });
  const [tierBreakdown, setTierBreakdown] = useState([]);

  useEffect(() => {
    // Logic to calculate revenue from 'tickets' joined with 'events'
    // For now, we'll use mock data until your payment gateway is connected
    setSales({ total: 12500, balance: 8400, pending: 4100 });
    setTierBreakdown([
      { name: 'General', sold: 85, revenue: 8500 },
      { name: 'VIP', sold: 12, revenue: 3600 },
      { name: 'Table of 4', sold: 1, revenue: 400 }
    ]);
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '120px 20px' }}>
      <h1 style={{ fontWeight: 900, fontSize: '36px', marginBottom: '30px' }}>Financial Overview</h1>

      {/* REVENUE CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={revenueCard('#000', '#fff')}>
          <p style={{ opacity: 0.7, fontWeight: 700 }}>Withdrawable Balance</p>
          <h2 style={{ fontSize: '42px', fontWeight: 900, margin: '10px 0' }}>GHS {sales.balance}</h2>
          <button style={payoutBtn}>Request Payout</button>
        </div>
        <div style={revenueCard('#fff', '#000')}>
          <p style={{ color: '#666', fontWeight: 700 }}>Total Revenue (Life-time)</p>
          <h2 style={{ fontSize: '42px', fontWeight: 900, margin: '10px 0' }}>GHS {sales.total}</h2>
          <div style={{ display: 'flex', alignItems: 'center', color: '#22c55e', fontWeight: 800 }}>
            <TrendingUp size={16} /> +12% this week
          </div>
        </div>
      </div>

      {/* SALES BY TICKET CLASS */}
      <div style={{ background: 'white', padding: '40px', borderRadius: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontWeight: 900, marginBottom: '25px' }}>Sales by Ticket Class</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {tierBreakdown.map((tier, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: '#f8fafc', borderRadius: '20px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800 }}>{tier.name}</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{tier.sold} Tickets sold</p>
              </div>
              <p style={{ margin: 0, fontWeight: 900, fontSize: '18px' }}>GHS {tier.revenue}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const revenueCard = (bg, col) => ({ background: bg, color: col, padding: '40px', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' });
const payoutBtn = { background: '#0ea5e9', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', marginTop: '10px' };
