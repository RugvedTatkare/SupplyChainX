import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Boxes, ChevronDown,
  CircleHelp, Clock3, Download, Factory, LayoutDashboard, Menu, PackageCheck,
  Search, Settings2, ShieldAlert, Truck, X,
} from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type Metric = { label: string; value: number | string; detail?: string };
type OverviewResponse = Metric[];
type DashboardResponse = {
  data_status: 'connected' | 'not_configured' | 'error';
  data_message: string;
  kpis: {
    total_orders: number;
    supplier_risk_index: number;
    supplier_count: number;
    high_risk_suppliers: number;
    shipment_on_time_rate: number | null;
    total_shipments: number;
    delayed_shipments: number;
    high_risk_inventory_items: number;
    inventory_snapshot_rows: number;
    inventory_snapshot_date: string | null;
    high_critical_risk_events: number;
  };
  trend: { month: string; shipments: number; on_time_rate: number; delayed: number }[];
  suppliers: { supplier_id: string; supplier_name: string; late_delivery_rate: number; risk_score: number; risk_level: string; data_origin: string; synthetic_scenario: string | null }[];
  risk_signals: { risk_event_id: string; entity_type: string; entity_id: string; risk_type: string; risk_score: number; risk_level: string; explanation: string; event_date: string; data_origin: string }[];
  provenance: Record<string, string>;
};

const fallbackTrend = [
  { month: 'Jan', onTime: 88, delayed: 12 },
  { month: 'Feb', onTime: 91, delayed: 9 },
  { month: 'Mar', onTime: 85, delayed: 15 },
  { month: 'Apr', onTime: 89, delayed: 11 },
  { month: 'May', onTime: 93, delayed: 7 },
  { month: 'Jun', onTime: 90, delayed: 10 },
];

const suppliers = [
  { id: 'SUP-001', name: 'Northstar Components', category: 'Electronics', shipments: 148, delay: '18.4%', risk: 82, band: 'High', reason: 'Frequent late deliveries' },
  { id: 'SUP-014', name: 'Atlas Industrial Co.', category: 'Industrial', shipments: 126, delay: '14.2%', risk: 74, band: 'High', reason: 'Elevated delivery variance' },
  { id: 'SUP-009', name: 'Bluepeak Materials', category: 'Raw materials', shipments: 94, delay: '10.6%', risk: 61, band: 'Medium', reason: 'Moderate delay frequency' },
  { id: 'SUP-021', name: 'Evergreen Packaging', category: 'Packaging', shipments: 172, delay: '5.8%', risk: 32, band: 'Low', reason: 'Consistent historical delivery' },
  { id: 'SUP-005', name: 'Meridian Logistics', category: 'Logistics', shipments: 201, delay: '4.1%', risk: 24, band: 'Low', reason: 'Low historical delay rate' },
];

const kpis = [
  { label: 'Supplier risk index', value: '68.4', unit: '/ 100', change: '+4.8%', direction: 'up', icon: ShieldAlert, tone: 'amber', caption: 'Composite demo score' },
  { label: 'Shipment on-time rate', value: '91.2', unit: '%', change: '+2.1%', direction: 'down', icon: Truck, tone: 'mint', caption: 'Historical deliveries' },
  { label: 'Inventory exposure', value: '$284', unit: 'K', change: '+8.6%', direction: 'up', icon: Boxes, tone: 'violet', caption: 'Synthetic scenario data' },
  { label: 'Open risk signals', value: '17', unit: '', change: '5 high', direction: 'up', icon: AlertTriangle, tone: 'rose', caption: 'Illustrative rule-based flags' },
];

function App() {
  const [active, setActive] = useState('Overview');
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('All risks');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [apiMetrics, setApiMetrics] = useState<OverviewResponse>([]);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    Promise.all([
      fetch(`${apiBase}/api/overview`).then((response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json() as Promise<OverviewResponse>;
      }),
      fetch(`${apiBase}/api/dashboard`).then((response) => {
        if (!response.ok) throw new Error('Dashboard API unavailable');
        return response.json() as Promise<DashboardResponse>;
      }),
    ])
      .then(([metrics, dashboard]) => {
        setApiMetrics(metrics);
        setDashboardData(dashboard);
        setApiStatus('connected');
      })
      .catch(() => setApiStatus('offline'));
  }, []);

  const sourceSuppliers = dashboardData?.data_status === 'connected'
    ? dashboardData.suppliers.map((s) => ({
        id: s.supplier_id,
        name: s.supplier_name,
        category: s.data_origin || 'Source not specified',
        shipments: '—' as number | string,
        delay: `${s.late_delivery_rate.toFixed(1)}%`,
        risk: s.risk_score,
        band: (s.risk_level.charAt(0) + s.risk_level.slice(1).toLowerCase()) as 'High' | 'Medium' | 'Low',
        reason: s.synthetic_scenario || s.data_origin || 'Risk score from dataset',
      }))
    : suppliers;

  const visibleSuppliers = useMemo(() => sourceSuppliers.filter((supplier) => {
    const matchesQuery = `${supplier.name} ${supplier.id} ${supplier.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesRisk = riskFilter === 'All risks' || supplier.band === riskFilter;
    return matchesQuery && matchesRisk;
  }), [query, riskFilter, sourceSuppliers]);

  const sourceSignals = dashboardData?.data_status === 'connected' ? dashboardData.risk_signals : [];

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Supplier Risk', icon: Factory },
    { label: 'Shipments', icon: Truck },
    { label: 'Inventory', icon: Boxes },
    { label: 'Risk Signals', icon: Activity },
  ];

  const exportSuppliers = () => {
    const header = ['Supplier ID', 'Supplier', 'Data origin / category', 'Historical shipments', 'Historical delay rate', 'Risk score', 'Risk band', 'Explanation'];
    const rows = visibleSuppliers.map((s) => [s.id, s.name, s.category, s.shipments, s.delay, s.risk, s.band, s.reason]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supplychainx-supplier-risk.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={21} strokeWidth={2.6} /></div>
          <div><strong>SupplyChain<span>X</span></strong><small>RISK INTELLIGENCE</small></div>
          <button className="mobile-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => { setActive(label); setSidebarOpen(false); }}>
              <Icon size={18} /><span>{label}</span>{label === 'Risk Signals' && <span className="nav-count">5</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label">MANAGEMENT</div>
        <button className="nav-item" onClick={() => setActive('Reports')}><PackageCheck size={18} /><span>Reports</span></button>
        <button className="nav-item" onClick={() => setActive('Settings')}><Settings2 size={18} /><span>Settings</span></button>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={17} /></div>
            <strong>Need a hand?</strong>
            <p>Explore the project docs and API reference.</p>
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">Open API docs <span>↗</span></a>
          </div>
          <div className="profile">
            <div className="avatar">SX</div>
            <div className="profile-text"><strong>SupplyChainX Demo</strong><small>Local workspace</small></div>
            <ChevronDown size={15} className="profile-chevron" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-sep">/</span><strong>{active}</strong></div>
          <div className="topbar-right">
            <div className={`api-pill api-${apiStatus}`}><span className="status-dot" />{apiStatus === 'connected' ? 'API connected' : apiStatus === 'offline' ? 'Demo mode' : 'Connecting API'}</div>
            <button className="help-top" title="Open help" onClick={() => window.open('http://localhost:8000/docs', '_blank', 'noopener,noreferrer')}><CircleHelp size={18} /></button>
            <div className="top-avatar">RT</div>
          </div>
        </header>

        <div className="page">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> SUPPLY CHAIN OPERATIONS</div>
              <h1>{active === 'Overview' ? 'Risk overview' : active}</h1>
              <p className="page-subtitle">A clearer view of supplier health, shipment reliability, and operational exposure.</p>
            </div>
            <div className="heading-actions">
              <div className="date-chip"><Clock3 size={15} /><span>Historical demo window</span><ChevronDown size={14} /></div>
              <button className="export-button" onClick={exportSuppliers}><Download size={16} /> Export data</button>
            </div>
          </div>

          <div className="notice">
            <div className="notice-icon"><CircleHelp size={17} /></div>
            <p><strong>{dashboardData?.data_status === 'connected' ? 'Data provenance:' : 'Prototype data:'}</strong> {dashboardData?.data_status === 'connected' ? 'Dashboard metrics are calculated from the local SQLite dataset. Historical outcomes are retrospective; supplier and inventory scenario fields may be synthetic.' : 'The SQLite database is not connected. Values shown in fallback sections are illustrative and are not live predictions.'}</p>
            <button onClick={() => setActive('Reports')} aria-label="View data notes">Data notes <span>↗</span></button>
          </div>

          {active !== 'Overview' && (
            <div className="section-info">
              <div><strong>{active} workspace</strong><p>This section uses the same demonstration dataset. The detailed module is on the project roadmap.</p></div>
              <button className="subtle-button" onClick={() => setActive('Overview')}>Back to overview</button>
            </div>
          )}

          <div className="section-title-row"><div><h2>Operational snapshot</h2><p>High-level indicators from the configured dataset</p></div><span className="updated"><span className="live-dot" /> {dashboardData?.data_status === 'connected' ? 'Database metrics' : 'Sample metrics'}</span></div>
          <div className="kpi-grid">
            {(() => {
              const actual = dashboardData?.data_status === 'connected' ? dashboardData.kpis : null;
              const cards = actual ? [
                { label: 'Supplier risk index', value: actual.supplier_risk_index.toFixed(1), unit: '/ 100', icon: ShieldAlert, tone: 'amber', caption: 'Mean dataset risk score' },
                { label: 'Shipment on-time rate', value: actual.shipment_on_time_rate === null ? 'N/A' : actual.shipment_on_time_rate.toFixed(1), unit: actual.shipment_on_time_rate === null ? '' : '%', icon: Truck, tone: 'mint', caption: `${actual.total_shipments.toLocaleString()} historical shipments` },
                { label: 'High-risk inventory items', value: actual.high_risk_inventory_items.toLocaleString(), unit: '', icon: Boxes, tone: 'violet', caption: actual.inventory_snapshot_date ? `Snapshot: ${actual.inventory_snapshot_date}` : 'Latest inventory snapshot' },
                { label: 'High/critical risk events', value: actual.high_critical_risk_events.toLocaleString(), unit: '', icon: AlertTriangle, tone: 'rose', caption: 'Recorded risk events' },
              ] : kpis.map(({ label, value, unit, icon, tone, caption }) => ({ label, value, unit, icon, tone, caption }));
              return cards.map(({ label, value, unit, icon: Icon, tone, caption }) => (
                <article className="kpi-card" key={label}>
                  <div className="kpi-top"><span className={`kpi-icon icon-${tone}`}><Icon size={19} /></span><span className="change change-neutral">{actual ? 'SQLite' : 'Demo'}</span></div>
                  <div className="kpi-value">{value}<span>{unit}</span></div>
                  <div className="kpi-label">{label}</div>
                  <div className="kpi-caption">{caption}</div>
                </article>
              ));
            })()}
          </div>

          <div className="middle-grid">
            <section className="panel trend-panel">
              <div className="panel-heading"><div><h3>Delivery performance</h3><p>{dashboardData?.data_status === 'connected' ? 'Historical monthly on-time rate (%)' : 'Illustrative monthly on-time rate (%)'}</p></div><button className="icon-button" title="Chart information"><CircleHelp size={17} /></button></div>
              <div className="chart-legend"><span><i className="legend-dot ontime" />On-time deliveries</span><span><i className="legend-dot delayed" />Delayed deliveries</span></div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData?.data_status === 'connected' ? dashboardData.trend.map((row) => ({ month: row.month, onTime: row.on_time_rate, delayed: Number((100 - row.on_time_rate).toFixed(1)), shipments: row.shipments })) : fallbackTrend} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9edf3" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8993a5', fontSize: 11 }} dy={9} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#8993a5', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ border: '1px solid #e5eaf1', borderRadius: 10, boxShadow: '0 8px 25px #17243b12' }} />
                    <Line type="monotone" dataKey="onTime" name="On-time" stroke="#277c70" strokeWidth={2.7} dot={{ r: 3.5, fill: '#277c70', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="delayed" name="Delayed" stroke="#e2a05a" strokeWidth={2.3} strokeDasharray="5 5" dot={{ r: 3, fill: '#e2a05a', strokeWidth: 2, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-foot"><span>{dashboardData?.data_status === 'connected' ? 'Historical records; not a forecast' : 'Trend values are illustrative'}</span><span className="mini-status"><span className="status-dot" /> {dashboardData?.data_status === 'connected' ? 'SQLite data' : 'Demo data'}</span></div>
            </section>

            <section className="panel signals-panel">
              <div className="panel-heading"><div><h3>Priority risk signals</h3><p>Examples of explainable risk flags</p></div><button className="text-link" onClick={() => setActive('Risk Signals')}>View all <span>→</span></button></div>
              <div className="signal-list">
                {dashboardData?.data_status === 'connected' ? sourceSignals.slice(0, 4).map((signal) => {
                  const level = signal.risk_level.toLowerCase();
                  const mark = signal.entity_type === 'INVENTORY' ? 'signal-purple' : level === 'critical' || level === 'high' ? 'signal-red' : 'signal-amber';
                  return <div className="signal-item" key={signal.risk_event_id}>
                    <div className={`signal-mark ${mark}`}>{signal.entity_type === 'INVENTORY' ? <Boxes size={17} /> : <AlertTriangle size={17} />}</div>
                    <div className="signal-copy"><strong>{signal.risk_type.replaceAll('_', ' ')}</strong><p>{signal.explanation}</p><small>{signal.entity_type} · {signal.entity_id} · {signal.event_date.slice(0, 10)}</small></div>
                    <span className={`severity ${level === 'critical' || level === 'high' ? 'sev-high' : 'sev-med'}`}>{signal.risk_level}</span>
                  </div>;
                }) : <>
                  <div className="signal-item"><div className="signal-mark signal-red"><AlertTriangle size={17} /></div><div className="signal-copy"><strong>Delivery consistency</strong><p>Supplier delay rate above demo threshold</p><small>Illustrative fallback signal</small></div><span className="severity sev-high">High</span></div>
                  <div className="signal-item"><div className="signal-mark signal-amber"><Clock3 size={17} /></div><div className="signal-copy"><strong>Lead-time variability</strong><p>Observed delivery times vary materially</p><small>Illustrative fallback signal</small></div><span className="severity sev-high">High</span></div>
                </>}
              </div>
              <div className="signals-foot"><ShieldAlert size={15} /><span>{dashboardData?.data_status === 'connected' ? 'Database risk events; synthetic scenarios are labelled.' : 'Rules are illustrative, not live alerts.'}</span></div>
            </section>
          </div>

          <section className="panel supplier-panel">
            <div className="panel-heading supplier-heading"><div><h3>Supplier risk register</h3><p>{dashboardData?.data_status === 'connected' ? 'Suppliers ranked by dataset risk score' : 'Example suppliers ranked by demo risk score'}</p></div><button className="text-link" onClick={() => setActive('Supplier Risk')}>Explore suppliers <span>→</span></button></div>
            <div className="table-tools">
              <div className="search-box"><Search size={16} /><input placeholder="Search suppliers..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search suppliers" /><kbd>⌘ K</kbd></div>
              <label className="filter-select"><span>Risk level</span><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option>All risks</option><option>High</option><option>Medium</option><option>Low</option></select><ChevronDown size={13} /></label>
            </div>
            <div className="table-scroll">
              <table><thead><tr><th>SUPPLIER</th><th>CATEGORY</th><th>SHIPMENTS</th><th>DELAY RATE</th><th>RISK SCORE</th><th>RISK LEVEL</th><th /></tr></thead>
                <tbody>{visibleSuppliers.map((supplier) => <tr key={supplier.id}>
                  <td><div className="supplier-cell"><span className={`supplier-logo logo-${supplier.band.toLowerCase()}`}>{supplier.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{supplier.name}</strong><small>{supplier.id}</small></div></div></td>
                  <td><span className="category">{supplier.category}</span></td><td className="numeric">{supplier.shipments}</td><td className="numeric delay-value">{supplier.delay}</td>
                  <td><div className="score-cell"><div className="score-track"><span className={`score-fill score-${supplier.band.toLowerCase()}`} style={{ width: `${supplier.risk}%` }} /></div><strong>{supplier.risk}</strong></div></td>
                  <td><span className={`risk-badge risk-${supplier.band.toLowerCase()}`}><i />{supplier.band} risk</span></td><td><button className="row-menu" title={`Details for ${supplier.name}`} onClick={() => setActive('Supplier Risk')}>↗</button></td>
                </tr>)}</tbody>
              </table>
              {visibleSuppliers.length === 0 && <div className="empty-state">No suppliers match the current filters.</div>}
            </div>
            <div className="table-footer"><span>Showing <strong>{visibleSuppliers.length}</strong> of <strong>{sourceSuppliers.length}</strong> {dashboardData?.data_status === 'connected' ? 'database suppliers' : 'illustrative suppliers'}</span><span>{dashboardData?.data_status === 'connected' ? 'Historical / synthetic-labelled dataset' : 'Demo cohort'} <b>·</b> Scores 0–100</span></div>
          </section>

          <footer className="page-footer"><span>© 2026 SupplyChainX <span className="footer-dot">·</span> Supply chain risk intelligence</span><span>Foundation build <b>0.1.0</b> <span className="footer-dot">·</span> <a href="https://github.com/RugvedTatkare/SupplyChainX" target="_blank" rel="noreferrer">Source repository ↗</a></span></footer>
          {apiStatus === 'connected' && apiMetrics.length > 0 && <div className="api-data-note">API status payload received: {apiMetrics.map((m) => `${m.label} — ${m.value}`).join(' · ')}</div>}
        </div>
      </main>
    </div>
  );
}

export default App;
