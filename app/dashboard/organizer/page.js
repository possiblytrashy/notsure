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
  ChevronDown, ArrowDownRight, CreditCard, HelpCircle, Bell
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
    activeEvents: 0
  });

  // --- 2. DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Check for Paystack Subaccount in metadata
      const hasSubaccount = !!user.user_metadata?.paystack_subaccount_code;
      setIsOnboarded(hasSubaccount);

      // Fetch all relevant data for the organizer
      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      // Filter tickets belonging to this organizer's events
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
        activeEvents: eventsRes.data?.filter(e => e.status === 'active').length || 0
      });

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: user
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
  }, [loadDashboardData]);

  // --- 3. FILTER LOGIC ---
  const filteredEvents = useMemo(() => {
    return data.events.filter(e => 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data.events, searchQuery]);

  const filteredTickets = useMemo(() => {
    return data.tickets.filter(t => 
      t.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.includes(searchQuery)
    );
  }, [data.tickets, searchQuery]);

  // --- 4. ACTIONS ---
  const handleDeleteEvent = async (id) => {
    const confirmed = window.confirm("Are you sure? This will remove the event and all associated data. This action cannot be undone.");
    if (!confirmed) return;
    
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) {
      alert("Error deleting event: " + error.message);
    } else {
      loadDashboardData(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDownloadTicketReport = () => {
    const headers = ["Ticket ID", "Event", "Customer", "Amount (Gross)", "Net Revenue (95%)", "Date"];
    const csvData = data.tickets.map(t => [
      t.id,
      t.events?.title,
      t.customer_email,
      t.amount,
      (t.amount * 0.95).toFixed(2),
      new Date(t.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ousted_sales_report_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 5. SUB-COMPONENTS (MODALS) ---
  const TicketDetailModal = () => {
    if (!selectedTicket) return null;
    return (
      <div style={modalOverlay} onClick={() => setSelectedTicket(null)}>
        <div style={modalContent} onClick={e => e.stopPropagation()}>
          <div style={modalHeader}>
            <h3 style={modalTitle}>Ticket Specification</h3>
            <button style={closeBtn} onClick={() => setSelectedTicket(null)}><X size={20}/></button>
          </div>
          <div style={modalBody}>
            <div style={ticketPreviewCard}>
               <div style={previewTop}>
                 <p style={previewEventName}>{selectedTicket.events?.title}</p>
                 <span style={previewStatus}>VERIFIED</span>
               </div>
               <div style={previewMid}>
                  <QrCode size={120} strokeWidth={1.5}/>
                  <div style={previewInfo}>
                    <p style={previewLabel}>HOLDER</p>
                    <p style={previewValue}>{selectedTicket.customer_email}</p>
                    <p style={previewLabel} style={{marginTop: '10px'}}>TICKET ID</p>
                    <p style={previewValue}>#{selectedTicket.id.slice(0,12)}</p>
                  </div>
               </div>
               <div style={previewBottom}>
                 <div style={previewStat}>
                    <span>NET PRICE</span>
                    <p>GHS {(selectedTicket.amount * 0.95).toFixed(2)}</p>
                 </div>
                 <div style={previewStat}>
                    <span>TIER</span>
                    <p>{selectedTicket.ticket_type || 'Standard'}</p>
                 </div>
               </div>
            </div>
          </div>
          <button style={modalActionBtn} onClick={() => window.print()}>PRINT RECEIPT</button>
        </div>
      </div>
    );
  };

  // --- 6. LOADING & ONBOARDING VIEWS ---
  if (loading) return (
    <div style={fullPageCenter}>
      <div style={loaderContainer}>
        <div style={luxuryLoaderRing}></div>
        <h2 style={loadingLogo}>OUSTED</h2>
        <p style={loadingText}>PREPARING YOUR LUXURY ASSETS</p>
      </div>
    </div>
  );

  if (!isOnboarded) {
    return (
      <div style={mainWrapper}>
        <div style={topNav}>
          <h1 style={logoText}>OUSTED <span style={badgePro}>SETUP</span></h1>
          <button style={logoutCircle} onClick={handleLogout}><LogOut size={20}/></button>
        </div>

        <div style={onboardingContainer}>
          <div style={onboardHero}>
            <div style={heroDecoration}><Sparkles size={40} color="#0ea5e9"/></div>
            <h2 style={onboardTitle}>The Gateway to Excellence</h2>
            <p style={onboardSub}>Complete your business onboarding to unlock premium event creation, automated payouts, and real-time sales analytics.</p>
            
            <button style={primaryOnboardBtn} onClick={() => router.push('/dashboard/organizer/onboarding')}>
              BEGIN ONBOARDING FORM <ChevronRight size={20}/>
            </button>
          </div>

          <div style={onboardInfoSection}>
            <h3 style={sectionHeading}>How Service Fees & Payouts Work</h3>
            <div style={howItWorksGrid}>
              <div style={howCard}>
                <div style={howIcon}><Building2 size={24}/></div>
                <h3 style={howTitle}>95% Revenue Share</h3>
                <p style={howText}>Ousted organizers receive 95% of every ticket sold. We calculate this instantly upon every successful transaction.</p>
              </div>
              <div style={howCard}>
                <div style={howIcon}><ShieldCheck size={24}/></div>
                <h3 style={howTitle}>5% Flat Commission</h3>
                <p style={howText}>The 5% fee covers all Paystack processing costs, secure QR code generation, email delivery, and platform hosting.</p>
              </div>
              <div style={howCard}>
                <div style={howIcon}><Banknote size={24}/></div>
                <h3 style={howTitle}>Automatic Settlement</h3>
                <p style={howText}>Funds are settled directly into your connected bank or Mobile Money account according to the Paystack cycle.</p>
              </div>
            </div>

            <div style={commissionNotice}>
               <Info size={24} color="#0ea5e9"/>
               <div style={{display: 'flex', flexDirection: 'column'}}>
                 <p style={{margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b'}}>Ousted Partner Transparency</p>
                 <p style={{margin: 0, fontSize: '13px', color: '#64748b', marginTop: '4px'}}>
                   Example: For a high-end ticket priced at <b>GHS 500.00</b>, you receive <b>GHS 475.00</b>. There are zero hidden management or withdrawal fees.
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 7. MAIN DASHBOARD RENDER ---
  return (
    <div style={mainWrapper}>
      <TicketDetailModal />
      
      {/* Header */}
      <div style={topNav}>
        <div style={logoSection}>
          <h1 style={logoText}>OUSTED <span style={badgePro}>ORGANIZER</span></h1>
        </div>
        
        <div style={headerActions}>
           <div style={searchWrapper}>
              <Search size={18} style={searchIcon}/>
              <input 
                type="text" 
                placeholder="Search events or tickets..." 
                style={searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <p style={userRole}>Verified Merchant</p>
           </div>

           <button style={circleAction} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           
           <button style={logoutCircle} onClick={handleLogout}>
             <LogOut size={18}/>
           </button>
        </div>
      </div>

      {/* Finance Grid */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <p style={financeLabel}>TOTAL NET REVENUE (YOUR 95%)</p>
            <div style={statusDot}>LIVE DATA</div>
          </div>
          <h2 style={balanceValue}>GHS {stats.netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          
          <div style={revenueBreakdown}>
             <div style={breakdownItem}>
                <span style={breakdownLabel}>Gross Ticket Sales</span>
                <span style={breakdownValue}>GHS {stats.grossRevenue.toLocaleString()}</span>
             </div>
             <div style={breakdownItem}>
                <span style={breakdownLabel}>Ousted Service Fee (5%)</span>
                <span style={breakdownValue}>- GHS {(stats.grossRevenue * 0.05).toLocaleString()}</span>
             </div>
          </div>

          <div style={financeActionRow}>
            <button style={withdrawBtn}>SETTLEMENT HISTORY <History size={18}/></button>
            <button style={settingsIconBtn}><Settings size={20}/></button>
          </div>
          
          <div style={cardDecoration}></div>
        </div>

        <div style={statsOverview}>
          <div style={statBox}>
            <div style={statInfo}>
              <p style={statLabel}>TOTAL TICKETS ISSUED</p>
              <p style={statNumber}>{stats.ticketCount.toLocaleString()}</p>
            </div>
            <div style={statIconBox}><Ticket size={24} color="#000"/></div>
          </div>
          
          <div style={statBox}>
            <div style={statInfo}>
              <p style={statLabel}>CONTEST VOTE REVENUE</p>
              <p style={statNumber}>{stats.totalVotes.toLocaleString()}</p>
            </div>
            <div style={statIconBox}><Award size={24} color="#000"/></div>
          </div>

          <div style={balanceMiniBox}>
             <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
               <Wallet size={18} color="#0ea5e9"/>
               <span style={miniLabel}>AVAILABLE FOR SETTLEMENT</span>
             </div>
             <span style={miniValue}>GHS {stats.availableBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Navigation & Controls */}
      <div style={tabContainer}>
        <div style={tabBar}>
          <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}>
            <Calendar size={16}/> EVENTS
          </button>
          <button onClick={() => setActiveTab('contests')} style={tabItem(activeTab === 'contests')}>
            <Trophy size={16}/> CONTESTS
          </button>
          <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}>
            <BarChart3 size={16}/> SALES LEDGER
          </button>
        </div>
        
        <div style={tabActions}>
          {activeTab === 'sales' && (
            <button style={secondaryBtn} onClick={handleDownloadTicketReport}>
              <Download size={18}/> EXPORT CSV
            </button>
          )}
          <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
            <Plus size={18}/> CREATE NEW EVENT
          </button>
        </div>
      </div>

      {/* Content Viewport */}
      <div style={viewPort}>
        {activeTab === 'events' && (
          <div style={gridContent}>
            {filteredEvents.length === 0 ? (
              <div style={emptyState}>
                <div style={emptyIllustration}><Calendar size={60} color="#f1f5f9"/></div>
                <h3 style={emptyTitle}>No matching events found</h3>
                <p style={emptySub}>Curate your first premium event to start generating revenue.</p>
                <button style={emptyBtn} onClick={() => router.push('/dashboard/organizer/create')}>Build Your First Event</button>
              </div>
            ) : (
              <div style={luxuryTableContainer}>
                <table style={luxuryTable}>
                  <thead>
                    <tr>
                      <th style={thStyle}>EVENT DESCRIPTION</th>
                      <th style={thStyle}>DATE & VENUE</th>
                      <th style={thStyle}>STATUS</th>
                      <th style={thStyle}>NET EARNINGS (95%)</th>
                      <th style={thStyle}>MANAGEMENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={event.id} style={trStyle}>
                        <td style={tdStyle}>
                          <div style={eventBrief}>
                            <div style={eventImagePlaceholder}>
                               {event.image_url ? <img src={event.image_url} style={imgThumb} alt={event.title}/> : <MapPin size={20} color="#94a3b8"/>}
                            </div>
                            <div style={eventInfo}>
                              <p style={eventTitleText}>{event.title}</p>
                              <p style={eventCategory}>{event.category || 'Luxury Experience'}</p>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={dateBox}>
                            <p style={dateText}>{new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p style={venueText}>{event.location}</p>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={statusBadge(event.status)}>{event.status?.toUpperCase() || 'ACTIVE'}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={earningsWrapper}>
                             <p style={tablePrice}>GHS {(data.tickets.filter(t => t.event_id === event.id).reduce((s, t) => s + (t.amount || 0), 0) * 0.95).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                             <p style={earningsGross}>Gross: GHS {data.tickets.filter(t => t.event_id === event.id).reduce((s, t) => s + (t.amount || 0), 0).toLocaleString()}</p>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={actionGroup}>
                            <button title="View Dashboard" style={iconAction} onClick={() => router.push(`/dashboard/organizer/events/${event.id}`)}><Eye size={16}/></button>
                            <button title="Edit Details" style={iconAction} onClick={() => router.push(`/dashboard/organizer/events/edit/${event.id}`)}><Settings size={16}/></button>
                            <button title="Delete Event" style={deleteAction} onClick={() => handleDeleteEvent(event.id)}><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contests' && (
          <div style={gridContent}>
            {data.contests.length === 0 ? (
               <div style={emptyState}>
                 <Trophy size={60} color="#f1f5f9"/>
                 <h3 style={emptyTitle}>No active contests</h3>
                 <p style={emptySub}>Engagement contests drive high-volume revenue splits.</p>
               </div>
            ) : (
              <div style={contestGrid}>
                {data.contests.map((contest) => (
                  <div key={contest.id} style={contestCard}>
                    <div style={contestHeader}>
                      <div style={contestTitleGroup}>
                        <h3 style={contestTitle}>{contest.title}</h3>
                        <p style={contestSub}>{contest.candidates?.length || 0} Professional Candidates</p>
                      </div>
                      <div style={contestIconBox}><Award size={22} color="#0ea5e9"/></div>
                    </div>
                    
                    <div style={contestProgressSection}>
                       <div style={progressLabelRow}>
                          <span>VOTING ENGAGEMENT</span>
                          <span>{contest.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0).toLocaleString()} VOTES</span>
                       </div>
                       <div style={progressBarBg}><div style={progressBarFill(75)}></div></div>
                    </div>

                    <div style={contestBody}>
                      <div style={contestStat}>
                         <span style={cStatLabel}>NET EARNINGS</span>
                         <span style={cStatVal}>GHS {(contest.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0) * 0.95).toFixed(2)}</span>
                      </div>
                      <div style={contestStat}>
                         <span style={cStatLabel}>TOP CANDIDATE</span>
                         <span style={cStatVal}>{contest.candidates?.sort((a,b) => b.vote_count - a.vote_count)[0]?.name || 'N/A'}</span>
                      </div>
                    </div>
                    
                    <button style={manageContestBtn} onClick={() => router.push(`/dashboard/organizer/contests/${contest.id}`)}>
                      OPEN CONTEST CONTROL <ChevronRight size={16}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sales' && (
          <div style={gridContent}>
            <div style={luxuryTableContainer}>
                <table style={luxuryTable}>
                  <thead>
                    <tr>
                      <th style={thStyle}>TICKET ID</th>
                      <th style={thStyle}>EVENT REFERENCE</th>
                      <th style={thStyle}>BUYER CREDENTIALS</th>
                      <th style={thStyle}>TIER</th>
                      <th style={thStyle}>NET CREDIT (95%)</th>
                      <th style={thStyle}>TIMESTAMP</th>
                      <th style={thStyle}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.length === 0 ? (
                      <tr><td colSpan="7" style={{padding: '80px', textAlign: 'center', color: '#94a3b8'}}>No transaction records found matching your query.</td></tr>
                    ) : (
                      filteredTickets.map((ticket) => (
                        <tr key={ticket.id} style={trStyle}>
                          <td style={tdStyle}><span style={ticketCode}>#{ticket.id.slice(0,10).toUpperCase()}</span></td>
                          <td style={tdStyle}><span style={eventRefText}>{ticket.events?.title}</span></td>
                          <td style={tdStyle}>{ticket.customer_email || 'Guest Participant'}</td>
                          <td style={tdStyle}><span style={typeBadge}>{ticket.ticket_type || 'GENERAL'}</span></td>
                          <td style={tdStyle}><p style={netSaleText}>GHS {(ticket.amount * 0.95).toFixed(2)}</p></td>
                          <td style={tdStyle}>{new Date(ticket.created_at).toLocaleDateString()}</td>
                          <td style={tdStyle}>
                             <button style={iconAction} onClick={() => setSelectedTicket(ticket)}><QrCode size={16}/></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div style={footerBranding}>
        <p>© 2025 OUSTED PREMIUM TICKETING. ALL RIGHTS RESERVED.</p>
        <div style={footerLinks}>
           <a href="#">Support</a>
           <a href="#">Merchant Terms</a>
           <a href="#">API Docs</a>
        </div>
      </div>
    </div>
  );
}

// --- 8. EXHAUSTIVE LUXURY STYLING ---

const mainWrapper = { 
  padding: '40px 20px', 
  maxWidth: '1300px', 
  margin: '0 auto', 
  fontFamily: '"Inter", -apple-system, sans-serif',
  color: '#000',
  minHeight: '100vh',
  backgroundColor: '#fcfcfc'
};

const topNav = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  marginBottom: '50px',
  flexWrap: 'wrap',
  gap: '20px'
};

const logoSection = { display: 'flex', alignItems: 'center' };
const logoText = { fontSize: '26px', fontWeight: 950, letterSpacing: '-1.8px', display: 'flex', alignItems: 'center' };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '5px 12px', borderRadius: '8px', marginLeft: '12px', letterSpacing: '1.2px', fontWeight: 900 };

const headerActions = { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' };
const searchWrapper = { position: 'relative', minWidth: '280px' };
const searchIcon = { position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };
const searchInput = { width: '100%', padding: '12px 15px 12px 45px', borderRadius: '15px', border: '1px solid #f1f5f9', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease' };

const userBrief = { textAlign: 'right', marginRight: '5px' };
const userEmail = { margin: 0, fontSize: '13px', fontWeight: 800 };
const userRole = { margin: 0, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 };

const circleAction = { width: '48px', height: '48px', borderRadius: '16px', border: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s' };
const logoutCircle = { width: '48px', height: '48px', borderRadius: '16px', border: 'none', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

// FINANCE CARDS
const financeGrid = { display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '30px', marginBottom: '60px' };
const balanceCard = { background: '#000', borderRadius: '45px', padding: '50px', color: '#fff', boxShadow: '0 35px 70px -15px rgba(0, 0, 0, 0.3)', position: 'relative', overflow: 'hidden' };
const cardDecoration = { position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)', borderRadius: '50%' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const financeLabel = { fontSize: '13px', fontWeight: 800, color: '#525252', letterSpacing: '2.5px' };
const statusDot = { background: '#22c55e', color: '#fff', fontSize: '10px', padding: '5px 14px', borderRadius: '20px', fontWeight: 950 };
const balanceValue = { fontSize: '64px', fontWeight: 950, margin: '25px 0', letterSpacing: '-3px' };
const revenueBreakdown = { borderTop: '1px solid #262626', paddingTop: '25px', marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '12px' };
const breakdownItem = { display: 'flex', justifyContent: 'space-between', fontSize: '14px' };
const breakdownLabel = { color: '#737373', fontWeight: 500 };
const breakdownValue = { fontWeight: 700, color: '#e5e5e5' };
const financeActionRow = { display: 'flex', gap: '15px', marginTop: '45px' };
const withdrawBtn = { flex: 1, background: '#fff', color: '#000', border: 'none', padding: '20px', borderRadius: '22px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '15px', transition: 'transform 0.2s' };
const settingsIconBtn = { width: '60px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '22px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const statsOverview = { display: 'flex', flexDirection: 'column', gap: '20px' };
const statBox = { background: '#fff', padding: '35px', borderRadius: '35px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.03)' };
const statIconBox = { width: '55px', height: '55px', background: '#f8fafc', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statInfo = { display: 'flex', flexDirection: 'column' };
const statLabel = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.2px', margin: 0 };
const statNumber = { fontSize: '32px', fontWeight: 950, margin: '8px 0 0', letterSpacing: '-1px' };
const balanceMiniBox = { background: '#f0f9ff', padding: '22px 35px', borderRadius: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e0f2fe' };
const miniLabel = { fontSize: '12px', fontWeight: 900, color: '#0ea5e9', letterSpacing: '0.5px' };
const miniValue = { fontSize: '20px', fontWeight: 950, color: '#0ea5e9' };

// TABS
const tabContainer = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '20px' };
const tabBar = { display: 'flex', gap: '45px' };
const tabItem = (active) => ({ padding: '25px 0', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: active ? '4px solid #000' : '4px solid transparent', transition: 'all 0.3s ease' });
const tabActions = { display: 'flex', gap: '15px' };
const secondaryBtn = { background: '#fff', color: '#000', border: '1px solid #e2e8f0', padding: '12px 24px', borderRadius: '16px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };
const addBtn = { background: '#000', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '18px', fontWeight: 900, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };

// TABLE & LISTS
const luxuryTableContainer = { background: '#fff', borderRadius: '35px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '22px 30px', background: '#fafafa', fontSize: '12px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1.2px', textTransform: 'uppercase' };
const trStyle = { borderBottom: '1px solid #f8fafc', transition: 'background 0.2s' };
const tdStyle = { padding: '30px' };

const eventBrief = { display: 'flex', alignItems: 'center', gap: '20px' };
const eventImagePlaceholder = { width: '60px', height: '60px', background: '#f1f5f9', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
const imgThumb = { width: '100%', height: '100%', objectFit: 'cover' };
const eventInfo = { display: 'flex', flexDirection: 'column', gap: '4px' };
const eventTitleText = { margin: 0, fontWeight: 900, fontSize: '16px', color: '#1a1a1a' };
const eventCategory = { margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: 600 };
const dateBox = { display: 'flex', flexDirection: 'column', gap: '4px' };
const dateText = { margin: 0, fontWeight: 800, fontSize: '14px' };
const venueText = { margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: 500 };
const earningsWrapper = { display: 'flex', flexDirection: 'column', gap: '2px' };
const tablePrice = { fontWeight: 950, fontSize: '18px', margin: 0 };
const earningsGross = { margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 600 };
const actionGroup = { display: 'flex', gap: '10px' };
const iconAction = { width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' };
const deleteAction = { ...iconAction, color: '#e11d48', borderColor: '#fee2e2', background: '#fff1f2' };
const statusBadge = (s) => ({ padding: '7px 15px', borderRadius: '10px', fontSize: '11px', fontWeight: 900, background: s === 'active' ? '#f0fdf4' : '#fff7ed', color: s === 'active' ? '#16a34a' : '#ea580c' });

// ONBOARDING
const onboardingContainer = { maxWidth: '900px', margin: '0 auto', animation: 'fadeIn 0.7s ease-out' };
const onboardHero = { background: '#fff', border: '1px solid #f1f5f9', borderRadius: '55px', padding: '100px 50px', textAlign: 'center', marginBottom: '60px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.05)' };
const heroDecoration = { marginBottom: '35px', display: 'inline-block', padding: '25px', background: '#f0f9ff', borderRadius: '30px' };
const onboardTitle = { fontSize: '48px', fontWeight: 950, margin: '0 0 25px', letterSpacing: '-2.5px' };
const onboardSub = { color: '#64748b', fontSize: '19px', maxWidth: '600px', margin: '0 auto 50px', lineHeight: 1.7 };
const primaryOnboardBtn = { background: '#000', color: '#fff', border: 'none', padding: '26px 55px', borderRadius: '25px', fontWeight: 950, fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '18px', margin: '0 auto', boxShadow: '0 15px 30px rgba(0,0,0,0.15)' };

const onboardInfoSection = { padding: '0 20px' };
const sectionHeading = { fontSize: '13px', fontWeight: 900, letterSpacing: '2.5px', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center', marginBottom: '40px' };
const howItWorksGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px', marginBottom: '60px' };
const howCard = { background: '#fff', padding: '40px', borderRadius: '40px', border: '1px solid #f1f5f9' };
const howIcon = { width: '60px', height: '60px', background: '#f8fafc', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px', color: '#0ea5e9' };
const howTitle = { fontSize: '20px', fontWeight: 900, margin: '0 0 15px' };
const howText = { fontSize: '15px', color: '#64748b', lineHeight: 1.7, margin: 0 };
const commissionNotice = { background: '#fff', padding: '30px 45px', borderRadius: '35px', display: 'flex', alignItems: 'center', gap: '25px', border: '1px solid #e0f2fe' };

// MODALS
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { background: '#fff', width: '90%', maxWidth: '450px', borderRadius: '40px', padding: '40px', position: 'relative', animation: 'slideUp 0.3s ease-out' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const modalTitle = { fontSize: '22px', fontWeight: 950, margin: 0, letterSpacing: '-1px' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const modalBody = { marginBottom: '35px' };
const ticketPreviewCard = { background: '#fafafa', borderRadius: '30px', border: '2px dashed #e2e8f0', padding: '30px' };
const previewTop = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' };
const previewEventName = { fontWeight: 900, fontSize: '18px', margin: 0 };
const previewStatus = { fontSize: '10px', fontWeight: 900, background: '#000', color: '#fff', padding: '4px 10px', borderRadius: '6px' };
const previewMid = { display: 'flex', gap: '20px', alignItems: 'center', paddingBottom: '30px', borderBottom: '1px solid #e2e8f0', marginBottom: '30px' };
const previewInfo = { display: 'flex', flexDirection: 'column' };
const previewLabel = { fontSize: '10px', color: '#94a3b8', fontWeight: 800, margin: 0 };
const previewValue = { fontSize: '13px', fontWeight: 700, margin: '2px 0 0' };
const previewBottom = { display: 'flex', justifyContent: 'space-between' };
const previewStat = { display: 'flex', flexDirection: 'column' };
const modalActionBtn = { width: '100%', padding: '20px', background: '#000', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 900, fontSize: '15px', cursor: 'pointer' };

// CONTESTS
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '30px' };
const contestCard = { background: '#fff', borderRadius: '40px', border: '1px solid #f1f5f9', padding: '40px', transition: 'transform 0.2s' };
const contestHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' };
const contestTitleGroup = { display: 'flex', flexDirection: 'column', gap: '5px' };
const contestTitle = { margin: 0, fontSize: '22px', fontWeight: 950, letterSpacing: '-0.5px' };
const contestSub = { margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: 700 };
const contestIconBox = { width: '50px', height: '50px', background: '#f0f9ff', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const contestProgressSection = { marginBottom: '35px' };
const progressLabelRow = { display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 900, color: '#0ea5e9', marginBottom: '12px', letterSpacing: '0.5px' };
const progressBarBg = { height: '8px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' };
const progressBarFill = (w) => ({ height: '100%', width: `${w}%`, background: '#0ea5e9', borderRadius: '10px' });
const contestBody = { display: 'flex', gap: '35px', marginBottom: '40px', padding: '25px', background: '#fafafa', borderRadius: '25px' };
const contestStat = { display: 'flex', flexDirection: 'column', gap: '5px' };
const cStatLabel = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' };
const cStatVal = { fontSize: '22px', fontWeight: 950, color: '#1a1a1a' };
const manageContestBtn = { width: '100%', background: '#fff', border: '1px solid #e2e8f0', padding: '18px', borderRadius: '20px', fontWeight: 900, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };

// UTILS & LOADER
const fullPageCenter = { height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const loaderContainer = { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const luxuryLoaderRing = { width: '60px', height: '60px', border: '4px solid #f3f3f3', borderTop: '4px solid #000', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '25px' };
const loadingLogo = { fontSize: '28px', fontWeight: 950, letterSpacing: '6px', margin: '0 0 10px' };
const loadingText = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '2px' };

const ticketCode = { fontFamily: 'monospace', background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#475569' };
const typeBadge = { padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, background: '#f8fafc', border: '1px solid #e2e8f0' };
const eventRefText = { fontWeight: 700, color: '#000' };
const netSaleText = { fontWeight: 900, color: '#16a34a', margin: 0 };
const emptyState = { textAlign: 'center', padding: '120px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const emptyIllustration = { marginBottom: '30px', opacity: 0.5 };
const emptyTitle = { fontSize: '22px', fontWeight: 900, margin: '0 0 10px' };
const emptySub = { color: '#94a3b8', fontSize: '15px', marginBottom: '30px' };
const emptyBtn = { background: '#000', color: '#fff', border: 'none', padding: '16px 35px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' };

const footerBranding = { marginTop: '100px', borderTop: '1px solid #f1f5f9', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '40px' };
const footerLinks = { display: 'flex', gap: '30px' };
