"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  BarChart, PieChart, CreditCard, Layout, Trash
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE STATE ---
  const [activeTab, setActiveTab] = useState('events'); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    competitions: [], 
    tickets: [], 
    profile: null 
  });

  // --- 2. UI & MODAL STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  const [showCandidateModal, setShowCandidateModal] = useState(null); 
  
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "",
    bankCode: "",
    accountNumber: "",
    subaccountCode: "", 
    isVerified: false
  });

  const [newCandidate, setNewCandidate] = useState({ name: '', image_url: '' });

  // --- 3. DATA ENGINE (MULTI-LEVEL FETCH) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Parallel Fetch with explicit joins for the Nested Model
      const [profileRes, eventsRes, compsRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('competitions').select(`
            *,
            contests (
              *,
              candidates (*)
            )
        `).eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false }),
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      setData({
        events: eventsRes.data || [],
        competitions: compsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileRes.data }
      });

      if (profileRes.data?.paystack_subaccount_code) {
        setPaystackConfig({
          businessName: profileRes.data.business_name || "",
          bankCode: profileRes.data.bank_code || "",
          accountNumber: profileRes.data.account_number || "",
          subaccountCode: profileRes.data.paystack_subaccount_code,
          isVerified: true
        });
      }
    } catch (err) {
      console.error("Dashboard Engine Failure:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- 4. DELETION HANDLERS (CASCADE SIMULATION) ---
  const handleDeleteCandidate = async (candId) => {
    if (!confirm("Are you sure you want to remove this contestant?")) return;
    const { error } = await supabase.from('candidates').delete().eq('id', candId);
    if (!error) loadDashboardData(true);
  };

  const handleDeleteContest = async (contestId) => {
    if (!confirm("Delete this category? All contestants within it will be removed.")) return;
    const { error } = await supabase.from('contests').delete().eq('id', contestId);
    if (!error) loadDashboardData(true);
  };

  const handleDeleteCompetition = async (compId) => {
    if (!confirm("CRITICAL: Delete entire Grand Competition? This removes all categories and data.")) return;
    const { error } = await supabase.from('competitions').delete().eq('id', compId);
    if (!error) loadDashboardData(true);
  };

  // --- 5. ANALYTICS ENGINE (CALCULATED) ---
  const stats = useMemo(() => {
    const ticketGross = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    // Aggregating Nested Voting Revenue
    let totalVotes = 0;
    let voteGross = 0;
    const compPerformance = data.competitions.map(comp => {
        let compVotes = 0;
        let compRev = 0;
        comp.contests?.forEach(ct => {
            const ctVotes = ct.candidates?.reduce((s, c) => s + (parseInt(c.vote_count) || 0), 0) || 0;
            compVotes += ctVotes;
            compRev += (ctVotes * (ct.vote_price || 0));
        });
        totalVotes += compVotes;
        voteGross += compRev;
        return { id: comp.id, title: comp.title, votes: compVotes, revenue: compRev };
    });

    const totalGross = ticketGross + voteGross;
    const scannedCount = data.tickets.filter(t => t.is_scanned).length;
    
    return {
      totalGross,
      organizerShare: totalGross * 0.95,
      platformFee: totalGross * 0.05,
      ticketCount: data.tickets.length,
      voteCount: totalVotes,
      voteRevenue: voteGross,
      ticketRevenue: ticketGross,
      compPerformance,
      checkInRate: data.tickets.length ? Math.round((scannedCount / data.tickets.length) * 100) : 0
    };
  }, [data]);

  // --- 6. VIEWPORT COMPONENTS ---
  
  if (loading) return (
    <div style={fullPageCenter}>
      <Loader2 className="animate-spin" size={32} color="#000"/>
      <p style={loadingText}>SYNCING LUXURY ASSETS...</p>
    </div>
  );

  return (
    <div style={mainWrapper}>
      {/* HEADER SECTION */}
      <div style={topNav}>
        <div>
          <h1 style={logoText}>OUSTED <span style={badgeLuxury}>PLATINUM</span></h1>
          <p style={subLabel}>Consolidated Organizer Hub v2.5</p>
        </div>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <div style={onboardingBadge(paystackConfig.subaccountCode)}>
               <div style={dot(paystackConfig.subaccountCode)}></div>
               {paystackConfig.subaccountCode ? 'SPLITS ACTIVE' : 'PAYOUTS PENDING'}
             </div>
           </div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           <button style={logoutCircle} onClick={handleLogout}>
             <LogOut size={18}/>
           </button>
        </div>
      </div>

      {/* FINANCE HERO */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <div style={balanceInfo}>
              <p style={financeLabel}>NET SETTLEMENT (95%)</p>
              <h2 style={balanceValue}>GHS {stats.organizerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div style={iconCircleGold}><Sparkles size={24} color="#d4af37"/></div>
          </div>
          <div style={statsRow}>
            <div style={miniStat}><ArrowUpRight size={14}/> <span>Tickets: GHS {stats.ticketRevenue.toFixed(2)}</span></div>
            <div style={miniStat} style={{color: '#0ea5e9'}}><Zap size={14}/> <span>Votes: GHS {stats.voteRevenue.toFixed(2)}</span></div>
          </div>
          <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
            <Wallet size={16}/> SETTINGS & BANK SETUP
          </button>
        </div>

        <div style={quickStatsGrid}>
          <div style={glassStatCard}>
            <p style={statLabel}>TICKETS ISSUED</p>
            <h3 style={statVal}>{stats.ticketCount}</h3>
            <div style={statProgress}><div style={statBar(stats.checkInRate, '#0ea5e9')}></div></div>
          </div>
          <div style={glassStatCard}>
            <p style={statLabel}>TOTAL VOTES CAST</p>
            <h3 style={statVal}>{stats.voteCount.toLocaleString()}</h3>
            <div style={statProgress}><div style={statBar(100, '#8b5cf6')}></div></div>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <div style={tabBar}>
        {['events', 'sales', 'competitions', 'analytics'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabItem(activeTab === tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={viewPort}>
        
        {/* --- 1. EVENTS VIEW --- */}
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Event Portfolio</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={18}/> NEW EVENT
              </button>
            </div>
            <div style={cardGrid}>
              {data.events.map(event => (
                <div key={event.id} style={itemCard}>
                  <div style={itemImage(event.images?.[0])}>
                    <div style={imageOverlay}>
                      <div style={cardQuickActions}>
                        <button style={miniAction} onClick={() => copyLink('events', event.id)}>
                          <LinkIcon size={14}/>
                        </button>
                        <button style={deleteAction} onClick={async () => {
                            if(confirm("Delete Event?")) await supabase.from('events').delete().eq('id', event.id);
                            loadDashboardData(true);
                        }}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={itemBody}>
                    <h3 style={itemTitle}>{event.title}</h3>
                    <p style={metaLine}><MapPin size={14}/> {event.location}</p>
                    <button style={fullWidthBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                        VIEW SALES
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 2. SALES LEDGER --- */}
        {activeTab === 'sales' && (
          <div style={fadeAnim}>
             <div style={viewHeader}>
              <h2 style={viewTitle}>Transaction Ledger</h2>
              <div style={filterGroup}>
                <div style={searchBox}>
                  <Search size={18} color="#94a3b8"/>
                  <input style={searchInputField} placeholder="Ref or Guest..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}/>
                </div>
              </div>
            </div>
            <div style={tableWrapper}>
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableTh}>GUEST / REF</th>
                    <th style={tableTh}>EVENT</th>
                    <th style={tableTh}>GROSS</th>
                    <th style={tableTh}>NET (95%)</th>
                    <th style={tableTh}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => (
                    <tr key={t.id} style={tableTr}>
                      <td style={tableTd}>
                        <p style={guestBold}>{t.guest_name}</p>
                        <p style={guestMuted}>{t.reference}</p>
                      </td>
                      <td style={tableTd}>{t.events?.title}</td>
                      <td style={tableTd}>GHS {t.amount}</td>
                      <td style={tableTd} style={{fontWeight: 900, color: '#16a34a'}}>GHS {(t.amount * 0.95).toFixed(2)}</td>
                      <td style={tableTd}>{t.is_scanned ? <span style={scannedPill}>USED</span> : <span style={activePill}>VALID</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- 3. DETAILED COMPETITION MANAGEMENT --- */}
        {activeTab === 'competitions' && (
          <div style={fadeAnim}>
             <div style={viewHeader}>
                <h2 style={viewTitle}>Competition Hierarchy</h2>
                <button style={addBtn} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                  <Plus size={18}/> CREATE GRAND COMPETITION
                </button>
             </div>
             
             <div style={compListStack}>
                {data.competitions.map(comp => (
                  <div key={comp.id} style={grandCompCard}>
                     <div style={grandHeader}>
                        <div>
                           <h3 style={grandTitle}>{comp.title}</h3>
                           <p style={grandSub}>Grand Competition • {comp.contests?.length || 0} Categories</p>
                        </div>
                        <div style={actionRow}>
                           <button style={deleteTextBtn} onClick={() => handleDeleteCompetition(comp.id)}>
                              <Trash size={16}/> DELETE GRAND COMPETITION
                           </button>
                        </div>
                     </div>

                     <div style={nestedContestGrid}>
                        {comp.contests?.map(ct => (
                          <div key={ct.id} style={contestContainer}>
                             <div style={contestHead}>
                                <div>
                                   <h4 style={contestTitle}>{ct.title}</h4>
                                   <p style={contestPrice}>GHS {ct.vote_price} per vote</p>
                                </div>
                                <div style={miniActionGroup}>
                                   <button style={iconBtn} onClick={() => setShowCandidateModal(ct)}><UserPlus size={16}/></button>
                                   <button style={iconBtnDelete} onClick={() => handleDeleteContest(ct.id)}><Trash2 size={16}/></button>
                                </div>
                             </div>

                             <div style={candidateTable}>
                                {ct.candidates?.length > 0 ? ct.candidates.map(cand => (
                                  <div key={cand.id} style={candRow}>
                                     <div style={candMain}>
                                        <div style={candAvatar(cand.image_url)}></div>
                                        <span style={candNameText}>{cand.name}</span>
                                     </div>
                                     <div style={candStats}>
                                        <span style={voteBadge}>{cand.vote_count} Votes</span>
                                        <button style={candDelete} onClick={() => handleDeleteCandidate(cand.id)}><X size={14}/></button>
                                     </div>
                                  </div>
                                )) : <p style={emptyText}>No contestants yet.</p>}
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
                ))}
                {data.competitions.length === 0 && <div style={emptyState}>No Grand Competitions active.</div>}
             </div>
          </div>
        )}

        {/* --- 4. ANALYTICS ENGINE --- */}
        {activeTab === 'analytics' && (
          <div style={fadeAnim}>
             <div style={viewHeader}>
                <h2 style={viewTitle}>Revenue Intelligence</h2>
                <div style={liveBadge}><Activity size={14}/> LIVE DATA</div>
             </div>
             
             <div style={analyticsGrid}>
                {/* Voting Analytics */}
                <div style={analyticsCard}>
                   <div style={anaHeader}>
                      <Trophy size={20} color="#d4af37"/>
                      <h3 style={anaTitle}>Voting Performance</h3>
                   </div>
                   <div style={anaBody}>
                      {stats.compPerformance.map(cp => (
                        <div key={cp.id} style={anaRow}>
                           <div style={anaInfo}>
                              <p style={anaName}>{cp.title}</p>
                              <p style={anaMeta}>{cp.votes} Votes</p>
                           </div>
                           <p style={anaVal}>GHS {cp.revenue.toFixed(2)}</p>
                        </div>
                      ))}
                      {stats.compPerformance.length === 0 && <p style={emptyText}>Waiting for voting data...</p>}
                   </div>
                </div>

                {/* Event Analytics */}
                <div style={analyticsCard}>
                   <div style={anaHeader}>
                      <Ticket size={20} color="#0ea5e9"/>
                      <h3 style={anaTitle}>Ticket Sales Performance</h3>
                   </div>
                   <div style={anaBody}>
                      {data.events.map(ev => {
                         const evSales = data.tickets.filter(t => t.event_id === ev.id);
                         const evRev = evSales.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
                         return (
                            <div key={ev.id} style={anaRow}>
                               <div style={anaInfo}>
                                  <p style={anaName}>{ev.title}</p>
                                  <p style={anaMeta}>{evSales.length} Sold</p>
                               </div>
                               <p style={anaVal}>GHS {evRev.toFixed(2)}</p>
                            </div>
                         );
                      })}
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {showCandidateModal && (
        <div style={overlay} onClick={() => setShowCandidateModal(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>New Contestant</h2>
              <button style={closeBtn} onClick={() => setShowCandidateModal(null)}><X size={20}/></button>
            </div>
            <div style={modalBody}>
               <div style={inputStack}>
                  <label style={fieldLabel}>CANDIDATE NAME</label>
                  <input style={modalInput} value={newCandidate.name} onChange={(e) => setNewCandidate({...newCandidate, name: e.target.value})} placeholder="e.g. John Doe"/>
               </div>
               <div style={inputStack}>
                  <label style={fieldLabel}>IMAGE URL (SQUARE PREFERRED)</label>
                  <input style={modalInput} value={newCandidate.image_url} onChange={(e) => setNewCandidate({...newCandidate, image_url: e.target.value})} placeholder="https://..."/>
               </div>
               <button style={actionSubmitBtn(isProcessing)} onClick={() => addCandidate(showCandidateModal.id)} disabled={isProcessing}>
                  {isProcessing ? 'REGISTERING...' : 'ADD TO CATEGORY'}
               </button>
            </div>
          </div>
        </div>
      )}


      {/* MODALS SECTION */}



      {/* 1. SETTINGS MODAL (Onboarding) */}

      {showSettingsModal && (

        <div style={overlay} onClick={() => setShowSettingsModal(false)}>

          <div style={modal} onClick={e => e.stopPropagation()}>

            <div style={modalHead}>

              <h2 style={modalTitle}>Payout Config</h2>

              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20}/></button>

            </div>

            <div style={onboardingPromo}>

              <CreditCard size={20} color="#0ea5e9"/>

              <p style={{margin:0, fontSize: '13px'}}>Ensure bank details match your Paystack dashboard for 95% automated settlement.</p>

            </div>

            <div style={modalBody}>

              <div style={inputStack}>

                <label style={fieldLabel}>BUSINESS LEGAL NAME</label>

                <input style={modalInput} value={paystackConfig.businessName} onChange={(e) => setPaystackConfig({...paystackConfig, businessName: e.target.value})} placeholder="e.g. Ousted Events Ltd"/>

              </div>

              <div style={inputStack}>

                <label style={fieldLabel}>SETTLEMENT DESTINATION</label>

                <select style={modalInput} value={paystackConfig.bankCode} onChange={(e) => setPaystackConfig({...paystackConfig, bankCode: e.target.value})}>

                  <option value="">Select Network</option>

                  <option value="MTN">MTN Mobile Money</option>

                  <option value="VOD">Telecel (Vodafone) Cash</option>

                  <option value="058">GT Bank</option>

                  <option value="044">Access Bank</option>

                </select>

              </div>

              <div style={inputStack}>

                <label style={fieldLabel}>ACCOUNT / WALLET NUMBER</label>

                <input style={modalInput} value={paystackConfig.accountNumber} onChange={(e) => setPaystackConfig({...paystackConfig, accountNumber: e.target.value})} placeholder="055XXXXXXX"/>

              </div>

              <button style={actionSubmitBtn(isProcessing)} onClick={saveOnboardingDetails} disabled={isProcessing}>

                {isProcessing ? 'UPDATING...' : 'CONFIRM SETTINGS'}

              </button>

            </div>

          </div>

        </div>

      )}



      {/* 2. ADD CANDIDATE MODAL */}

      {showCandidateModal && (

        <div style={overlay} onClick={() => setShowCandidateModal(null)}>

          <div style={modal} onClick={e => e.stopPropagation()}>

            <div style={modalHead}>

              <h2 style={modalTitle}>Add Candidate</h2>

              <button style={closeBtn} onClick={() => setShowCandidateModal(null)}><X size={20}/></button>

            </div>

            <p style={{fontSize: '13px', color: '#64748b', marginBottom: '20px'}}>Adding to: <strong>{showCandidateModal.title}</strong></p>

            <div style={modalBody}>

               <div style={inputStack}>

                  <label style={fieldLabel}>FULL NAME</label>

                  <input style={modalInput} value={newCandidate.name} onChange={(e) => setNewCandidate({...newCandidate, name: e.target.value})} placeholder="Candidate Name"/>

               </div>

               <div style={inputStack}>

                  <label style={fieldLabel}>IMAGE URL (OPTIONAL)</label>

                  <input style={modalInput} value={newCandidate.image_url} onChange={(e) => setNewCandidate({...newCandidate, image_url: e.target.value})} placeholder="https://..."/>

               </div>

               <button style={actionSubmitBtn(isProcessing)} onClick={() => addCandidate(showCandidateModal.id)} disabled={isProcessing}>

                  {isProcessing ? 'ADDING...' : 'ADD TO CONTEST'}

               </button>

            </div>

          </div>

        </div>

      )}



      {/* 3. QR PREVIEW MODAL */}

      {showQR && (

        <div style={overlay} onClick={() => setShowQR(null)}>

          <div style={modal} onClick={e => e.stopPropagation()}>

            <div style={modalHead}>

               <h2 style={modalTitle}>Portal QR</h2>

               <button style={closeBtn} onClick={() => setShowQR(null)}><X size={20}/></button>

            </div>

            <div style={{display: 'flex', justifyContent: 'center', padding: '20px'}}>

              <img src={showQR} alt="QR Code" style={{width: '250px', height: '250px', borderRadius: '20px'}} />

            </div>

            <p style={{textAlign: 'center', fontSize: '12px', color: '#64748b'}}>Scan this to open the event portal.</p>

          </div>

        </div>

      )}

    
    </div>
  );
}

// --- TRIPLE CHECKED LUXURY STYLES ---
const mainWrapper = { padding: '40px', maxWidth: '1400px', margin: '0 auto', background: '#fcfcfc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' };
const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const loadingText = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '2px', marginTop: '15px' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const logoText = { fontSize: '28px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const badgeLuxury = { background: '#000', color: '#fff', fontSize: '9px', padding: '4px 10px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '10px', fontWeight: 900 };
const subLabel = { fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 600 };
const headerActions = { display: 'flex', gap: '15px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '13px', fontWeight: 700 };
const onboardingBadge = (on) => ({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 900, color: on ? '#16a34a' : '#ef4444', marginTop: '4px' });
const dot = (on) => ({ width: '5px', height: '5px', borderRadius: '50%', background: on ? '#16a34a' : '#ef4444' });
const circleAction = { width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const logoutCircle = { width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const financeGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px', marginBottom: '40px' };
const balanceCard = { background: '#000', borderRadius: '24px', padding: '40px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const cardHeader = { display: 'flex', justifyContent: 'space-between' };
const balanceInfo = { display: 'flex', flexDirection: 'column' };
const financeLabel = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' };
const balanceValue = { fontSize: '48px', fontWeight: 950, margin: '15px 0', letterSpacing: '-2px' };
const iconCircleGold = { width: '50px', height: '50px', borderRadius: '15px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statsRow = { display: 'flex', gap: '20px', marginBottom: '25px' };
const miniStat = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#16a34a' };
const settingsIconBtn = { padding: '12px 20px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '11px', alignSelf: 'flex-start' };
const quickStatsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const glassStatCard = { background: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' };
const statLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', marginBottom: '8px' };
const statVal = { fontSize: '32px', fontWeight: 950, margin: 0 };
const statProgress = { height: '4px', background: '#f1f5f9', borderRadius: '10px', marginTop: '15px', overflow: 'hidden' };
const statBar = (w, c) => ({ width: `${w}%`, height: '100%', background: c });

const tabBar = { display: 'flex', gap: '30px', borderBottom: '1px solid #eee', marginBottom: '40px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '12px', fontWeight: 900, cursor: 'pointer', borderBottom: active ? '3px solid #000' : '3px solid transparent' });
const viewPort = { minHeight: '500px' };
const fadeAnim = { animation: 'fadeIn 0.4s ease' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const viewTitle = { margin: 0, fontSize: '22px', fontWeight: 950 };
const addBtn = { background: '#000', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' };

const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' };
const itemCard = { background: '#fff', borderRadius: '20px', border: '1px solid #f0f0f0', overflow: 'hidden' };
const itemImage = (url) => ({ height: '200px', background: url ? `url(${url}) center/cover` : '#f8f8f8', position: 'relative' });
const imageOverlay = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.5))' };
const cardQuickActions = { position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' };
const miniAction = { width: '36px', height: '36px', borderRadius: '10px', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const deleteAction = { width: '36px', height: '36px', borderRadius: '10px', background: '#fee2e2', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const itemBody = { padding: '20px' };
const itemTitle = { margin: '0 0 10px', fontSize: '16px', fontWeight: 900 };
const metaLine = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', marginBottom: '15px' };
const fullWidthBtn = { width: '100%', background: '#f1f5f9', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800, fontSize: '11px', cursor: 'pointer' };

const tableWrapper = { background: '#fff', borderRadius: '20px', border: '1px solid #f0f0f0', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const tableTh = { padding: '15px 20px', background: '#f8fafc', fontSize: '10px', fontWeight: 900, color: '#94a3b8' };
const tableTr = { borderBottom: '1px solid #f1f5f9' };
const tableTd = { padding: '15px 20px', fontSize: '13px' };
const guestBold = { margin: 0, fontWeight: 800 };
const guestMuted = { margin: 0, fontSize: '11px', color: '#94a3b8' };
const scannedPill = { background: '#f1f5f9', color: '#94a3b8', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 };
const activePill = { background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 };

const compListStack = { display: 'flex', flexDirection: 'column', gap: '30px' };
const grandCompCard = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', padding: '30px' };
const grandHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', borderBottom: '1px solid #f8f8f8', paddingBottom: '20px' };
const grandTitle = { margin: 0, fontSize: '20px', fontWeight: 900 };
const grandSub = { margin: '5px 0 0', fontSize: '12px', color: '#94a3b8', fontWeight: 600 };
const deleteTextBtn = { background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };
const nestedContestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' };
const contestContainer = { background: '#fcfcfc', border: '1px solid #f1f5f9', borderRadius: '18px', padding: '20px' };
const contestHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const contestTitle = { margin: 0, fontSize: '14px', fontWeight: 900 };
const contestPrice = { margin: '2px 0 0', fontSize: '11px', color: '#0ea5e9', fontWeight: 700 };
const miniActionGroup = { display: 'flex', gap: '8px' };
const iconBtn = { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconBtnDelete = { width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const candidateTable = { display: 'flex', flexDirection: 'column', gap: '10px' };
const candRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px' };
const candMain = { display: 'flex', alignItems: 'center', gap: '10px' };
const candAvatar = (url) => ({ width: '30px', height: '30px', borderRadius: '8px', background: url ? `url(${url}) center/cover` : '#eee' });
const candNameText = { fontSize: '13px', fontWeight: 700 };
const candStats = { display: 'flex', alignItems: 'center', gap: '10px' };
const voteBadge = { background: '#f8fafc', color: '#000', fontSize: '10px', fontWeight: 900, padding: '4px 8px', borderRadius: '6px' };
const candDelete = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const emptyText = { fontSize: '11px', color: '#94a3b8', textAlign: 'center', margin: '20px 0' };

const analyticsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' };
const analyticsCard = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', padding: '30px' };
const anaHeader = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' };
const anaTitle = { margin: 0, fontSize: '16px', fontWeight: 900 };
const anaBody = { display: 'flex', flexDirection: 'column', gap: '15px' };
const anaRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: '#fcfcfc', borderRadius: '16px' };
const anaInfo = { display: 'flex', flexDirection: 'column' };
const anaName = { margin: 0, fontSize: '13px', fontWeight: 800 };
const anaMeta = { margin: '2px 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: 600 };
const anaVal = { margin: 0, fontSize: '14px', fontWeight: 950, color: '#16a34a' };
const liveBadge = { background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' };

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', width: '400px', borderRadius: '30px', padding: '40px' };
const modalHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const modalTitle = { margin: 0, fontSize: '20px', fontWeight: 950 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const modalBody = { display: 'flex', flexDirection: 'column', gap: '20px' };
const inputStack = { display: 'flex', flexDirection: 'column', gap: '8px' };
const fieldLabel = { fontSize: '9px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const modalInput = { padding: '14px', borderRadius: '12px', border: '1px solid #eee', fontSize: '14px', outline: 'none', fontWeight: 600 };
const actionSubmitBtn = (p) => ({ padding: '16px', background: '#000', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: p ? 'not-allowed' : 'pointer', fontSize: '13px' });
const emptyState = { padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '24px', border: '1px dashed #eee', color: '#94a3b8', fontWeight: 600 };
