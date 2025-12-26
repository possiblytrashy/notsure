"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Calendar, Trophy, Wallet, Settings, 
  Link as LinkIcon, Check, QrCode, Download, X,
  Loader2, LogOut, Search, RefreshCcw, MoreHorizontal,
  ChevronRight, MapPin, Award, AlertCircle, Info,
  ShieldCheck, History, Zap, TrendingUp, Users, 
  BarChart3, ArrowUpRight, Filter, DownloadCloud,
  Eye, MousePointer2, Share2, Star, Clock, Trash2, Edit3,
  Layers, Activity, Sparkles, ChevronDown, UserPlus,
  BarChart, PieChart, CreditCard, Layout, Trash, ExternalLink,
  ChevronUp, DollarSign, Globe, Smartphone, MousePointer, 
  UserCheck, Shield, ZapOff, Briefcase, Landmark
} from 'lucide-react';

/**
 * OUSTED PLATINUM - ORGANIZER CORE v3.0
 * Comprehensive luxury ticketing, voting, and financial management.
 */

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. PRIMARY DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('events'); 
  const [data, setData] = useState({ 
    events: [], 
    competitions: [], 
    tickets: [], 
    profile: null,
    scans: [] 
  });

  // --- 2. INTERFACE & UX STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  const [showCandidateModal, setShowCandidateModal] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // --- 3. PAYOUT & SETTINGS STATE ---
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "",
    bankCode: "",
    accountNumber: "",
    subaccountCode: "", 
    isVerified: false,
    payoutSchedule: "weekly",
    contactEmail: ""
  });

  // --- 4. FORM STATE ---
  const [newCandidate, setNewCandidate] = useState({ 
    name: '', 
    image_url: '', 
    bio: '', 
    social_handle: '' 
  });

  // --- 5. DATA ENGINE (SUPABASE REALTIME SYNC) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Parallel Data Fetching for maximum performance
      const [profileRes, eventsRes, compsRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*, ticket_tiers(*), venues(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('competitions').select(`*, contests (*, candidates (*))`).eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id), ticket_tiers(name, price)').order('created_at', { ascending: false }),
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      setData({
        events: eventsRes.data || [],
        competitions: compsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileRes.data },
        scans: myTickets.filter(t => t.is_scanned)
      });

      // Synchronize Paystack Settings from Profile
      if (profileRes.data?.paystack_subaccount_code) {
        setPaystackConfig({
          businessName: profileRes.data.business_name || "",
          bankCode: profileRes.data.bank_code || "",
          accountNumber: profileRes.data.account_number || "",
          subaccountCode: profileRes.data.paystack_subaccount_code,
          isVerified: true,
          payoutSchedule: profileRes.data.payout_schedule || "weekly",
          contactEmail: profileRes.data.email
        });
      }
    } catch (err) {
      console.error("CRITICAL_DASHBOARD_ERROR:", err);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setRefreshing(false);
      }, 1200);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
    // Setting up realtime subscription for ticket sales
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => loadDashboardData(true))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadDashboardData]);

  // --- 6. CORE ANALYTICS ENGINE ---
  const analytics = useMemo(() => {
    // 6a. Revenue Math
    const ticketRevenue = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    let voteRevenue = 0;
    let totalVotes = 0;
    
    data.competitions.forEach(comp => {
      comp.contests?.forEach(ct => {
        const ctVotes = ct.candidates?.reduce((s, c) => s + (parseInt(c.vote_count) || 0), 0) || 0;
        totalVotes += ctVotes;
        voteRevenue += (ctVotes * (ct.vote_price || 0));
      });
    });

    const grossTotal = ticketRevenue + voteRevenue;
    const organizerNet = grossTotal * 0.95;
    const platformFee = grossTotal * 0.05;

    // 6b. Tier Performance Breakdown
    const tierMap = {};
    data.tickets.forEach(t => {
      const name = t.ticket_tiers?.name || 'Standard';
      tierMap[name] = (tierMap[name] || 0) + 1;
    });

    // 6c. Check-in Rate
    const checkInRate = data.tickets.length > 0 
      ? Math.round((data.scans.length / data.tickets.length) * 100) 
      : 0;

    // 6d. Competition Leaderboards
    const allCandidates = data.competitions.flatMap(comp => 
      comp.contests?.flatMap(ct => ct.candidates?.map(c => ({
        ...c,
        contest_name: ct.title,
        comp_name: comp.title
      }))) || []
    ).sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

    return {
      grossTotal,
      organizerNet,
      platformFee,
      ticketRevenue,
      voteRevenue,
      totalVotes,
      checkInRate,
      tierMap,
      topCandidates: allCandidates.slice(0, 5),
      salesVelocity: (data.tickets.length / (data.events.length || 1)).toFixed(1)
    };
  }, [data]);

  // --- 7. HANDLERS & ACTIONS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const copyToClipboard = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  const handleUpdatePayouts = async () => {
    setIsProcessing(true);
    // Simulating Paystack Subaccount API integration
    try {
      const { error } = await supabase.from('profiles').update({
        business_name: paystackConfig.businessName,
        bank_code: paystackConfig.bankCode,
        account_number: paystackConfig.accountNumber,
        payout_schedule: paystackConfig.payoutSchedule
      }).eq('id', data.profile.id);

      if (error) throw error;
      setShowSettingsModal(false);
      loadDashboardData(true);
    } catch (e) {
      alert("Failed to update payout settings: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm("Are you sure? This will invalidate all tickets sold for this event.")) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (!error) loadDashboardData(true);
  };

  const addCandidate = async (contestId) => {
    if (!newCandidate.name) return;
    setIsProcessing(true);
    const { error } = await supabase.from('candidates').insert([{
      contest_id: contestId,
      name: newCandidate.name,
      image_url: newCandidate.image_url,
      bio: newCandidate.bio,
      social_handle: newCandidate.social_handle
    }]);
    if (!error) {
      setNewCandidate({ name: '', image_url: '', bio: '', social_handle: '' });
      setShowCandidateModal(null);
      loadDashboardData(true);
    }
    setIsProcessing(false);
  };

  // --- 8. RENDER HELPERS ---
  const filteredTickets = data.tickets.filter(t => {
    const term = ticketSearch.toLowerCase();
    const matchesSearch = t.guest_name?.toLowerCase().includes(term) || t.reference?.toLowerCase().includes(term);
    const matchesEvent = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
    return matchesSearch && matchesEvent;
  });

  // --- 9. SKELETON COMPONENT ---
  if (loading) return (
    <div style={skeletonWrapper}>
      <div style={skeletonHeader}>
        <div style={shimmerBox('200px', '40px')}></div>
        <div style={shimmerBox('100px', '40px')}></div>
      </div>
      <div style={skeletonGrid}>
        <div style={shimmerBox('100%', '300px')}></div>
        <div style={shimmerBox('100%', '300px')}></div>
      </div>
      <div style={skeletonList}>
        {[1,2,3,4].map(i => <div key={i} style={shimmerBox('100%', '80px')}></div>)}
      </div>
    </div>
  );

  return (
    <div style={mainWrapper}>
      
      {/* --- SECTION: TOP NAVIGATION --- */}
      <header style={headerContainer}>
        <div style={brandBlock}>
          <div style={logoIcon}><ShieldCheck size={28} color="#000"/></div>
          <div>
            <h1 style={logoText}>OUSTED <span style={goldText}>PLATINUM</span></h1>
            <div style={statusRow}>
              <div style={pulseDot}></div>
              <span style={systemStatus}>LIVE INFRASTRUCTURE V3</span>
            </div>
          </div>
        </div>
        
        <div style={navActions}>
          <div style={profileBrief}>
            <p style={userName}>{data.profile?.business_name || 'VIP Organizer'}</p>
            <p style={userRole}>Consolidated Merchant Account</p>
          </div>
          <button style={settingsToggle} onClick={() => setShowSettingsModal(true)}>
            <Settings size={20} color="#64748b"/>
          </button>
          <button style={refreshBtn(refreshing)} onClick={() => loadDashboardData(true)}>
            <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
          </button>
          <button style={logoutBtn} onClick={handleLogout}>
            <LogOut size={18}/>
          </button>
        </div>
      </header>

      {/* --- SECTION: FINANCIAL INTELLIGENCE --- */}
      <section style={financialHero}>
        <div style={mainWalletCard}>
          <div style={walletTop}>
            <div style={labelGroup}>
              <span style={heroLabel}>NET SETTLEMENT BALANCE</span>
              <h2 style={heroAmount}>GHS {analytics.organizerNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
            <div style={platformBadge}>
              <Award size={14} color="#d4af37"/> 5% PLATFORM SPLIT ACTIVE
            </div>
          </div>
          <div style={walletBottom}>
            <div style={subStat}>
              <span style={subStatLabel}>TICKET GROSS</span>
              <span style={subStatVal}>GHS {analytics.ticketRevenue.toFixed(2)}</span>
            </div>
            <div style={subStatDivider}></div>
            <div style={subStat}>
              <span style={subStatLabel}>VOTING GROSS</span>
              <span style={subStatVal}>GHS {analytics.voteRevenue.toFixed(2)}</span>
            </div>
            <button style={withdrawBtn} onClick={() => setShowTransferModal(true)}>
              <DollarSign size={16}/> SETTLE FUNDS
            </button>
          </div>
        </div>

        <div style={metricsGrid}>
          <div style={metricCard}>
            <div style={metricHeader}>
              <div style={metricIcon(true)}><Ticket size={20}/></div>
              <span style={metricTrend}>+14% <ChevronUp size={12}/></span>
            </div>
            <div style={metricBody}>
              <h3 style={metricValue}>{data.tickets.length}</h3>
              <p style={metricName}>Total Tickets Issued</p>
            </div>
          </div>
          <div style={metricCard}>
            <div style={metricHeader}>
              <div style={metricIcon(false)}><Zap size={20}/></div>
              <span style={metricTrend}>High <Activity size={12}/></span>
            </div>
            <div style={metricBody}>
              <h3 style={metricValue}>{analytics.totalVotes.toLocaleString()}</h3>
              <p style={metricName}>Community Votes Cast</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION: PRIMARY TABS --- */}
      <nav style={tabNavigation}>
        {['events', 'sales', 'competitions', 'analytics', 'settings'].map((t) => (
          <button 
            key={t} 
            onClick={() => setActiveTab(t)} 
            style={tabButtonStyle(activeTab === t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </nav>

      <main style={viewContainer}>
        {/* 1. EVENTS VIEW */}
        {activeTab === 'events' && (
          <div style={tabContent}>
            <div style={contentHeader}>
              <h2 style={contentTitle}>Active Portfolio</h2>
              <button style={primaryActionBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={18}/> CREATE LUXURY EVENT
              </button>
            </div>
            
            <div style={eventGrid}>
              {data.events.map(event => (
                <div key={event.id} style={luxuryEventCard}>
                  <div style={eventImageWrap(event.images?.[0])}>
                    <div style={imgOverlay}>
                      <div style={badgeList}>
                        <span style={statusPill(true)}>ACTIVE</span>
                        <span style={tierCountPill}>{event.ticket_tiers?.length} TIERS</span>
                      </div>
                      <div style={quickActions}>
                        <button style={iconAction} onClick={() => copyToClipboard(`${window.location.origin}/events/${event.id}`, event.id)}>
                          {copying === event.id ? <Check size={14} color="#16a34a"/> : <LinkIcon size={14}/>}
                        </button>
                        <button style={iconAction} onClick={() => setShowQR(event.id)}><QrCode size={14}/></button>
                        <button style={deleteAction} onClick={() => deleteEvent(event.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                  <div style={eventBody}>
                    <h3 style={eventTitle}>{event.title}</h3>
                    <p style={eventVenue}><MapPin size={14}/> {event.location}</p>
                    <div style={eventTiers}>
                      {event.ticket_tiers?.map(tier => (
                        <div key={tier.id} style={tierRowCompact}>
                          <span>{tier.name}</span>
                          <span style={tierVal}>GHS {tier.price}</span>
                        </div>
                      ))}
                    </div>
                    <button style={manageBtn} onClick={() => router.push(`/dashboard/organizer/events/edit/${event.id}`)}>
                      MANAGE EVENT <ChevronRight size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. SALES LEDGER */}
        {activeTab === 'sales' && (
          <div style={tabContent}>
            <div style={contentHeader}>
              <h2 style={contentTitle}>Financial Ledger</h2>
              <div style={ledgerTools}>
                <div style={searchBar}>
                  <Search size={18} color="#94a3b8"/>
                  <input 
                    style={searchInput} 
                    placeholder="Search guest or reference..." 
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                  />
                </div>
                <select style={filterSelect} onChange={(e) => setSelectedEventFilter(e.target.value)}>
                   <option value="all">All Events</option>
                   {data.events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
                <button style={downloadReportBtn}><DownloadCloud size={18}/> EXPORT CSV</button>
              </div>
            </div>

            <div style={tableContainer}>
              <table style={platinumTable}>
                <thead>
                  <tr>
                    <th style={thStyle}>GUEST / REF</th>
                    <th style={thStyle}>TIER / EVENT</th>
                    <th style={thStyle}>GROSS (GHS)</th>
                    <th style={thStyle}>NET SETTLEMENT</th>
                    <th style={thStyle}>TIME</th>
                    <th style={thStyle}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => (
                    <tr key={t.id} style={trStyle}>
                      <td style={tdStyle}>
                        <div style={guestInfo}>
                          <span style={guestName}>{t.guest_name}</span>
                          <span style={guestRef}>{t.reference}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={guestInfo}>
                           <span style={tierName}>{t.ticket_tiers?.name}</span>
                           <span style={eventNameSmall}>{t.events?.title}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>GHS {t.amount}</td>
                      <td style={tdNet}>GHS {(t.amount * 0.95).toFixed(2)}</td>
                      <td style={tdStyle}>{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td style={tdStyle}>
                        {t.is_scanned ? <span style={pillScanned}>CHECKED-IN</span> : <span style={pillValid}>VALID</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. COMPETITION VIEW */}
        {activeTab === 'competitions' && (
          <div style={tabContent}>
            <div style={contentHeader}>
              <h2 style={contentTitle}>Voting Systems</h2>
              <button style={primaryActionBtn} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                <Plus size={18}/> NEW GRAND COMPETITION
              </button>
            </div>

            <div style={compListStack}>
              {data.competitions.map(comp => (
                <div key={comp.id} style={compContainer}>
                  <div style={compHeader}>
                    <div>
                      <h3 style={compTitle}>{comp.title}</h3>
                      <p style={compMeta}>Global Competition • {comp.contests?.length} Categories</p>
                    </div>
                    <div style={compActions}>
                      <button style={iconBtn}><Edit3 size={16}/></button>
                      <button style={iconBtnDelete}><Trash size={16}/></button>
                    </div>
                  </div>

                  <div style={contestGrid}>
                    {comp.contests?.map(ct => (
                      <div key={ct.id} style={contestCard}>
                        <div style={contestHeaderRow}>
                          <h4 style={contestTitle}>{ct.title}</h4>
                          <button style={addCandBtn} onClick={() => setShowCandidateModal(ct)}>
                            <UserPlus size={14}/>
                          </button>
                        </div>
                        <div style={candList}>
                          {ct.candidates?.map(cand => (
                            <div key={cand.id} style={candidateRow}>
                              <div style={candMain}>
                                <div style={candAvatar(cand.image_url)}></div>
                                <span style={candName}>{cand.name}</span>
                              </div>
                              <div style={candStat}>
                                <span style={voteBadge}>{cand.vote_count}</span>
                                <button style={delCand} onClick={async () => {
                                  if(confirm("Delete Candidate?")) {
                                    await supabase.from('candidates').delete().eq('id', cand.id);
                                    loadDashboardData(true);
                                  }
                                }}><X size={12}/></button>
                              </div>
                            </div>
                          ))}
                          {!ct.candidates?.length && <p style={emptyText}>No candidates registered.</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. ANALYTICS ENGINE VIEW */}
        {activeTab === 'analytics' && (
           <div style={tabContent}>
              <div style={contentHeader}>
                <h2 style={contentTitle}>Intelligence Dashboard</h2>
                <div style={realtimeSyncBadge}>
                   <Activity size={14} className="animate-pulse"/> LIVE TRAFFIC
                </div>
              </div>

              <div style={anaGrid}>
                {/* REVENUE BREAKDOWN */}
                <div style={anaCard}>
                  <div style={anaHead}><PieChart size={18}/><h3 style={anaLabel}>Revenue Attribution</h3></div>
                  <div style={anaBody}>
                    <div style={attributionRow}>
                       <span style={dotLabel('#000')}>Ticket Sales</span>
                       <span style={attrVal}>GHS {analytics.ticketRevenue.toFixed(2)}</span>
                    </div>
                    <div style={attributionRow}>
                       <span style={dotLabel('#d4af37')}>Voting Fees</span>
                       <span style={attrVal}>GHS {analytics.voteRevenue.toFixed(2)}</span>
                    </div>
                    <div style={attributionRow}>
                       <span style={dotLabel('#ef4444')}>Platform Commission (5%)</span>
                       <span style={attrVal}>- GHS {analytics.platformFee.toFixed(2)}</span>
                    </div>
                    <div style={netHero}>
                       <p style={netLabel}>NET DISBURSABLE</p>
                       <p style={netValue}>GHS {analytics.organizerNet.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* CHECK-IN PERFORMANCE */}
                <div style={anaCard}>
                   <div style={anaHead}><UserCheck size={18}/><h3 style={anaLabel}>Event Attendance</h3></div>
                   <div style={gaugeContainer}>
                      <div style={gaugeCircle}>
                        <span style={gaugeText}>{analytics.checkInRate}%</span>
                        <span style={gaugeSub}>ARRIVED</span>
                      </div>
                   </div>
                   <div style={gaugeStats}>
                      <div style={gStat}><p style={gsLab}>TOTAL ISSUED</p><p style={gsVal}>{data.tickets.length}</p></div>
                      <div style={gStat}><p style={gsLab}>TOTAL SCANNED</p><p style={gsVal}>{data.scans.length}</p></div>
                   </div>
                </div>

                {/* TOP CANDIDATES (VOTING TRACTION) */}
                <div style={{...anaCard, gridColumn: 'span 2'}}>
                   <div style={anaHead}><Trophy size={18}/><h3 style={anaLabel}>Global Competition Leaderboard</h3></div>
                   <div style={leaderboardGrid}>
                      {analytics.topCandidates.map((cand, idx) => (
                        <div key={cand.id} style={leadRow}>
                           <div style={leadRank}>{idx + 1}</div>
                           <div style={leadAvatar(cand.image_url)}></div>
                           <div style={leadInfo}>
                              <p style={leadName}>{cand.name}</p>
                              <p style={leadContest}>{cand.contest_name} • {cand.comp_name}</p>
                           </div>
                           <div style={leadVotes}>
                              <p style={lvNum}>{cand.vote_count.toLocaleString()}</p>
                              <p style={lvLab}>VOTES</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
           </div>
        )}
      </main>

      {/* --- SECTION: MODALS --- */}
      {showSettingsModal && (
        <div style={modalOverlay} onClick={() => setShowSettingsModal(false)}>
           <div style={luxuryModal} onClick={e => e.stopPropagation()}>
              <div style={modalHeaderWrap}>
                 <div style={modalIconBox}><Landmark size={24}/></div>
                 <h2 style={modalTitle}>Merchant Payout Configuration</h2>
              </div>
              <div style={modalForm}>
                 <div style={inputGroup}>
                    <label style={ilabel}>LEGAL BUSINESS NAME</label>
                    <input style={iField} value={paystackConfig.businessName} onChange={e => setPaystackConfig({...paystackConfig, businessName: e.target.value})}/>
                 </div>
                 <div style={inputGroup}>
                    <label style={ilabel}>BANKING INSTITUTION CODE</label>
                    <input style={iField} placeholder="e.g. 058 (GTBank)" value={paystackConfig.bankCode} onChange={e => setPaystackConfig({...paystackConfig, bankCode: e.target.value})}/>
                 </div>
                 <div style={inputGroup}>
                    <label style={ilabel}>SETTLEMENT ACCOUNT NUMBER</label>
                    <input style={iField} value={paystackConfig.accountNumber} onChange={e => setPaystackConfig({...paystackConfig, accountNumber: e.target.value})}/>
                 </div>
                 <div style={splitAlert}>
                    <Shield size={16} color="#d4af37"/>
                    <p>Split-Payment logic is enabled. 95% of every transaction is routed to this account after Paystack processing.</p>
                 </div>
                 <button style={savePayoutBtn(isProcessing)} onClick={handleUpdatePayouts}>
                    {isProcessing ? 'SYNCHRONIZING...' : 'SAVE CONFIGURATION'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showCandidateModal && (
        <div style={modalOverlay} onClick={() => setShowCandidateModal(null)}>
           <div style={luxuryModal} onClick={e => e.stopPropagation()}>
              <h2 style={modalTitle}>Add Candidate: {showCandidateModal.title}</h2>
              <div style={modalForm}>
                 <input style={iField} placeholder="Full Name" value={newCandidate.name} onChange={e => setNewCandidate({...newCandidate, name: e.target.value})}/>
                 <input style={iField} placeholder="Image URL (hosted image)" value={newCandidate.image_url} onChange={e => setNewCandidate({...newCandidate, image_url: e.target.value})}/>
                 <input style={iField} placeholder="Social Handle (@...)" value={newCandidate.social_handle} onChange={e => setNewCandidate({...newCandidate, social_handle: e.target.value})}/>
                 <textarea style={{...iField, height: '80px'}} placeholder="Short Bio" value={newCandidate.bio} onChange={e => setNewCandidate({...newCandidate, bio: e.target.value})}/>
                 <button style={savePayoutBtn(isProcessing)} onClick={() => addCandidate(showCandidateModal.id)}>REGISTER CANDIDATE</button>
              </div>
           </div>
        </div>
      )}

      {showQR && (
        <div style={modalOverlay} onClick={() => setShowQR(null)}>
           <div style={{...luxuryModal, textAlign: 'center'}}>
              <h2 style={modalTitle}>Event Access Gateway</h2>
              <div style={qrContainer}>
                 <QrCode size={180} strokeWidth={1}/>
              </div>
              <p style={qrHelp}>Organizers can scan this to open the public landing page or scan attendee tickets via the app.</p>
              <button style={savePayoutBtn(false)} onClick={() => setShowQR(null)}>CLOSE</button>
           </div>
        </div>
      )}
    </div>
  );
}

// --- PLATINUM STYLING (LUXURY CONSTANTS) ---
const mainWrapper = { background: '#fafafa', minHeight: '100vh', padding: '0 0 100px', fontFamily: 'Inter, sans-serif' };

// Header
const headerContainer = { height: '100px', borderBottom: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px', position: 'sticky', top: 0, zIndex: 100 };
const brandBlock = { display: 'flex', alignItems: 'center', gap: '15px' };
const logoIcon = { width: '45px', height: '45px', background: '#f0f0f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const logoText = { fontSize: '20px', fontWeight: 950, margin: 0, letterSpacing: '-1px' };
const goldText = { color: '#d4af37' };
const statusRow = { display: 'flex', alignItems: 'center', gap: '6px' };
const pulseDot = { width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 10px #16a34a' };
const systemStatus = { fontSize: '9px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' };

const navActions = { display: 'flex', alignItems: 'center', gap: '12px' };
const profileBrief = { textAlign: 'right', marginRight: '10px' };
const userName = { fontSize: '13px', fontWeight: 800, margin: 0 };
const userRole = { fontSize: '10px', color: '#94a3b8', margin: 0, fontWeight: 600 };
const settingsToggle = { padding: '10px', background: 'none', border: 'none', cursor: 'pointer' };
const refreshBtn = (r) => ({ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', border: '1px solid #eee', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const logoutBtn = { width: '40px', height: '40px', borderRadius: '50%', background: '#000', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

// Finance Hero
const financialHero = { padding: '40px 60px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' };
const mainWalletCard = { background: '#000', borderRadius: '32px', padding: '40px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const walletTop = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const labelGroup = { display: 'flex', flexDirection: 'column' };
const heroLabel = { fontSize: '11px', fontWeight: 900, color: '#64748b', letterSpacing: '1.5px' };
const heroAmount = { fontSize: '52px', fontWeight: 950, margin: '15px 0', letterSpacing: '-2.5px' };
const platformBadge = { background: 'rgba(212,175,55,0.1)', color: '#d4af37', padding: '6px 12px', borderRadius: '8px', fontSize: '9px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' };
const walletBottom = { display: 'flex', alignItems: 'center', gap: '25px', marginTop: '30px', borderTop: '1px solid #1f1f1f', paddingTop: '30px' };
const subStat = { display: 'flex', flexDirection: 'column', gap: '5px' };
const subStatLabel = { fontSize: '9px', fontWeight: 800, color: '#64748b' };
const subStatVal = { fontSize: '16px', fontWeight: 900 };
const subStatDivider = { width: '1px', height: '30px', background: '#1f1f1f' };
const withdrawBtn = { marginLeft: 'auto', background: '#fff', color: '#000', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 900, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };

const metricsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const metricCard = { background: '#fff', border: '1px solid #eee', borderRadius: '24px', padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const metricHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const metricIcon = (blue) => ({ width: '45px', height: '45px', borderRadius: '14px', background: blue ? '#f0f7ff' : '#fef2f2', color: blue ? '#0ea5e9' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const metricTrend = { fontSize: '11px', fontWeight: 900, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' };
const metricBody = { marginTop: '20px' };
const metricValue = { fontSize: '36px', fontWeight: 950, margin: 0, letterSpacing: '-1.5px' };
const metricName = { fontSize: '12px', fontWeight: 700, color: '#94a3b8', margin: '5px 0 0' };

// Tab Nav
const tabNavigation = { padding: '0 60px', display: 'flex', gap: '40px', borderBottom: '1px solid #eee' };
const tabButtonStyle = (a) => ({ padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 900, color: a ? '#000' : '#94a3b8', borderBottom: a ? '3px solid #000' : '3px solid transparent', letterSpacing: '1px' });

// Content Area
const viewContainer = { padding: '40px 60px' };
const tabContent = { animation: 'fadeIn 0.6s ease' };
const contentHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' };
const contentTitle = { fontSize: '24px', fontWeight: 950, margin: 0, letterSpacing: '-0.5px' };
const primaryActionBtn = { background: '#000', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '14px', fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' };

// Events
const eventGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '30px' };
const luxuryEventCard = { background: '#fff', border: '1px solid #eee', borderRadius: '28px', overflow: 'hidden' };
const eventImageWrap = (url) => ({ height: '220px', background: url ? `url(${url}) center/cover` : '#f8f8f8', position: 'relative' });
const imgOverlay = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.6))', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const badgeList = { display: 'flex', gap: '8px' };
const statusPill = (on) => ({ background: '#fff', color: '#16a34a', padding: '5px 10px', borderRadius: '8px', fontSize: '9px', fontWeight: 950 });
const tierCountPill = { background: 'rgba(0,0,0,0.4)', color: '#fff', padding: '5px 10px', borderRadius: '8px', fontSize: '9px', fontWeight: 950, backdropFilter: 'blur(4px)' };
const quickActions = { display: 'flex', gap: '8px', justifyContent: 'flex-end' };
const iconAction = { width: '36px', height: '36px', borderRadius: '10px', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const deleteAction = { ...iconAction, background: '#fee2e2', color: '#ef4444' };
const eventBody = { padding: '25px' };
const eventTitle = { fontSize: '18px', fontWeight: 900, margin: '0 0 8px' };
const eventVenue = { fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' };
const eventTiers = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '25px', borderTop: '1px solid #f8f8f8', paddingTop: '15px' };
const tierRowCompact = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 };
const tierVal = { color: '#000', fontWeight: 900 };
const manageBtn = { width: '100%', padding: '14px', borderRadius: '12px', background: '#fafafa', border: '1px solid #eee', fontSize: '11px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };

// Ledger Table
const tableContainer = { background: '#fff', border: '1px solid #eee', borderRadius: '28px', overflow: 'hidden' };
const platinumTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '20px 25px', background: '#fcfcfc', color: '#94a3b8', fontSize: '10px', fontWeight: 900, letterSpacing: '1px', borderBottom: '1px solid #eee' };
const trStyle = { borderBottom: '1px solid #f8f8f8' };
const tdStyle = { padding: '20px 25px', fontSize: '13px', color: '#000' };
const tdNet = { ...tdStyle, fontWeight: 950, color: '#16a34a' };
const guestInfo = { display: 'flex', flexDirection: 'column', gap: '3px' };
const guestName = { fontWeight: 800 };
const guestRef = { fontSize: '10px', color: '#94a3b8' };
const tierName = { fontWeight: 700 };
const eventNameSmall = { fontSize: '10px', color: '#0ea5e9', fontWeight: 600 };
const pillScanned = { background: '#f1f5f9', color: '#94a3b8', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };
const pillValid = { background: '#f0fdf4', color: '#16a34a', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };

// Tools
const ledgerTools = { display: 'flex', gap: '15px' };
const searchBar = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #eee', borderRadius: '14px', padding: '0 15px', width: '300px' };
const searchInput = { border: 'none', padding: '12px', outline: 'none', fontSize: '13px', fontWeight: 600, width: '100%' };
const filterSelect = { padding: '0 15px', borderRadius: '14px', border: '1px solid #eee', background: '#fff', fontSize: '12px', fontWeight: 700 };
const downloadReportBtn = { background: '#f1f5f9', border: 'none', padding: '12px 20px', borderRadius: '14px', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' };

// Competitions
const compContainer = { background: '#fff', border: '1px solid #eee', borderRadius: '32px', padding: '35px', marginBottom: '35px' };
const compHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '1px solid #f8f8f8', paddingBottom: '25px' };
const compTitle = { fontSize: '22px', fontWeight: 950, margin: 0 };
const compMeta = { fontSize: '12px', color: '#94a3b8', margin: '5px 0 0', fontWeight: 600 };
const compActions = { display: 'flex', gap: '10px' };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' };
const contestCard = { background: '#fafafa', border: '1px solid #eee', borderRadius: '22px', padding: '20px' };
const contestHeaderRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const contestTitle = { margin: 0, fontSize: '15px', fontWeight: 900 };
const addCandBtn = { width: '32px', height: '32px', borderRadius: '8px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const candList = { display: 'flex', flexDirection: 'column', gap: '10px' };
const candidateRow = { background: '#fff', border: '1px solid #f1f5f9', padding: '12px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const candMain = { display: 'flex', alignItems: 'center', gap: '12px' };
const candAvatar = (u) => ({ width: '32px', height: '32px', borderRadius: '8px', background: u ? `url(${u}) center/cover` : '#eee' });
const candName = { fontSize: '13px', fontWeight: 750 };
const candStat = { display: 'flex', alignItems: 'center', gap: '10px' };
const voteBadge = { background: '#f8fafc', color: '#0ea5e9', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 900 };
const delCand = { background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' };
const emptyText = { fontSize: '11px', color: '#94a3b8', textAlign: 'center', margin: '10px 0' };

// Analytics
const anaGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' };
const anaCard = { background: '#fff', border: '1px solid #eee', borderRadius: '32px', padding: '35px' };
const anaHead = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' };
const anaLabel = { fontSize: '16px', fontWeight: 900, margin: 0 };
const anaBody = { display: 'flex', flexDirection: 'column', gap: '15px' };
const attributionRow = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 };
const dotLabel = (c) => ({ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b' });
const attrVal = { color: '#000', fontWeight: 900 };
const netHero = { marginTop: '20px', padding: '25px', background: '#f0fdf4', borderRadius: '20px', textAlign: 'center' };
const netLabel = { fontSize: '10px', fontWeight: 900, color: '#16a34a', letterSpacing: '1px', marginBottom: '5px' };
const netValue = { fontSize: '32px', fontWeight: 950, color: '#000', margin: 0 };
const gaugeContainer = { height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const gaugeCircle = { width: '130px', height: '130px', borderRadius: '50%', border: '10px solid #0ea5e9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const gaugeText = { fontSize: '28px', fontWeight: 950 };
const gaugeSub = { fontSize: '9px', fontWeight: 800, color: '#94a3b8' };
const gaugeStats = { display: 'flex', justifyContent: 'space-around', marginTop: '20px' };
const gStat = { textAlign: 'center' };
const gsLab = { fontSize: '9px', fontWeight: 900, color: '#94a3b8' };
const gsVal = { fontSize: '18px', fontWeight: 950, margin: '5px 0' };
const leaderboardGrid = { display: 'flex', flexDirection: 'column', gap: '15px' };
const leadRow = { background: '#fcfcfc', padding: '15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '15px' };
const leadRank = { fontSize: '20px', fontWeight: 950, color: '#eee', width: '30px' };
const leadAvatar = (u) => ({ width: '50px', height: '50px', borderRadius: '15px', background: u ? `url(${u}) center/cover` : '#eee' });
const leadInfo = { flex: 1 };
const leadName = { margin: 0, fontSize: '15px', fontWeight: 900 };
const leadContest = { margin: '3px 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: 600 };
const leadVotes = { textAlign: 'right' };
const lvNum = { margin: 0, fontSize: '18px', fontWeight: 950, color: '#0ea5e9' };
const lvLab = { margin: 0, fontSize: '9px', fontWeight: 800, color: '#94a3b8' };

// Skeletons
const skeletonWrapper = { padding: '60px' };
const skeletonHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '40px' };
const skeletonGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' };
const skeletonList = { display: 'flex', flexDirection: 'column', gap: '20px' };
const shimmerBox = (w, h) => ({ width: w, height: h, background: '#eee', borderRadius: '20px', animation: 'pulse 1.5s infinite' });

// Modals
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const luxuryModal = { background: '#fff', width: '450px', borderRadius: '35px', padding: '50px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.4)' };
const modalHeaderWrap = { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px', textAlign: 'center' };
const modalIconBox = { width: '60px', height: '60px', borderRadius: '20px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px' };
const modalTitle = { fontSize: '22px', fontWeight: 950, margin: 0 };
const modalForm = { display: 'flex', flexDirection: 'column', gap: '20px' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '8px' };
const ilabel = { fontSize: '9px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const iField = { padding: '16px', borderRadius: '14px', border: '1px solid #eee', background: '#fcfcfc', outline: 'none', fontWeight: 700, fontSize: '14px' };
const splitAlert = { background: '#fffbeb', border: '1px solid #fef3c7', padding: '15px', borderRadius: '15px', display: 'flex', gap: '10px', fontSize: '11px', color: '#92400e', fontWeight: 600 };
const savePayoutBtn = (p) => ({ background: '#000', color: '#fff', border: 'none', padding: '18px', borderRadius: '16px', fontWeight: 900, fontSize: '13px', cursor: p ? 'wait' : 'pointer' });
const qrContainer = { margin: '40px auto', width: '220px', height: '220px', background: '#fff', border: '1px solid #eee', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const qrHelp = { fontSize: '12px', color: '#94a3b8', fontWeight: 600, padding: '0 20px', marginBottom: '30px' };
const realtimeSyncBadge = { background: '#f0fdf4', color: '#16a34a', padding: '8px 15px', borderRadius: '10px', fontSize: '10px', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '8px' };
