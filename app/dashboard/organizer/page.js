"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, 
  Check, QrCode, Download, X,
  TrendingUp, Clock, Loader2, Trash2,
  LogOut, RefreshCcw, ChevronRight, 
  Banknote, Award, ShieldCheck, History, Info, Sparkles, Building2,
  Eye, MoreVertical, Search, Filter, MapPin, ExternalLink,
  ChevronDown, ArrowDownRight, CreditCard, HelpCircle, Bell,
  FileText, Share2, PieChart, Activity, Briefcase
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('events');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modal States
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showEventActions, setShowEventActions] = useState(null); 
  
  const [data, setData] = useState({ 
    events: [], 
    contests: [], 
    payouts: [], 
    tickets: [], 
    profile: null 
  });

  const [stats, setStats] = useState({
    netRevenue: 0, 
    grossRevenue: 0,
    totalVotes: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
    withdrawnToDate: 0,
    ticketCount: 0,
    activeEvents: 0,
    conversionRate: 0
  });

  // --- 2. DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      // Force session refresh to catch any immediate onboarding updates
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      const user = session?.user;

      if (sessionError || !user) {
        router.push('/login');
        return;
      }

      // Check for Paystack Subaccount in metadata or profiles table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const subaccountCode = user.user_metadata?.paystack_subaccount_code || profileData?.paystack_subaccount_code;
      
      if (subaccountCode) {
        setIsOnboarded(true);
      } else {
        setIsOnboarded(false);
        setLoading(false);
        return;
      }

      // Fetch all relevant data for the organizer
      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      // FINANCIAL LOGIC: Organizer gets 95% (Ousted service charge is 5%)
      const grossRev = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const netRev = grossRev * 0.95; 
      
      const successfulPayouts = payoutsRes.data
        ?.filter(p => p.status === 'success')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;
      
      const pendingPayouts = payoutsRes.data
        ?.filter(p => p.status === 'pending')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;

      setStats({
        grossRevenue: grossRev,
        netRevenue: netRev,
        totalVotes: contestsRes.data?.reduce((acc, c) => acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0) || 0,
        availableBalance: Math.max(0, netRev - successfulPayouts - pendingPayouts),
        pendingWithdrawals: pendingPayouts,
        withdrawnToDate: successfulPayouts,
        ticketCount: myTickets.length,
        activeEvents: eventsRes.data?.filter(e => e.status === 'active').length || 0,
        conversionRate: myTickets.length > 0 ? ((myTickets.length / 100) * 100).toFixed(1) : 0
      });

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileData }
      });

    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'USER_UPDATED') loadDashboardData(true);
    });
    return () => subscription.unsubscribe();
  }, [loadDashboardData]);

  // --- 3. FILTER & SEARCH LOGIC ---
  const filteredEvents = useMemo(() => {
    return data.events.filter(e => 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data.events, searchQuery]);

  const filteredTickets = useMemo(() => {
    return data.tickets.filter(t => 
      t.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.includes(searchQuery) ||
      t.events?.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data.tickets, searchQuery]);

  // --- 4. ACTION HANDLERS ---
  const handleDeleteEvent = async (id) => {
    const confirmed = window.confirm("Are you sure? This will permanently delete the event and all associated sales data.");
    if (!confirmed) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (!error) loadDashboardData(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDownloadTicketReport = () => {
    const headers = ["Ticket ID", "Event", "Customer Email", "Gross Amount (GHS)", "Organizer Net (95%)", "Status", "Date"];
    const csvData = data.tickets.map(t => [
      t.id, t.events?.title, t.customer_email, t.amount, (t.amount * 0.95).toFixed(2), t.status || 'paid', new Date(t.created_at).toLocaleDateString()
    ]);
    const csvContent = [headers, ...csvData].map(e => `"${e.join('","')}"`).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `ousted_organizer_sales_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 5. MODAL COMPONENTS ---
  const TicketDetailModal = () => {
    if (!selectedTicket) return null;
    return (
      <div style={modalOverlay} onClick={() => setSelectedTicket(null)}>
        <div style={modalContent} onClick={e => e.stopPropagation()}>
          <div style={modalHeader}>
            <div style={modalTitleSection}><Ticket size={20} color="#000"/><h3 style={modalTitle}>Ticket Analysis</h3></div>
            <button style={closeBtn} onClick={() => setSelectedTicket(null)}><X size={20}/></button>
          </div>
          <div style={modalBody}>
            <div style={ticketPreviewCard}>
               <div style={previewTop}><p style={previewEventName}>{selectedTicket.events?.title}</p><span style={statusBadge('active')}>VALIDATED</span></div>
               <div style={previewMid}>
                  <div style={qrContainer}><QrCode size={130} strokeWidth={1.2}/></div>
                  <div style={previewInfo}>
                    <p style={previewLabel}>PURCHASER</p>
                    <p style={previewValue}>{selectedTicket.customer_email}</p>
                    <p style={previewLabel} style={{marginTop: '15px'}}>TRANSACTION REF</p>
                    <p style={previewValue}>#{selectedTicket.id.slice(0,14).toUpperCase()}</p>
                  </div>
               </div>
               <div style={previewBottom}>
                 <div style={previewStat}><span>NET REVENUE</span><p>GHS {(selectedTicket.amount * 0.95).toFixed(2)}</p></div>
                 <div style={previewStat}><span>TIER TYPE</span><p>{selectedTicket.ticket_type || 'Standard Entry'}</p></div>
               </div>
            </div>
            <div style={modalMeta}>
               <div style={metaItem}><Clock size={14}/> <span>Purchased on {new Date(selectedTicket.created_at).toLocaleString()}</span></div>
               <div style={metaItem}><ShieldCheck size={14}/> <span>Secured by Ousted & Paystack</span></div>
            </div>
          </div>
          <div style={modalFooterActions}>
            <button style={modalSecondaryBtn} onClick={() => setSelectedTicket(null)}>CLOSE</button>
            <button style={modalActionBtn} onClick={() => window.print()}>PRINT TICKET</button>
          </div>
        </div>
      </div>
    );
  };

  // --- 6. RENDER LOGIC ---
  if (loading) return (
    <div style={fullPageCenter}>
      <div style={loaderContainer}>
        <div style={luxuryLoaderRing}></div>
        <h2 style={loadingLogo}>OUSTED</h2>
        <p style={loadingText}>INITIALIZING YOUR SECURE ENVIRONMENT</p>
        <div style={loadingProgressLine}><div style={loadingProgressFill}></div></div>
      </div>
    </div>
  );

  if (!isOnboarded) return (
    <div style={mainWrapper}>
      <div style={topNav}>
        <h1 style={logoText}>OUSTED <span style={badgePro}>SETUP</span></h1>
        <button style={logoutCircle} onClick={handleLogout}><LogOut size={20}/></button>
      </div>
      <div style={onboardingContainer}>
        <div style={onboardHero}>
          <div style={heroDecoration}><Sparkles size={40} color="#0ea5e9"/></div>
          <h2 style={onboardTitle}>The Gateway to Excellence</h2>
          <p style={onboardSub}>To activate your luxury event creation tools and automated payment splits, please finalize your merchant profile.</p>
          <button style={primaryOnboardBtn} onClick={() => router.push('/dashboard/organizer/onboarding')}>BEGIN ONBOARDING FORM <ChevronRight size={20}/></button>
        </div>
        <div style={onboardInfoSection}>
          <h3 style={sectionHeading}>Our Financial Infrastructure</h3>
          <div style={howItWorksGrid}>
            <div style={howCard}>
              <div style={howIcon}><Building2 size={24}/></div>
              <h3 style={howTitle}>95% Revenue Direct</h3>
              <p style={howText}>Ousted organizers retain 95% of every transaction. Our system calculates this in real-time.</p>
            </div>
            <div style={howCard}>
              <div style={howIcon}><ShieldCheck size={24}/></div>
              <h3 style={howTitle}>5% Flat Commission</h3>
              <p style={howText}>The 5% fee is inclusive of Paystack processing and our technical infrastructure.</p>
            </div>
            <div style={howCard}>
              <div style={howIcon}><Banknote size={24}/></div>
              <h3 style={howTitle}>Rapid Settlements</h3>
              <p style={howText}>Your revenue is settled directly into your account based on verified frequency.</p>
            </div>
          </div>
          <div style={commissionNotice}>
             <div style={noticeIconBox}><Info size={24} color="#0ea5e9"/></div>
             <div>
               <p style={{margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b'}}>Transparent Split Agreement</p>
               <p style={{margin: 0, fontSize: '13px', color: '#64748b', marginTop: '4px', lineHeight: 1.5}}>Ousted uses a "Net-95" split. If you sell a ticket for GHS 1,000, your bank is credited with GHS 950 automatically.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={mainWrapper}>
      <TicketDetailModal />
      <div style={topNav}>
        <div style={logoSection}><h1 style={logoText}>OUSTED <span style={badgePro}>ORGANIZER</span></h1></div>
        <div style={headerActions}>
           <div style={searchWrapper}><Search size={18} style={searchIcon}/><input type="text" placeholder="Find events, tickets..." style={searchInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
           <div style={userBrief}><p style={userEmail}>{data.profile?.email}</p><p style={userRole}>PRO PARTNER</p></div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}><RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/></button>
           <button style={logoutCircle} onClick={handleLogout}><LogOut size={18}/></button>
        </div>
      </div>

      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}><div style={labelWithIcon}><PieChart size={14} color="#64748b"/><p style={financeLabel}>TOTAL NET PERFORMANCE (95%)</p></div><div style={statusDot}>LIVE REVENUE</div></div>
          <h2 style={balanceValue}>GHS {stats.netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div style={revenueBreakdown}>
             <div style={breakdownItem}><span style={breakdownLabel}>Gross Ticket Revenue</span><span style={breakdownValue}>GHS {stats.grossRevenue.toLocaleString()}</span></div>
             <div style={breakdownItem}><span style={breakdownLabel}>Ousted Service Retention (5%)</span><span style={breakdownValue}>- GHS {(stats.grossRevenue * 0.05).toLocaleString()}</span></div>
          </div>
          <div style={financeActionRow}><button style={withdrawBtn}>SETTLEMENT HISTORY <History size={18}/></button><button style={settingsIconBtn}><Settings size={20}/></button></div>
          <div style={cardDecoration}></div>
        </div>
        <div style={statsOverview}>
          <div style={statBox}><div style={statInfo}><p style={statLabel}>TOTAL TICKETS ISSUED</p><p style={statNumber}>{stats.ticketCount.toLocaleString()}</p></div><div style={statIconBox}><Ticket size={24} color="#000"/></div></div>
          <div style={statBox}><div style={statInfo}><p style={statLabel}>ACTIVE CONTEST VOTES</p><p style={statNumber}>{stats.totalVotes.toLocaleString()}</p></div><div style={statIconBox}><Award size={24} color="#000"/></div></div>
          <div style={balanceMiniBox}><div style={{display: 'flex', alignItems: 'center', gap: '10px'}}><Wallet size={18} color="#0ea5e9"/><span style={miniLabel}>AVAILABLE FOR SETTLEMENT</span></div><span style={miniValue}>GHS {stats.availableBalance.toLocaleString()}</span></div>
        </div>
      </div>

      <div style={tabContainer}>
        <div style={tabBar}>
          <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}><Calendar size={16}/> EVENTS</button>
          <button onClick={() => setActiveTab('contests')} style={tabItem(activeTab === 'contests')}><Trophy size={16}/> CONTESTS</button>
          <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}><BarChart3 size={16}/> SALES LEDGER</button>
          <button onClick={() => setActiveTab('analytics')} style={tabItem(activeTab === 'analytics')}><Activity size={16}/> ANALYTICS</button>
        </div>
        <div style={tabActions}>
          {activeTab === 'sales' && <button style={secondaryBtn} onClick={handleDownloadTicketReport}><Download size={18}/> EXPORT CSV</button>}
          <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}><Plus size={18}/> CREATE NEW EVENT</button>
        </div>
      </div>

      <div style={viewPort}>
        {activeTab === 'events' && (
          <div style={luxuryTableContainer}>
            <table style={luxuryTable}>
              <thead>
                <tr><th style={thStyle}>EVENT DESCRIPTION</th><th style={thStyle}>DATE & VENUE</th><th style={thStyle}>STATUS</th><th style={thStyle}>NET EARNINGS (95%)</th><th style={thStyle}>MANAGEMENT</th></tr>
              </thead>
              <tbody>
                {filteredEvents.map(event => (
                  <tr key={event.id} style={trStyle}>
                    <td style={tdStyle}><div style={eventBrief}><div style={eventImagePlaceholder}>{event.image_url ? <img src={event.image_url} style={imgThumb}/> : <MapPin size={22}/>}</div><div style={eventInfo}><p style={eventTitleText}>{event.title}</p><p style={eventCategory}>{event.category || 'Luxury Experience'}</p></div></div></td>
                    <td style={tdStyle}><div style={dateBox}><p style={dateText}>{new Date(event.date).toLocaleDateString()}</p><p style={venueText}>{event.location}</p></div></td>
                    <td style={tdStyle}><span style={statusBadge(event.status || 'active')}>{event.status?.toUpperCase() || 'ACTIVE'}</span></td>
                    <td style={tdStyle}><div style={earningsWrapper}><p style={tablePrice}>GHS {(data.tickets.filter(t => t.event_id === event.id).reduce((s, t) => s + (t.amount || 0), 0) * 0.95).toLocaleString()}</p></div></td>
                    <td style={tdStyle}><div style={actionGroup}><button style={iconAction} onClick={() => router.push(`/dashboard/organizer/events/${event.id}`)}><Eye size={16}/></button><button style={deleteAction} onClick={() => handleDeleteEvent(event.id)}><Trash2 size={16}/></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'contests' && (
          <div style={contestGrid}>
            {data.contests.map(contest => (
              <div key={contest.id} style={contestCard}>
                <div style={contestHeader}><div><h3 style={contestTitle}>{contest.title}</h3><p style={contestSub}>{contest.candidates?.length || 0} Candidates</p></div><Award size={24} color="#0ea5e9"/></div>
                <div style={contestProgressSection}><div style={progressLabelRow}><span>VOTER ENGAGEMENT</span><span>{contest.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0)} VOTES</span></div><div style={progressBarBg}><div style={progressBarFill(30)}></div></div></div>
                <div style={contestBody}><div style={contestStat}><span>NET VOTE REVENUE</span><span style={cStatVal}>GHS {(contest.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0) * 0.95).toFixed(2)}</span></div></div>
                <button style={manageContestBtn} onClick={() => router.push(`/dashboard/organizer/contests/${contest.id}`)}>VIEW RANKINGS <ChevronRight size={16}/></button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'sales' && (
          <div style={luxuryTableContainer}>
            <table style={luxuryTable}>
              <thead><tr><th style={thStyle}>TICKET ID</th><th style={thStyle}>EVENT</th><th style={thStyle}>BUYER</th><th style={thStyle}>NET CREDIT (95%)</th><th style={thStyle}>ACTION</th></tr></thead>
              <tbody>
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} style={trStyle}>
                    <td style={tdStyle}><span style={ticketCode}>#{ticket.id.slice(0,10).toUpperCase()}</span></td>
                    <td style={tdStyle}><span style={eventRefText}>{ticket.events?.title}</span></td>
                    <td style={tdStyle}>{ticket.customer_email}</td>
                    <td style={tdStyle}><p style={netSaleText}>GHS {(ticket.amount * 0.95).toFixed(2)}</p></td>
                    <td style={tdStyle}><button style={iconAction} onClick={() => setSelectedTicket(ticket)}><QrCode size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={footerBranding}><p style={footerCopy}>© 2025 OUSTED PREMIUM. ALL RIGHTS RESERVED.</p><p style={footerSystemStatus}><div style={onlineDot}></div> ALL SYSTEMS OPERATIONAL</p></div>
    </div>
  );
}

// --- 7. COMPLETE STYLES ---
const mainWrapper = { padding: '50px 30px', maxWidth: '1400px', margin: '0 auto', fontFamily: '"Inter", sans-serif', backgroundColor: '#fcfcfc', minHeight: '100vh' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' };
const logoSection = { display: 'flex', alignItems: 'center' };
const logoText = { fontSize: '28px', fontWeight: 950, letterSpacing: '-2px', margin: 0 };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '6px 14px', borderRadius: '10px', marginLeft: '15px' };
const headerActions = { display: 'flex', alignItems: 'center', gap: '20px' };
const searchWrapper = { position: 'relative', minWidth: '320px' };
const searchIcon = { position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };
const searchInput = { width: '100%', padding: '14px 18px 14px 50px', borderRadius: '18px', border: '1px solid #f1f5f9', background: '#fff' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 800 };
const userRole = { margin: 0, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' };
const circleAction = { width: '52px', height: '52px', borderRadius: '18px', border: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const logoutCircle = { width: '52px', height: '52px', borderRadius: '18px', border: 'none', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const financeGrid = { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '40px', marginBottom: '80px' };
const balanceCard = { background: '#000', borderRadius: '50px', padding: '55px', color: '#fff', position: 'relative', overflow: 'hidden' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const labelWithIcon = { display: 'flex', alignItems: 'center', gap: '10px' };
const financeLabel = { fontSize: '13px', fontWeight: 800, color: '#737373', letterSpacing: '3px', margin: 0 };
const statusDot = { background: '#22c55e', color: '#fff', fontSize: '10px', padding: '6px 16px', borderRadius: '25px', fontWeight: 950 };
const balanceValue = { fontSize: '72px', fontWeight: 950, margin: '30px 0', letterSpacing: '-4px' };
const revenueBreakdown = { borderTop: '1px solid #262626', paddingTop: '30px', marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px' };
const breakdownItem = { display: 'flex', justifyContent: 'space-between' };
const breakdownLabel = { color: '#8c8c8c' };
const breakdownValue = { fontWeight: 700 };
const financeActionRow = { display: 'flex', gap: '20px', marginTop: '55px' };
const withdrawBtn = { flex: 1, background: '#fff', color: '#000', border: 'none', padding: '22px', borderRadius: '25px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' };
const settingsIconBtn = { width: '65px', height: '65px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '25px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const cardDecoration = { position: 'absolute', top: '-120px', right: '-120px', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 75%)', borderRadius: '50%' };
const statsOverview = { display: 'flex', flexDirection: 'column', gap: '25px' };
const statBox = { background: '#fff', padding: '40px', borderRadius: '40px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const statInfo = { display: 'flex', flexDirection: 'column' };
const statLabel = { fontSize: '13px', fontWeight: 800, color: '#94a3b8', margin: 0 };
const statNumber = { fontSize: '36px', fontWeight: 950, margin: '10px 0 0' };
const statIconBox = { width: '60px', height: '60px', background: '#f8fafc', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const balanceMiniBox = { background: '#f0f9ff', padding: '25px 40px', borderRadius: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e0f2fe' };
const miniLabel = { fontSize: '13px', fontWeight: 900, color: '#0ea5e9' };
const miniValue = { fontSize: '22px', fontWeight: 950, color: '#0ea5e9' };
const tabContainer = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '45px', borderBottom: '1px solid #f1f5f9' };
const tabBar = { display: 'flex', gap: '50px' };
const tabItem = (active) => ({ padding: '28px 0', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '15px', fontWeight: 800, cursor: 'pointer', borderBottom: active ? '4px solid #000' : '4px solid transparent' });
const tabActions = { display: 'flex', gap: '18px' };
const secondaryBtn = { background: '#fff', border: '1px solid #e2e8f0', padding: '14px 26px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' };
const addBtn = { background: '#000', color: '#fff', padding: '16px 32px', borderRadius: '20px', border: 'none', fontWeight: 950, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' };
const luxuryTableContainer = { background: '#fff', borderRadius: '40px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse' };
const thStyle = { padding: '25px 35px', background: '#fafafa', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textAlign: 'left', letterSpacing: '1px' };
const trStyle = { borderBottom: '1px solid #f8fafc' };
const tdStyle = { padding: '35px' };
const eventBrief = { display: 'flex', alignItems: 'center', gap: '25px' };
const eventImagePlaceholder = { width: '70px', height: '70px', background: '#f1f5f9', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const imgThumb = { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' };
const eventInfo = { display: 'flex', flexDirection: 'column', gap: '6px' };
const eventTitleText = { margin: 0, fontWeight: 900, fontSize: '18px' };
const eventCategory = { margin: 0, fontSize: '13px', color: '#94a3b8' };
const dateBox = { display: 'flex', flexDirection: 'column', gap: '6px' };
const dateText = { margin: 0, fontWeight: 800 };
const venueText = { margin: 0, fontSize: '13px', color: '#94a3b8' };
const tablePrice = { fontWeight: 950, fontSize: '20px', margin: 0 };
const statusBadge = (s) => ({ background: s === 'active' ? '#f0fdf4' : '#fef2f2', color: s === 'active' ? '#16a34a' : '#ef4444', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 900 });
const actionGroup = { display: 'flex', gap: '12px' };
const iconAction = { width: '45px', height: '45px', borderRadius: '15px', border: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const deleteAction = { width: '45px', height: '45px', borderRadius: '15px', border: 'none', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '35px' };
const contestCard = { background: '#fff', borderRadius: '45px', border: '1px solid #f1f5f9', padding: '45px' };
const contestHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '35px' };
const contestTitle = { margin: 0, fontSize: '24px', fontWeight: 950 };
const contestSub = { margin: 0, color: '#94a3b8', fontSize: '13px', fontWeight: 700 };
const contestProgressSection = { marginBottom: '40px' };
const progressLabelRow = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 950, color: '#0ea5e9', marginBottom: '15px' };
const progressBarBg = { height: '10px', background: '#f1f5f9', borderRadius: '15px' };
const progressBarFill = (w) => ({ height: '100%', width: `${w}%`, background: '#0ea5e9', borderRadius: '15px' });
const contestBody = { padding: '30px', background: '#fafafa', borderRadius: '30px', marginBottom: '35px' };
const contestStat = { display: 'flex', flexDirection: 'column' };
const cStatVal = { fontSize: '24px', fontWeight: 950, marginTop: '5px' };
const manageContestBtn = { width: '100%', background: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '22px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' };
const ticketCode = { fontFamily: 'monospace', background: '#f1f5f9', padding: '8px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 };
const eventRefText = { fontWeight: 800 };
const netSaleText = { fontWeight: 950, color: '#16a34a', margin: 0, fontSize: '18px' };
const footerBranding = { marginTop: '120px', borderTop: '1px solid #f1f5f9', paddingTop: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '60px' };
const footerCopy = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', margin: 0 };
const footerSystemStatus = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', fontWeight: 900, color: '#22c55e', margin: 0 };
const onlineDot = { width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' };
const fullPageCenter = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const loaderContainer = { textAlign: 'center', width: '100%', maxWidth: '300px' };
const luxuryLoaderRing = { width: '70px', height: '70px', border: '4px solid #f3f3f3', borderTop: '4px solid #000', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 35px' };
const loadingLogo = { fontSize: '32px', fontWeight: 950, letterSpacing: '8px', margin: '0 0 15px' };
const loadingText = { fontSize: '13px', fontWeight: 800, color: '#94a3b8', letterSpacing: '3px' };
const loadingProgressLine = { width: '100%', height: '3px', background: '#f1f5f9', borderRadius: '10px', marginTop: '20px', overflow: 'hidden' };
const loadingProgressFill = { width: '40%', height: '100%', background: '#000' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { background: '#fff', width: '95%', maxWidth: '500px', borderRadius: '45px', padding: '45px' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '35px' };
const modalTitleSection = { display: 'flex', alignItems: 'center', gap: '15px' };
const modalTitle = { fontSize: '24px', fontWeight: 950, margin: 0 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer' };
const ticketPreviewCard = { background: '#000', borderRadius: '35px', padding: '35px', color: '#fff' };
const previewTop = { display: 'flex', justifyContent: 'space-between', marginBottom: '35px' };
const previewEventName = { fontWeight: 900, fontSize: '20px', margin: 0 };
const previewMid = { display: 'flex', gap: '25px', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '35px', marginBottom: '35px' };
const qrContainer = { background: '#fff', padding: '15px', borderRadius: '25px' };
const previewInfo = { display: 'flex', flexDirection: 'column' };
const previewLabel = { fontSize: '11px', color: '#737373', fontWeight: 900, margin: 0 };
const previewValue = { fontSize: '14px', fontWeight: 700, margin: '4px 0 0' };
const previewBottom = { display: 'flex', justifyContent: 'space-between' };
const previewStat = { display: 'flex', flexDirection: 'column' };
const modalMeta = { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '30px' };
const metaItem = { display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8', fontSize: '13px' };
const modalFooterActions = { display: 'flex', gap: '15px', marginTop: '35px' };
const modalSecondaryBtn = { flex: 1, padding: '20px', background: '#f8fafc', border: 'none', borderRadius: '22px', fontWeight: 800, cursor: 'pointer' };
const modalActionBtn = { flex: 2, padding: '20px', background: '#000', color: '#fff', border: 'none', borderRadius: '22px', fontWeight: 950, cursor: 'pointer' };
const onboardingContainer = { maxWidth: '1000px', margin: '0 auto' };
const onboardHero = { background: '#fff', border: '1px solid #f1f5f9', borderRadius: '60px', padding: '120px 60px', textAlign: 'center', marginBottom: '70px' };
const heroDecoration = { marginBottom: '40px' };
const onboardTitle = { fontSize: '56px', fontWeight: 950, margin: '0 0 30px' };
const onboardSub = { color: '#64748b', fontSize: '20px', maxWidth: '650px', margin: '0 auto 60px', lineHeight: 1.8 };
const primaryOnboardBtn = { background: '#000', color: '#fff', border: 'none', padding: '28px 65px', borderRadius: '28px', fontWeight: 950, fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', margin: '0 auto' };
const onboardInfoSection = { padding: '0 30px' };
const sectionHeading = { fontSize: '14px', fontWeight: 900, letterSpacing: '3px', color: '#94a3b8', textAlign: 'center', marginBottom: '50px' };
const howItWorksGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', marginBottom: '70px' };
const howCard = { background: '#fff', padding: '45px', borderRadius: '45px', border: '1px solid #f1f5f9' };
const howIcon = { width: '70px', height: '70px', background: '#f8fafc', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '35px', color: '#0ea5e9' };
const howTitle = { fontSize: '22px', fontWeight: 900, margin: '0 0 18px' };
const howText = { fontSize: '16px', color: '#64748b', lineHeight: 1.8 };
const commissionNotice = { background: '#fff', padding: '35px 50px', borderRadius: '40px', display: 'flex', alignItems: 'center', gap: '30px', border: '1px solid #e0f2fe' };
const noticeIconBox = { minWidth: '60px', height: '60px', background: '#f0f9ff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
