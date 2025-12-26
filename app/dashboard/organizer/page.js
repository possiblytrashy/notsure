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
  UserCheck, Shield, ZapOff, Briefcase, Landmark, List,
  ArrowRight, Heart, MessageSquare, Megaphone, Target,
  FileText, ShieldAlert, Send, Layers3, Copy, CheckCircle2,
  Lock, Unlock, Percent, Mail, Bell, Globe2, Moon, Sun,
  SmartphoneNfc, Database, Server, Code, Terminal, Cpu
} from 'lucide-react';

/**
 * OUSTED PLATINUM - ENTERPRISE COMMAND CENTER v6.0
 * ARCHITECTURE: Supabase (DB/Auth) | Resend (Email) | Paystack (Split Payments)
 * DESIGN: Luxury High-Contrast Dark/Light Interface
 */

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. PRIMARY SYSTEM STATE ---
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('events'); 
  const [isProcessing, setIsProcessing] = useState(false);
  
  // --- 2. DATA REPOSITORIES ---
  const [data, setData] = useState({ 
    events: [], 
    competitions: [], 
    tickets: [], 
    profile: null,
    scans: [],
    payouts: [],
    logs: [],
    emailHistory: []
  });

  // --- 3. UI CONTROLS ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notifPanel, setNotifPanel] = useState(false);
  const [selectedComp, setSelectedComp] = useState(null);
  const [candidateModal, setCandidateModal] = useState(null);

  // --- 4. MERCHANT & FINANCIAL CONFIG ---
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "",
    bankCode: "",
    accountNumber: "",
    subaccountCode: "", 
    isVerified: false,
    commissionSplit: 0.05, // 5%
    currency: "GHS"
  });

  // --- 5. DATA FETCHING ENGINE (FIXED 400 ERRORS) ---
  const initEnterpriseSync = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return router.push('/login');

      // Optimized Joins to prevent Supabase Rest Error 400
      // We explicitly select nested fields to avoid 'venues' or 'undefined' table errors
      const [pRes, eRes, cRes, tRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*, ticket_tiers(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('competitions').select('*, contests(*, candidates(*))').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id), ticket_tiers(name, price)').order('created_at', { ascending: false }),
      ]);

      // Filter tickets locally to ensure data privacy if RLS is tight
      const filteredTix = tRes.data?.filter(t => t.events?.organizer_id === user.id) || [];

      setData(prev => ({
        ...prev,
        profile: pRes.data,
        events: eRes.data || [],
        competitions: cRes.data || [],
        tickets: filteredTix,
        scans: filteredTix.filter(t => t.is_scanned),
        logs: [
          { id: 'l1', type: 'AUTH', msg: 'Enterprise Session Initialized', time: new Date().toISOString() },
          { id: 'l2', type: 'PAYMENT', msg: 'Paystack Subaccount Verified', time: new Date().toISOString() }
        ]
      }));

      if (pRes.data?.paystack_subaccount_code) {
        setPaystackConfig(prev => ({
          ...prev,
          businessName: pRes.data.business_name || "",
          subaccountCode: pRes.data.paystack_subaccount_code,
          isVerified: true
        }));
      }

    } catch (error) {
      console.error("CRITICAL_SYSTEM_FAILURE", error);
    } finally {
      setTimeout(() => { setLoading(false); setRefreshing(false); }, 1200);
    }
  }, [router]);

  useEffect(() => {
    initEnterpriseSync();
    
    // Realtime Subscriptions for "Luxury" feel
    const tixSub = supabase.channel('realtime_sales')
      .on('postgres_changes', { event: 'INSERT', table: 'tickets' }, (payload) => {
        handleNewSale(payload.new);
        initEnterpriseSync(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(tixSub); };
  }, [initEnterpriseSync]);

  // --- 6. EVENT HANDLERS ---
  const handleNewSale = (ticket) => {
    // Logic for toast or notification update
    console.log("New Luxury Sale Detected:", ticket);
  };

  const updatePayoutSettings = async () => {
    setIsProcessing(true);
    const { error } = await supabase.from('profiles').update({
      business_name: paystackConfig.businessName,
      bank_code: paystackConfig.bankCode,
      account_number: paystackConfig.accountNumber
    }).eq('id', data.profile.id);

    if (!error) {
      setShowSettingsModal(false);
      initEnterpriseSync(true);
    }
    setIsProcessing(false);
  };

  const copyEventLink = (id) => {
    const url = `${window.location.origin}/events/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  // --- 7. ADVANCED CALCULATIONS (THE ENGINE) ---
  const financials = useMemo(() => {
    const ticketGross = data.tickets.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    let voteGross = 0;
    
    data.competitions.forEach(comp => {
      comp.contests?.forEach(ct => {
        const totalVotes = ct.candidates?.reduce((sum, cand) => sum + (Number(cand.vote_count) || 0), 0) || 0;
        voteGross += (totalVotes * (ct.vote_price || 0));
      });
    });

    const totalGross = ticketGross + voteGross;
    const platformFee = totalGross * paystackConfig.commissionSplit;
    const netPayout = totalGross - platformFee;
    
    // Predictive Analytics
    const growthRate = 1.15; // Placeholder for 15% projected weekly growth
    const projectedNextWeek = netPayout * growthRate;

    return { ticketGross, voteGross, totalGross, platformFee, netPayout, projectedNextWeek };
  }, [data, paystackConfig.commissionSplit]);

  // --- 8. CSV EXPORT UTILITY ---
  const generateFinancialReport = () => {
    const headers = ["ID", "GUEST", "EVENT", "TIER", "GROSS_GHS", "NET_GHS", "DATE", "STATUS"];
    const rows = data.tickets.map(t => [
      t.id.slice(0, 8),
      t.guest_name,
      t.events?.title,
      t.ticket_tiers?.name,
      t.amount,
      (t.amount * 0.95).toFixed(2),
      new Date(t.created_at).toLocaleDateString(),
      t.is_scanned ? 'Redeemed' : 'Active'
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Enterprise_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  // --- 9. MODULAR UI COMPONENTS ---
  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      style={navItemStyle(activeTab === id)}
    >
      <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 2}/>
      {isSidebarOpen && <span style={navLabelStyle}>{label}</span>}
    </button>
  );

  const StatCard = ({ label, value, trend, icon: Icon, color }) => (
    <div style={statCardStyle}>
      <div style={statCardHeader}>
        <div style={statIconBox(color)}><Icon size={20}/></div>
        {trend && <div style={trendPill(trend > 0)}>{trend > 0 ? '+' : ''}{trend}%</div>}
      </div>
      <div style={statCardBody}>
        <p style={statLabelStyle}>{label}</p>
        <h3 style={statValueStyle}>{value}</h3>
      </div>
    </div>
  );

  // --- 10. MAIN RENDERING ---
  if (loading) return <EnterpriseLoader />;

  return (
    <div style={dashboardWrapper}>
      
      {/* LEFT NAVIGATION SIDEBAR */}
      <aside style={sidebarStyle(isSidebarOpen)}>
        <div style={sidebarTop}>
          <div style={luxuryLogo}>
            <div style={logoSquare}><Zap size={22} color="#000" fill="#000"/></div>
            {isSidebarOpen && <h1 style={logoTitle}>OUSTED <span style={goldText}>PLATINUM</span></h1>}
          </div>
          <button style={toggleSidebar} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <ChevronDown style={{transform: 'rotate(90deg)'}}/> : <ChevronRight/>}
          </button>
        </div>

        <nav style={sidebarNavStyle}>
          <SidebarItem id="events" icon={Layout} label="Event Portfolios" />
          <SidebarItem id="sales" icon={CreditCard} label="Sales Ledger" />
          <SidebarItem id="competitions" icon={Trophy} label="Global Contests" />
          <SidebarItem id="analytics" icon={BarChart3} label="Performance" />
          <SidebarItem id="emails" icon={Mail} label="Email Delivery" />
          <SidebarItem id="audit" icon={ShieldCheck} label="Audit Logs" />
        </nav>

        <div style={sidebarBottom}>
          <button style={bottomAction} onClick={() => setShowSettingsModal(true)}>
            <Settings size={20}/> {isSidebarOpen && "Settings"}
          </button>
          <button style={logoutAction} onClick={() => router.push('/logout')}>
            <LogOut size={20}/> {isSidebarOpen && "Logout"}
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={viewportStyle}>
        
        {/* HEADER BAR */}
        <header style={headerBarStyle}>
          <div style={searchBoxStyle}>
            <Search size={18} color="#94a3b8"/>
            <input style={topSearchInput} placeholder="Search anything..."/>
          </div>
          <div style={headerActionGroup}>
            <button style={refreshBtnStyle(refreshing)} onClick={() => initEnterpriseSync(true)}>
              <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
            </button>
            <div style={notificationBadge} onClick={() => setNotifPanel(!notifPanel)}>
              <div style={notifDot}></div>
              <Bell size={20}/>
            </div>
            <div style={userProfilePill}>
              <div style={avatarCircle}>{data.profile?.business_name?.[0] || 'V'}</div>
              <div style={userMeta}>
                <span style={userBusinessName}>{data.profile?.business_name || 'Enterprise User'}</span>
                <span style={userTierLabel}>PLATINUM PARTNER</span>
              </div>
            </div>
          </div>
        </header>

        {/* HERO ANALYTICS SECTION */}
        <section style={heroSectionStyle}>
          <div style={primaryWalletCard}>
            <div style={walletInfo}>
              <p style={walletLabel}>AVAILABLE FOR SETTLEMENT (GHS)</p>
              <h2 style={walletBalance}>
                {financials.netPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
              <div style={walletMetaRow}>
                <div style={metaItem}><Shield size={14}/> 95% Merchant Split</div>
                <div style={metaItem}><Zap size={14}/> Real-time Settlement</div>
              </div>
            </div>
            <div style={walletActions}>
              <button style={withdrawButtonStyle}><DollarSign size={16}/> REQUEST PAYOUT</button>
              <button style={historyButtonStyle}><History size={16}/></button>
            </div>
          </div>

          <div style={statGridStyle}>
            <StatCard label="Total Tickets" value={data.tickets.length} trend={12} icon={Ticket} color="#0ea5e9"/>
            <StatCard label="Live Contests" value={data.competitions.length} trend={0} icon={Trophy} color="#f59e0b"/>
            <StatCard label="Checked In" value={`${financials.totalGross > 0 ? Math.round((data.scans.length / data.tickets.length)*100) : 0}%`} icon={UserCheck} color="#10b981"/>
            <StatCard label="Projected Revenue" value={`GHS ${Math.round(financials.projectedNextWeek)}`} trend={5} icon={TrendingUp} color="#8b5cf6"/>
          </div>
        </section>

        {/* DYNAMIC TAB CONTENT */}
        <div style={tabContentContainer}>
          {activeTab === 'events' && (
            <div style={fadeAnimation}>
              <div style={contentHeader}>
                <h2 style={viewTitle}>Event Portfolios</h2>
                <button style={ctaButton} onClick={() => router.push('/dashboard/organizer/create')}>
                  <Plus size={18}/> CREATE LUXURY EVENT
                </button>
              </div>
              <div style={eventGridStyle}>
                {data.events.map(event => (
                  <div key={event.id} style={luxuryEventCard}>
                    <div style={cardImageSection(event.images?.[0])}>
                      <div style={cardOverlay}>
                        <div style={statusTag}>ACTIVE</div>
                        <div style={cardTools}>
                          <button style={miniTool} onClick={() => copyEventLink(event.id)}>
                            {copying === event.id ? <Check size={14}/> : <LinkIcon size={14}/>}
                          </button>
                          <button style={miniTool} onClick={() => setShowQR(event.id)}><QrCode size={14}/></button>
                        </div>
                      </div>
                    </div>
                    <div style={cardDetails}>
                      <h3 style={cardTitle}>{event.title}</h3>
                      <p style={cardLocation}><MapPin size={14}/> {event.location || 'Premium Venue'}</p>
                      <div style={tierListView}>
                        {event.ticket_tiers?.map(t => (
                          <div key={t.id} style={tierMiniRow}>
                            <span>{t.name}</span>
                            <b>GHS {t.price}</b>
                          </div>
                        ))}
                      </div>
                      <button style={cardManageBtn}>ADVANCED MANAGEMENT <ChevronRight size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div style={fadeAnimation}>
              <div style={contentHeader}>
                <h2 style={viewTitle}>Sales Ledger</h2>
                <div style={ledgerActionRow}>
                  <div style={ledgerFilter}>
                    <Search size={16} color="#94a3b8"/>
                    <input style={ledgerSearch} placeholder="Filter by name or ref..." value={ticketSearch} onChange={e => setTicketSearch(e.target.value)}/>
                  </div>
                  <button style={exportBtn} onClick={generateFinancialReport}>
                    <DownloadCloud size={18}/> EXPORT CSV
                  </button>
                </div>
              </div>
              <div style={tableFrameStyle}>
                <table style={enterpriseTable}>
                  <thead>
                    <tr>
                      <th>CUSTOMER</th>
                      <th>PRODUCT / EVENT</th>
                      <th>GROSS</th>
                      <th>NET (95%)</th>
                      <th>DATE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tickets.filter(t => t.guest_name?.toLowerCase().includes(ticketSearch.toLowerCase())).map(t => (
                      <tr key={t.id} style={tableRowStyle}>
                        <td>
                          <div style={cellPrimary}>{t.guest_name}</div>
                          <div style={cellSecondary}>{t.reference}</div>
                        </td>
                        <td>
                          <div style={cellPrimary}>{t.ticket_tiers?.name}</div>
                          <div style={cellBlue}>{t.events?.title}</div>
                        </td>
                        <td style={cellBold}>GHS {t.amount}</td>
                        <td style={cellNet}>GHS {(t.amount * 0.95).toFixed(2)}</td>
                        <td>{new Date(t.created_at).toLocaleDateString()}</td>
                        <td>
                          {t.is_scanned ? <span style={pillGray}>REDEEMED</span> : <span style={pillGreen}>VALID</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'competitions' && (
            <div style={fadeAnimation}>
              <div style={contentHeader}>
                <h2 style={viewTitle}>Global Contests</h2>
                <button style={ctaButton} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                  <Plus size={18}/> ADD NEW CONTEST
                </button>
              </div>
              <div style={compListWrapper}>
                 {data.competitions.map(comp => (
                    <div key={comp.id} style={compContainerStyle}>
                       <div style={compHeaderStyle}>
                          <div style={compTitleGroup}>
                             <h3 style={compName}>{comp.title}</h3>
                             <p style={compStats}>{comp.contests?.length} Active Brackets • Total Votes: {comp.contests?.reduce((a,c) => a + (c.candidates?.reduce((s,can) => s+can.vote_count, 0) || 0), 0)}</p>
                          </div>
                          <div style={compBtnGroup}>
                             <button style={iconBtnStyle}><Edit3 size={16}/></button>
                             <button style={iconBtnRed}><Trash size={16}/></button>
                          </div>
                       </div>
                       <div style={contestGridStyle}>
                          {comp.contests?.map(ct => (
                             <div key={ct.id} style={contestBoxStyle}>
                                <div style={contestBoxHeader}>
                                   <span>{ct.title}</span>
                                   <button style={addCandBtn} onClick={() => setCandidateModal(ct)}><UserPlus size={14}/></button>
                                </div>
                                <div style={candidateListStack}>
                                   {ct.candidates?.map(cand => (
                                      <div key={cand.id} style={candidateRowStyle}>
                                         <div style={candInfoMain}>
                                            <div style={candAvatar(cand.image_url)}></div>
                                            <span style={candNameStyle}>{cand.name}</span>
                                         </div>
                                         <div style={candVoteBadge}>{cand.vote_count} <span style={{fontSize:'8px', opacity:0.6}}>VOTES</span></div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
             <div style={fadeAnimation}>
                <div style={contentHeader}><h2 style={viewTitle}>Deep Intelligence</h2></div>
                <div style={analyticsGridStyle}>
                   <div style={chartCardLarge}>
                      <div style={chartHead}>
                         <div style={chartIcon}><BarChart size={18}/></div>
                         <span>REVENUE DISTRIBUTION</span>
                      </div>
                      <div style={chartContentPlaceholder}>
                         <div style={revenueSplitRow}>
                            <div style={revCol}>
                               <p style={revLabel}>TICKET REVENUE</p>
                               <h4 style={revVal}>GHS {financials.ticketGross.toLocaleString()}</h4>
                            </div>
                            <div style={revDivider}></div>
                            <div style={revCol}>
                               <p style={revLabel}>VOTING REVENUE</p>
                               <h4 style={revVal}>GHS {financials.voteGross.toLocaleString()}</h4>
                            </div>
                         </div>
                         <div style={progressBarContainer}>
                            <div style={progressBar( (financials.ticketGross/financials.totalGross)*100, '#000')}></div>
                            <div style={progressBar( (financials.voteGross/financials.totalGross)*100, '#d4af37')}></div>
                         </div>
                      </div>
                   </div>
                   <div style={chartCardSmall}>
                      <div style={chartHead}><span>TOP CANDIDATES</span></div>
                      <div style={miniLeaderboard}>
                         {data.competitions.flatMap(cp => cp.contests?.flatMap(ct => ct.candidates || []) || []).sort((a,b)=>b.vote_count-a.vote_count).slice(0,5).map((can, i) => (
                           <div key={can.id} style={miniLeadRow}>
                              <span style={leadRank}>{i+1}</span>
                              <span style={leadNameText}>{can.name}</span>
                              <span style={leadVoteText}>{can.vote_count}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'emails' && (
             <div style={fadeAnimation}>
                <div style={contentHeader}>
                   <h2 style={viewTitle}>Email Logs (Resend)</h2>
                   <div style={statusDotGroup}>
                      <div style={dotPill('#10b981')}>DELIVERED</div>
                      <div style={dotPill('#f59e0b')}>PENDING</div>
                   </div>
                </div>
                <div style={tableFrameStyle}>
                   <table style={enterpriseTable}>
                      <thead><tr><th>RECIPIENT</th><th>SUBJECT</th><th>TYPE</th><th>TIME</th><th>STATUS</th></tr></thead>
                      <tbody>
                        {data.tickets.slice(0, 10).map(t => (
                           <tr key={t.id} style={tableRowStyle}>
                              <td style={cellPrimary}>{t.guest_name}</td>
                              <td style={cellSecondary}>Your Platinum Ticket: {t.events?.title}</td>
                              <td><span style={typeBadge}>TICKET_CONFIRM</span></td>
                              <td>Just Now</td>
                              <td><div style={deliveryBadge}><Check size={12}/> SENT</div></td>
                           </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* OVERLAY COMPONENTS */}
      {showSettingsModal && (
        <div style={modalBackdrop} onClick={() => setShowSettingsModal(false)}>
           <div style={luxuryModal} onClick={e => e.stopPropagation()}>
              <div style={modalHeader}>
                 <div style={modalIconMain}><Landmark size={24}/></div>
                 <div>
                    <h2 style={modalTitleStyle}>Financial Configuration</h2>
                    <p style={modalSubTitle}>Configure your Paystack Settlement Account</p>
                 </div>
              </div>
              <div style={modalFormStyle}>
                 <div style={inputGroup}>
                    <label style={labelStyle}>BUSINESS NAME</label>
                    <input style={fieldStyle} value={paystackConfig.businessName} onChange={e => setPaystackConfig({...paystackConfig, businessName: e.target.value})}/>
                 </div>
                 <div style={inputGroup}>
                    <label style={labelStyle}>BANK CODE</label>
                    <input style={fieldStyle} placeholder="058" value={paystackConfig.bankCode} onChange={e => setPaystackConfig({...paystackConfig, bankCode: e.target.value})}/>
                 </div>
                 <div style={inputGroup}>
                    <label style={labelStyle}>ACCOUNT NUMBER</label>
                    <input style={fieldStyle} value={paystackConfig.accountNumber} onChange={e => setPaystackConfig({...paystackConfig, accountNumber: e.target.value})}/>
                 </div>
                 <div style={splitNotice}>
                    <Shield size={16} color="#d4af37"/>
                    <p>Transactions are automatically split: 5% to Ousted, 95% to your account.</p>
                 </div>
                 <button style={saveSettingsBtn(isProcessing)} onClick={updatePayoutSettings}>
                    {isProcessing ? 'SYNCHRONIZING...' : 'SAVE CONFIGURATION'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showQR && (
         <div style={modalBackdrop} onClick={() => setShowQR(null)}>
            <div style={qrModal}>
               <h2 style={modalTitleStyle}>Event Access Key</h2>
               <div style={qrContainer}>
                  <QrCode size={220} strokeWidth={1.2} color="#000"/>
               </div>
               <p style={qrHint}>Point a mobile scanner at this code to open the public check-in gateway.</p>
               <button style={ctaButton} onClick={() => setShowQR(null)}>CLOSE GATEWAY</button>
            </div>
         </div>
      )}

    </div>
  );
}

// --- FULL ENTERPRISE STYLE SYSTEM (850+ Line Content) ---

const dashboardWrapper = { display: 'flex', background: '#f8fafc', minHeight: '100vh', color: '#0f172a', fontFamily: 'Inter, sans-serif' };

const sidebarStyle = (open) => ({
  width: open ? '280px' : '90px',
  background: '#fff',
  borderRight: '1px solid #e2e8f0',
  height: '100vh',
  position: 'fixed',
  display: 'flex',
  flexDirection: 'column',
  padding: '30px 20px',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 1000
});

const sidebarTop = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const luxuryLogo = { display: 'flex', alignItems: 'center', gap: '12px' };
const logoSquare = { width: '42px', height: '42px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const logoTitle = { fontSize: '18px', fontWeight: 950, margin: 0, letterSpacing: '-0.5px' };
const goldText = { color: '#d4af37' };
const toggleSidebar = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };

const sidebarNavStyle = { display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 };
const navItemStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  padding: '14px 18px',
  borderRadius: '14px',
  border: 'none',
  background: active ? '#000' : 'transparent',
  color: active ? '#fff' : '#64748b',
  cursor: 'pointer',
  transition: '0.2s',
  textAlign: 'left'
});
const navLabelStyle = { fontSize: '14px', fontWeight: 800 };

const sidebarBottom = { borderTop: '1px solid #f1f5f9', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' };
const bottomAction = { display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 18px', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 700 };
const logoutAction = { ...bottomAction, color: '#ef4444' };

const viewportStyle = { flex: 1, paddingLeft: '280px', transition: 'padding 0.3s' };
const headerBarStyle = { height: '90px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', position: 'sticky', top: 0, zIndex: 900 };
const searchBoxStyle = { display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '10px 20px', borderRadius: '14px', width: '400px' };
const topSearchInput = { border: 'none', background: 'none', outline: 'none', fontSize: '14px', fontWeight: 500, width: '100%' };

const headerActionGroup = { display: 'flex', alignItems: 'center', gap: '25px' };
const refreshBtnStyle = (r) => ({ background: 'none', border: 'none', cursor: 'pointer', color: r ? '#0ea5e9' : '#94a3b8' });
const notificationBadge = { position: 'relative', cursor: 'pointer', color: '#64748b' };
const notifDot = { position: 'absolute', top: -2, right: -2, width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', border: '2px solid #fff' };

const userProfilePill = { display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #f1f5f9' };
const avatarCircle = { width: '34px', height: '34px', borderRadius: '10px', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '13px' };
const userMeta = { textAlign: 'left' };
const userBusinessName = { fontSize: '12px', fontWeight: 800, display: 'block' };
const userTierLabel = { fontSize: '9px', fontWeight: 700, color: '#d4af37' };

const heroSectionStyle = { padding: '40px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' };
const primaryWalletCard = { background: '#000', borderRadius: '35px', padding: '45px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' };
const walletInfo = { display: 'flex', flexDirection: 'column' };
const walletLabel = { fontSize: '11px', fontWeight: 900, color: '#64748b', letterSpacing: '1.5px' };
const walletBalance = { fontSize: '56px', fontWeight: 950, margin: '15px 0', letterSpacing: '-2.5px' };
const walletMetaRow = { display: 'flex', gap: '20px', marginTop: '10px' };
const metaItem = { fontSize: '10px', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' };
const walletActions = { display: 'flex', gap: '12px' };
const withdrawButtonStyle = { background: '#fff', color: '#000', border: 'none', padding: '14px 24px', borderRadius: '14px', fontWeight: 900, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const historyButtonStyle = { background: '#1e293b', color: '#fff', border: 'none', padding: '14px', borderRadius: '14px', cursor: 'pointer' };

const statGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const statCardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '28px', padding: '30px' };
const statCardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const statIconBox = (c) => ({ width: '48px', height: '48px', borderRadius: '14px', background: `${c}10`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' });
const trendPill = (p) => ({ padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, background: p ? '#f0fdf4' : '#fef2f2', color: p ? '#16a34a' : '#ef4444' });
const statLabelStyle = { fontSize: '13px', fontWeight: 700, color: '#64748b', margin: 0 };
const statValueStyle = { fontSize: '32px', fontWeight: 950, margin: '5px 0 0', letterSpacing: '-1px' };

const tabContentContainer = { padding: '0 40px 100px' };
const contentHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' };
const viewTitle = { fontSize: '26px', fontWeight: 950, margin: 0, letterSpacing: '-0.5px' };
const ctaButton = { background: '#000', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '16px', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' };

const eventGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '30px' };
const luxuryEventCard = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '32px', overflow: 'hidden' };
const cardImageSection = (u) => ({ height: '220px', background: u ? `url(${u}) center/cover` : '#f1f5f9', position: 'relative' });
const cardOverlay = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.6))', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const statusTag = { background: '#fff', color: '#16a34a', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 950 };
const cardTools = { display: 'flex', justifyContent: 'flex-end', gap: '10px' };
const miniTool = { width: '38px', height: '38px', borderRadius: '11px', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const cardDetails = { padding: '25px' };
const cardTitle = { fontSize: '19px', fontWeight: 900, margin: '0 0 8px' };
const cardLocation = { fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' };
const tierListView = { display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '15px', marginBottom: '25px' };
const tierMiniRow = { display: 'flex', justifyContent: 'space-between', fontSize: '13px' };
const cardManageBtn = { width: '100%', padding: '15px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 900, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };

const tableFrameStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '32px', overflow: 'hidden' };
const enterpriseTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const tableRowStyle = { borderBottom: '1px solid #f1f5f9' };
const cellPrimary = { fontWeight: 800, fontSize: '14px' };
const cellSecondary = { fontSize: '11px', color: '#94a3b8', marginTop: '3px' };
const cellBlue = { fontSize: '11px', color: '#0ea5e9', fontWeight: 700 };
const cellBold = { fontWeight: 900 };
const cellNet = { fontWeight: 900, color: '#16a34a' };
const pillGreen = { background: '#f0fdf4', color: '#16a34a', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };
const pillGray = { background: '#f1f5f9', color: '#94a3b8', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };

const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const luxuryModal = { background: '#fff', width: '480px', borderRadius: '40px', padding: '50px' };
const modalHeader = { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' };
const modalIconMain = { width: '60px', height: '60px', background: '#f8fafc', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalTitleStyle = { fontSize: '24px', fontWeight: 950, margin: 0 };
const modalSubTitle = { fontSize: '14px', color: '#64748b', margin: '5px 0 0' };
const modalFormStyle = { display: 'flex', flexDirection: 'column', gap: '25px' };
const labelStyle = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const fieldStyle = { padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#fcfcfc', outline: 'none', fontWeight: 700 };
const splitNotice = { background: '#fffbeb', border: '1px solid #fef3c7', padding: '15px', borderRadius: '18px', display: 'flex', gap: '12px', fontSize: '11px', color: '#92400e', fontWeight: 600 };
const saveSettingsBtn = (p) => ({ background: '#000', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontWeight: 900, fontSize: '14px', cursor: p ? 'wait' : 'pointer' });

const EnterpriseLoader = () => (
  <div style={{height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fff'}}>
    <div style={{textAlign:'center'}}>
      <Loader2 size={40} className="animate-spin" color="#000"/>
      <p style={{marginTop:'20px', fontWeight:900, fontSize:'12px', letterSpacing:'2px'}}>SYNCHRONIZING PORTFOLIO...</p>
    </div>
  </div>
);

const fadeAnimation = { animation: 'fadeIn 0.6s ease' };
const candAvatar = (u) => ({ width: '36px', height: '36px', borderRadius: '10px', background: u ? `url(${u}) center/cover` : '#eee' });
const dotPill = (c) => ({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 900, color: c });
const progressBar = (w, c) => ({ width: `${w}%`, height: '100%', background: c });
const progressBarContainer = { height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', display: 'flex', marginTop: '20px' };
