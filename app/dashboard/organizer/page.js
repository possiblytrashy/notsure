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
  const [showEventActions, setShowEventActions] = useState(null); // ID of event
  
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

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Check for Paystack Subaccount in metadata or profiles table
      // We check both for maximum reliability
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const hasSubaccount = !!(user.user_metadata?.paystack_subaccount_code || profileData?.paystack_subaccount_code);
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
        activeEvents: eventsRes.data?.filter(e => e.status === 'active').length || 0,
        conversionRate: myTickets.length > 0 ? ((myTickets.length / 100) * 100).toFixed(1) : 0 // Placeholder logic
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
    
    // Listen for Auth changes (helps with onboarding state)
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
    const confirmed = window.confirm("Are you sure? This will permanently delete the event and all associated sales data. This cannot be undone.");
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
    const headers = ["Ticket ID", "Event", "Customer Email", "Gross Amount (GHS)", "Organizer Net (95%)", "Status", "Date"];
    const csvData = data.tickets.map(t => [
      t.id,
      t.events?.title,
      t.customer_email,
      t.amount,
      (t.amount * 0.95).toFixed(2),
      t.status || 'paid',
      new Date(t.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...csvData].map(e => `"${e.join('","')}"`).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ousted_organizer_sales_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
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
            <div style={modalTitleSection}>
               <Ticket size={20} color="#000"/>
               <h3 style={modalTitle}>Ticket Analysis</h3>
            </div>
            <button style={closeBtn} onClick={() => setSelectedTicket(null)}><X size={20}/></button>
          </div>
          <div style={modalBody}>
            <div style={ticketPreviewCard}>
               <div style={previewTop}>
                 <p style={previewEventName}>{selectedTicket.events?.title}</p>
                 <span style={statusBadge('active')}>VALIDATED</span>
               </div>
               <div style={previewMid}>
                  <div style={qrContainer}>
                    <QrCode size={130} strokeWidth={1.2}/>
                  </div>
                  <div style={previewInfo}>
                    <p style={previewLabel}>PURCHASER</p>
                    <p style={previewValue}>{selectedTicket.customer_email}</p>
                    <p style={previewLabel} style={{marginTop: '15px'}}>TRANSACTION REF</p>
                    <p style={previewValue}>#{selectedTicket.id.slice(0,14).toUpperCase()}</p>
                  </div>
               </div>
               <div style={previewBottom}>
                 <div style={previewStat}>
                    <span>NET REVENUE</span>
                    <p>GHS {(selectedTicket.amount * 0.95).toFixed(2)}</p>
                 </div>
                 <div style={previewStat}>
                    <span>TIER TYPE</span>
                    <p>{selectedTicket.ticket_type || 'Standard Entry'}</p>
                 </div>
               </div>
            </div>
            
            <div style={modalMeta}>
               <div style={metaItem}>
                 <Clock size={14}/> <span>Purchased on {new Date(selectedTicket.created_at).toLocaleString()}</span>
               </div>
               <div style={metaItem}>
                 <ShieldCheck size={14}/> <span>Secured by Ousted & Paystack</span>
               </div>
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

  // --- 6. VIEW STATES (LOADING & ONBOARDING) ---

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
            <p style={onboardSub}>To activate your luxury event creation tools and automated payment splits, please finalize your merchant profile.</p>
            
            <button style={primaryOnboardBtn} onClick={() => router.push('/dashboard/organizer/onboarding')}>
              BEGIN ONBOARDING FORM <ChevronRight size={20}/>
            </button>
          </div>

          <div style={onboardInfoSection}>
            <h3 style={sectionHeading}>Our Financial Infrastructure</h3>
            <div style={howItWorksGrid}>
              <div style={howCard}>
                <div style={howIcon}><Building2 size={24}/></div>
                <h3 style={howTitle}>95% Revenue Direct</h3>
                <p style={howText}>Ousted organizers retain 95% of every transaction. Our system calculates this in real-time as tickets are sold.</p>
              </div>
              <div style={howCard}>
                <div style={howIcon}><ShieldCheck size={24}/></div>
                <h3 style={howTitle}>5% Flat Commission</h3>
                <p style={howText}>The 5% fee is inclusive of Paystack processing, automated VAT handling, and our 24/7 technical infrastructure.</p>
              </div>
              <div style={howCard}>
                <div style={howIcon}><Banknote size={24}/></div>
                <h3 style={howTitle}>Rapid Settlements</h3>
                <p style={howText}>Your revenue is settled directly into your connected account based on your verified Paystack frequency.</p>
              </div>
            </div>

            <div style={commissionNotice}>
               <div style={noticeIconBox}><Info size={24} color="#0ea5e9"/></div>
               <div style={{display: 'flex', flexDirection: 'column'}}>
                 <p style={{margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b'}}>Transparent Split Agreement</p>
                 <p style={{margin: 0, fontSize: '13px', color: '#64748b', marginTop: '4px', lineHeight: 1.5}}>
                   Ousted uses a "Net-95" split. If you sell a premium ticket for <b>GHS 1,000.00</b>, Ousted retains <b>GHS 50.00</b> and your bank is credited with <b>GHS 950.00</b> automatically.
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 7. DASHBOARD MAIN UI ---

  return (
    <div style={mainWrapper}>
      <TicketDetailModal />
      
      {/* Upper Navigation Bar */}
      <div style={topNav}>
        <div style={logoSection}>
          <h1 style={logoText}>OUSTED <span style={badgePro}>ORGANIZER</span></h1>
        </div>
        
        <div style={headerActions}>
           <div style={searchWrapper}>
              <Search size={18} style={searchIcon}/>
              <input 
                type="text" 
                placeholder="Find events, tickets, buyers..." 
                style={searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <p style={userRole}>PRO PARTNER</p>
           </div>

           <button style={circleAction} onClick={() => loadDashboardData(true)} title="Refresh Dashboard">
             <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           
           <button style={logoutCircle} onClick={handleLogout} title="Logout">
             <LogOut size={18}/>
           </button>
        </div>
      </div>

      {/* Financial Core Metrics */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <div style={labelWithIcon}>
               <PieChart size={14} color="#64748b"/>
               <p style={financeLabel}>TOTAL NET PERFORMANCE (95%)</p>
            </div>
            <div style={statusDot}>LIVE REVENUE</div>
          </div>
          <h2 style={balanceValue}>GHS {stats.netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          
          <div style={revenueBreakdown}>
             <div style={breakdownItem}>
                <span style={breakdownLabel}>Gross Ticket Revenue</span>
                <span style={breakdownValue}>GHS {stats.grossRevenue.toLocaleString()}</span>
             </div>
             <div style={breakdownItem}>
                <span style={breakdownLabel}>Ousted Service Retention (5%)</span>
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
              <p style={statLabel}>ACTIVE CONTEST VOTES</p>
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

      {/* Tab Management System */}
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
          <button onClick={() => setActiveTab('analytics')} style={tabItem(activeTab === 'analytics')}>
            <Activity size={16}/> ANALYTICS
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

      {/* Dynamic Viewport Content */}
      <div style={viewPort}>
        
        {/* TAB: EVENTS */}
        {activeTab === 'events' && (
          <div style={gridContent}>
            {filteredEvents.length === 0 ? (
              <div style={emptyState}>
                <div style={emptyIllustration}><Calendar size={64} color="#f1f5f9"/></div>
                <h3 style={emptyTitle}>No events in your portfolio</h3>
                <p style={emptySub}>Once you create your first luxury experience, it will appear here for management.</p>
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
                               {event.image_url ? <img src={event.image_url} style={imgThumb} alt={event.title}/> : <MapPin size={22} color="#94a3b8"/>}
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
                          <span style={statusBadge(event.status || 'active')}>{event.status?.toUpperCase() || 'ACTIVE'}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={earningsWrapper}>
                             <p style={tablePrice}>GHS {(data.tickets.filter(t => t.event_id === event.id).reduce((s, t) => s + (t.amount || 0), 0) * 0.95).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                             <p style={earningsGross}>Gross: GHS {data.tickets.filter(t => t.event_id === event.id).reduce((s, t) => s + (t.amount || 0), 0).toLocaleString()}</p>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={actionGroup}>
                            <button title="View Analytics" style={iconAction} onClick={() => router.push(`/dashboard/organizer/events/${event.id}`)}><Eye size={16}/></button>
                            <button title="Edit Settings" style={iconAction} onClick={() => router.push(`/dashboard/organizer/events/edit/${event.id}`)}><Settings size={16}/></button>
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

        {/* TAB: CONTESTS */}
        {activeTab === 'contests' && (
          <div style={gridContent}>
            {data.contests.length === 0 ? (
               <div style={emptyState}>
                 <Trophy size={64} color="#f1f5f9"/>
                 <h3 style={emptyTitle}>No engagement contests found</h3>
                 <p style={emptySub}>Contests are a powerful way to drive viral ticket sales and community growth.</p>
               </div>
            ) : (
              <div style={contestGrid}>
                {data.contests.map((contest) => (
                  <div key={contest.id} style={contestCard}>
                    <div style={contestHeader}>
                      <div style={contestTitleGroup}>
                        <h3 style={contestTitle}>{contest.title}</h3>
                        <p style={contestSub}>{contest.candidates?.length || 0} Registered Candidates</p>
                      </div>
                      <div style={contestIconBox}><Award size={24} color="#0ea5e9"/></div>
                    </div>
                    
                    <div style={contestProgressSection}>
                       <div style={progressLabelRow}>
                          <span>VOTER ENGAGEMENT</span>
                          <span>{contest.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0).toLocaleString()} VOTES</span>
                       </div>
                       <div style={progressBarBg}><div style={progressBarFill(Math.min(100, (contest.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0) / 100)))}></div></div>
                    </div>

                    <div style={contestBody}>
                      <div style={contestStat}>
                         <span style={cStatLabel}>NET VOTE REVENUE</span>
                         <span style={cStatVal}>GHS {(contest.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0) * 0.95).toFixed(2)}</span>
                      </div>
                      <div style={contestStat}>
                         <span style={cStatLabel}>TOP PERFORMER</span>
                         <span style={cStatVal}>{contest.candidates?.sort((a,b) => b.vote_count - a.vote_count)[0]?.name || 'No votes'}</span>
                      </div>
                    </div>
                    
                    <button style={manageContestBtn} onClick={() => router.push(`/dashboard/organizer/contests/${contest.id}`)}>
                      VIEW DETAILED RANKINGS <ChevronRight size={16}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SALES LEDGER */}
        {activeTab === 'sales' && (
          <div style={gridContent}>
            <div style={ledgerHeader}>
               <h2 style={ledgerTitle}>Real-time Transaction Stream</h2>
               <p style={ledgerSub}>Audit trail of every premium ticket generated across your events.</p>
            </div>
            
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
                      <th style={thStyle}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.length === 0 ? (
                      <tr><td colSpan="7" style={{padding: '100px', textAlign: 'center', color: '#94a3b8'}}>No transaction records found matching your current filter.</td></tr>
                    ) : (
                      filteredTickets.map((ticket) => (
                        <tr key={ticket.id} style={trStyle}>
                          <td style={tdStyle}><span style={ticketCode}>#{ticket.id.slice(0,10).toUpperCase()}</span></td>
                          <td style={tdStyle}><span style={eventRefText}>{ticket.events?.title}</span></td>
                          <td style={tdStyle}>{ticket.customer_email || 'Verified Guest'}</td>
                          <td style={tdStyle}><span style={typeBadge}>{ticket.ticket_type || 'GENERAL'}</span></td>
                          <td style={tdStyle}><p style={netSaleText}>GHS {(ticket.amount * 0.95).toFixed(2)}</p></td>
                          <td style={tdStyle}>{new Date(ticket.created_at).toLocaleDateString()}</td>
                          <td style={tdStyle}>
                             <button style={iconAction} onClick={() => setSelectedTicket(ticket)} title="View QR & Details"><QrCode size={16}/></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
            </div>
          </div>
        )}

        {/* TAB: ANALYTICS (PREMIUM) */}
        {activeTab === 'analytics' && (
          <div style={gridContent}>
            <div style={analyticsGrid}>
               <div style={analyticsLargeCard}>
                  <div style={cardHeader}>
                     <h3 style={cardTitle}>Revenue Velocity</h3>
                     <TrendingUp size={18} color="#22c55e"/>
                  </div>
                  <div style={placeholderChart}>
                     {/* Integration for Chart.js or Recharts goes here */}
                     <p style={{color: '#94a3b8', fontSize: '14px'}}>Interactive revenue charts are generated as sales volume increases.</p>
                  </div>
               </div>
               
               <div style={analyticsMiniGrid}>
                  <div style={miniStatCard}>
                     <Users size={20} color="#000"/>
                     <div style={miniStatInfo}>
                        <p style={miniStatLabel}>Return Customers</p>
                        <p style={miniStatVal}>12.4%</p>
                     </div>
                  </div>
                  <div style={miniStatCard}>
                     <Clock size={20} color="#000"/>
                     <div style={miniStatInfo}>
                        <p style={miniStatLabel}>Avg. Purchase Time</p>
                        <p style={miniStatVal}>4.2m</p>
                     </div>
                  </div>
                  <div style={miniStatCard}>
                     <Share2 size={20} color="#000"/>
                     <div style={miniStatInfo}>
                        <p style={miniStatLabel}>Viral Coefficient</p>
                        <p style={miniStatVal}>1.18</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Footer Branding */}
      <div style={footerBranding}>
        <div style={footerLeft}>
           <p style={footerCopy}>© 2025 OUSTED PREMIUM. ALL RIGHTS RESERVED.</p>
           <p style={footerSystemStatus}><div style={onlineDot}></div> ALL SYSTEMS OPERATIONAL</p>
        </div>
        <div style={footerLinks}>
           <a href="#" style={footerLink}>Merchant Support</a>
           <a href="#" style={footerLink}>Partnership Terms</a>
           <a href="#" style={footerLink}>Developer API</a>
        </div>
      </div>
    </div>
  );
}

// --- 8. EXHAUSTIVE CSS-IN-JS STYLES ---

const mainWrapper = { 
  padding: '50px 30px', 
  maxWidth: '1400px', 
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
  marginBottom: '60px',
  flexWrap: 'wrap',
  gap: '30px'
};

const logoSection = { display: 'flex', alignItems: 'center' };
const logoText = { fontSize: '28px', fontWeight: 950, letterSpacing: '-2px', display: 'flex', alignItems: 'center', margin: 0 };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '6px 14px', borderRadius: '10px', marginLeft: '15px', letterSpacing: '1.5px', fontWeight: 900 };

const headerActions = { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' };
const searchWrapper = { position: 'relative', minWidth: '320px' };
const searchIcon = { position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };
const searchInput = { width: '100%', padding: '14px 18px 14px 50px', borderRadius: '18px', border: '1px solid #f1f5f9', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', fontWeight: 500 };

const userBrief = { textAlign: 'right', marginRight: '5px' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 800 };
const userRole = { margin: 0, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 700 };

const circleAction = { width: '52px', height: '52px', borderRadius: '18px', border: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const logoutCircle = { width: '52px', height: '52px', borderRadius: '18px', border: 'none', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

// FINANCE CARDS
const financeGrid = { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '40px', marginBottom: '80px' };
const balanceCard = { background: '#000', borderRadius: '50px', padding: '55px', color: '#fff', boxShadow: '0 40px 80px -20px rgba(0, 0, 0, 0.35)', position: 'relative', overflow: 'hidden' };
const cardDecoration = { position: 'absolute', top: '-120px', right: '-120px', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 75%)', borderRadius: '50%' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const labelWithIcon = { display: 'flex', alignItems: 'center', gap: '10px' };
const financeLabel = { fontSize: '13px', fontWeight: 800, color: '#737373', letterSpacing: '3px', margin: 0 };
const statusDot = { background: '#22c55e', color: '#fff', fontSize: '10px', padding: '6px 16px', borderRadius: '25px', fontWeight: 950 };
const balanceValue = { fontSize: '72px', fontWeight: 950, margin: '30px 0', letterSpacing: '-4px' };
const revenueBreakdown = { borderTop: '1px solid #262626', paddingTop: '30px', marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px' };
const breakdownItem = { display: 'flex', justifyContent: 'space-between', fontSize: '15px' };
const breakdownLabel = { color: '#8c8c8c', fontWeight: 500 };
const breakdownValue = { fontWeight: 700, color: '#f5f5f5' };
const financeActionRow = { display: 'flex', gap: '20px', marginTop: '55px' };
const withdrawBtn = { flex: 1, background: '#fff', color: '#000', border: 'none', padding: '22px', borderRadius: '25px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', fontSize: '16px', transition: 'transform 0.2s' };
const settingsIconBtn = { width: '65px', height: '65px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '25px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const statsOverview = { display: 'flex', flexDirection: 'column', gap: '25px' };
const statBox = { background: '#fff', padding: '40px', borderRadius: '40px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 15px 30px -10px rgba(0, 0, 0, 0.04)' };
const statIconBox = { width: '60px', height: '60px', background: '#f8fafc', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statInfo = { display: 'flex', flexDirection: 'column' };
const statLabel = { fontSize: '13px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', margin: 0 };
const statNumber = { fontSize: '36px', fontWeight: 950, margin: '10px 0 0', letterSpacing: '-1.5px' };
const balanceMiniBox = { background: '#f0f9ff', padding: '25px 40px', borderRadius: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e0f2fe' };
const miniLabel = { fontSize: '13px', fontWeight: 900, color: '#0ea5e9', letterSpacing: '0.8px' };
const miniValue = { fontSize: '22px', fontWeight: 950, color: '#0ea5e9' };

// TABS
const tabContainer = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '45px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '25px' };
const tabBar = { display: 'flex', gap: '50px' };
const tabItem = (active) => ({ padding: '28px 0', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: active ? '4px solid #000' : '4px solid transparent', transition: 'all 0.3s ease' });
const tabActions = { display: 'flex', gap: '18px' };
const secondaryBtn = { background: '#fff', color: '#000', border: '1px solid #e2e8f0', padding: '14px 26px', borderRadius: '18px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' };
const addBtn = { background: '#000', color: '#fff', border: 'none', padding: '16px 32px', borderRadius: '20px', fontWeight: 950, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 12px 24px rgba(0,0,0,0.12)' };

// TABLES
const luxuryTableContainer = { background: '#fff', borderRadius: '40px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.02)' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '25px 35px', background: '#fafafa', fontSize: '13px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase' };
const trStyle = { borderBottom: '1px solid #f8fafc', transition: 'background 0.2s' };
const tdStyle = { padding: '35px' };

const eventBrief = { display: 'flex', alignItems: 'center', gap: '25px' };
const eventImagePlaceholder = { width: '70px', height: '70px', background: '#f1f5f9', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
const imgThumb = { width: '100%', height: '100%', objectFit: 'cover' };
const eventInfo = { display: 'flex', flexDirection: 'column', gap: '6px' };
const eventTitleText = { margin: 0, fontWeight: 900, fontSize: '18px', color: '#1a1a1a' };
const eventCategory = { margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: 600 };
const dateBox = { display: 'flex', flexDirection: 'column', gap: '6px' };
const dateText = { margin: 0, fontWeight: 800, fontSize: '15px' };
const venueText = { margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: 500 };
const tablePrice = { fontWeight: 950, fontSize: '20px', margin: 0 };
const actionGroup = { display: 'flex', gap: '12px' };
const iconAction = { width: '45px', height: '45px', borderRadius: '15px', border: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' };
const deleteAction = { ...iconAction, color: '#e11d48', borderColor: '#fee2e2', background: '#fff1f2' };

// MODALS
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { background: '#fff', width: '95%', maxWidth: '500px', borderRadius: '45px', padding: '45px', position: 'relative' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' };
const modalTitleSection = { display: 'flex', alignItems: 'center', gap: '15px' };
const modalTitle = { fontSize: '24px', fontWeight: 950, margin: 0, letterSpacing: '-1.5px' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' };
const modalBody = { marginBottom: '40px' };
const ticketPreviewCard = { background: '#000', borderRadius: '35px', padding: '35px', color: '#fff' };
const previewTop = { display: 'flex', justifyContent: 'space-between', marginBottom: '35px' };
const previewEventName = { fontWeight: 900, fontSize: '20px', margin: 0, letterSpacing: '-0.5px' };
const previewMid = { display: 'flex', gap: '25px', alignItems: 'center', paddingBottom: '35px', borderBottom: '1px solid #333', marginBottom: '35px' };
const qrContainer = { background: '#fff', padding: '15px', borderRadius: '25px' };
const previewInfo = { display: 'flex', flexDirection: 'column' };
const previewLabel = { fontSize: '11px', color: '#737373', fontWeight: 900, margin: 0, letterSpacing: '1px' };
const previewValue = { fontSize: '14px', fontWeight: 700, margin: '4px 0 0' };
const previewBottom = { display: 'flex', justifyContent: 'space-between' };
const previewStat = { display: 'flex', flexDirection: 'column', gap: '5px' };
const modalMeta = { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '30px' };
const metaItem = { display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8', fontSize: '13px', fontWeight: 600 };
const modalFooterActions = { display: 'flex', gap: '15px' };
const modalSecondaryBtn = { flex: 1, padding: '20px', background: '#f8fafc', border: 'none', borderRadius: '22px', fontWeight: 800, cursor: 'pointer' };
const modalActionBtn = { flex: 2, padding: '20px', background: '#000', color: '#fff', border: 'none', borderRadius: '22px', fontWeight: 950, cursor: 'pointer' };

// ONBOARDING GATE
const onboardingContainer = { maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.8s ease-out' };
const onboardHero = { background: '#fff', border: '1px solid #f1f5f9', borderRadius: '60px', padding: '120px 60px', textAlign: 'center', marginBottom: '70px', boxShadow: '0 40px 80px -15px rgba(0,0,0,0.06)' };
const heroDecoration = { marginBottom: '40px', display: 'inline-block', padding: '30px', background: '#f0f9ff', borderRadius: '35px' };
const onboardTitle = { fontSize: '56px', fontWeight: 950, margin: '0 0 30px', letterSpacing: '-3px' };
const onboardSub = { color: '#64748b', fontSize: '20px', maxWidth: '650px', margin: '0 auto 60px', lineHeight: 1.8 };
const primaryOnboardBtn = { background: '#000', color: '#fff', border: 'none', padding: '28px 65px', borderRadius: '28px', fontWeight: 950, fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', margin: '0 auto', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' };

const onboardInfoSection = { padding: '0 30px' };
const sectionHeading = { fontSize: '14px', fontWeight: 900, letterSpacing: '3px', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center', marginBottom: '50px' };
const howItWorksGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', marginBottom: '70px' };
const howCard = { background: '#fff', padding: '45px', borderRadius: '45px', border: '1px solid #f1f5f9' };
const howIcon = { width: '70px', height: '70px', background: '#f8fafc', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '35px', color: '#0ea5e9' };
const howTitle = { fontSize: '22px', fontWeight: 900, margin: '0 0 18px' };
const howText = { fontSize: '16px', color: '#64748b', lineHeight: 1.8, margin: 0 };
const commissionNotice = { background: '#fff', padding: '35px 50px', borderRadius: '40px', display: 'flex', alignItems: 'center', gap: '30px', border: '1px solid #e0f2fe' };
const noticeIconBox = { minWidth: '60px', height: '60px', background: '#f0f9ff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

// CONTESTS
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '35px' };
const contestCard = { background: '#fff', borderRadius: '45px', border: '1px solid #f1f5f9', padding: '45px', transition: 'transform 0.2s' };
const contestHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '35px' };
const contestTitleGroup = { display: 'flex', flexDirection: 'column', gap: '8px' };
const contestTitle = { margin: 0, fontSize: '24px', fontWeight: 950, letterSpacing: '-1px' };
const contestSub = { margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: 700 };
const contestIconBox = { width: '60px', height: '60px', background: '#f0f9ff', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const contestProgressSection = { marginBottom: '40px' };
const progressLabelRow = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 950, color: '#0ea5e9', marginBottom: '15px', letterSpacing: '1px' };
const progressBarBg = { height: '10px', background: '#f1f5f9', borderRadius: '15px', overflow: 'hidden' };
const progressBarFill = (w) => ({ height: '100%', width: `${w}%`, background: '#0ea5e9', borderRadius: '15px' });
const contestBody = { display: 'flex', gap: '40px', marginBottom: '45px', padding: '30px', background: '#fafafa', borderRadius: '30px' };
const cStatLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.2px' };
const cStatVal = { fontSize: '24px', fontWeight: 950, color: '#1a1a1a', marginTop: '5px', display: 'block' };
const manageContestBtn = { width: '100%', background: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '22px', fontWeight: 900, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' };

// ANALYTICS & MISC
const ledgerHeader = { marginBottom: '35px', padding: '0 10px' };
const ledgerTitle = { fontSize: '26px', fontWeight: 950, margin: '0 0 10px', letterSpacing: '-1px' };
const ledgerSub = { color: '#94a3b8', fontWeight: 600, fontSize: '15px', margin: 0 };
const netSaleText = { fontWeight: 950, color: '#16a34a', margin: 0, fontSize: '18px' };
const ticketCode = { fontFamily: 'monospace', background: '#f1f5f9', padding: '8px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: '#475569' };
const typeBadge = { padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 900, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' };
const eventRefText = { fontWeight: 800, color: '#000' };

const analyticsGrid = { display: 'grid', gridTemplateColumns: '1fr 0.4fr', gap: '35px' };
const analyticsLargeCard = { background: '#fff', borderRadius: '45px', border: '1px solid #f1f5f9', padding: '45px', minHeight: '400px', display: 'flex', flexDirection: 'column' };
const cardTitle = { fontSize: '20px', fontWeight: 900, margin: 0 };
const placeholderChart = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #f1f5f9', borderRadius: '30px', marginTop: '25px' };
const analyticsMiniGrid = { display: 'flex', flexDirection: 'column', gap: '25px' };
const miniStatCard = { background: '#fff', padding: '30px', borderRadius: '35px', border: '1px solid #f1f5f9', display: 'flex', gap: '20px', alignItems: 'center' };
const miniStatInfo = { display: 'flex', flexDirection: 'column' };
const miniStatLabel = { fontSize: '12px', color: '#94a3b8', fontWeight: 800, margin: 0 };
const miniStatVal = { fontSize: '24px', fontWeight: 950, margin: '4px 0 0' };

const fullPageCenter = { height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const loaderContainer = { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '300px' };
const luxuryLoaderRing = { width: '70px', height: '70px', border: '4px solid #f3f3f3', borderTop: '4px solid #000', borderRadius: '50%', animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite', marginBottom: '35px' };
const loadingLogo = { fontSize: '32px', fontWeight: 950, letterSpacing: '8px', margin: '0 0 15px' };
const loadingText = { fontSize: '13px', fontWeight: 800, color: '#94a3b8', letterSpacing: '3px', textTransform: 'uppercase' };
const loadingProgressLine = { width: '100%', height: '3px', background: '#f1f5f9', borderRadius: '10px', marginTop: '20px', overflow: 'hidden' };
const loadingProgressFill = { width: '40%', height: '100%', background: '#000', animation: 'progress 2s ease-in-out infinite' };

const emptyState = { textAlign: 'center', padding: '140px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const emptyIllustration = { marginBottom: '40px', opacity: 0.6 };
const emptyTitle = { fontSize: '26px', fontWeight: 950, margin: '0 0 15px', letterSpacing: '-1px' };
const emptySub = { color: '#94a3b8', fontSize: '16px', marginBottom: '40px', maxWidth: '400px', lineHeight: 1.6 };
const emptyBtn = { background: '#000', color: '#fff', border: 'none', padding: '18px 45px', borderRadius: '18px', fontWeight: 900, cursor: 'pointer', fontSize: '15px' };

const footerBranding = { marginTop: '120px', borderTop: '1px solid #f1f5f9', paddingTop: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '60px', flexWrap: 'wrap', gap: '30px' };
const footerLeft = { display: 'flex', flexDirection: 'column', gap: '10px' };
const footerCopy = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', margin: 0, letterSpacing: '1px' };
const footerSystemStatus = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', fontWeight: 900, color: '#22c55e', margin: 0 };
const onlineDot = { width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 10px #22c55e' };
const footerLinks = { display: 'flex', gap: '40px' };
const footerLink = { textDecoration: 'none', color: '#1a1a1a', fontSize: '13px', fontWeight: 700, transition: 'color 0.2s' };
