import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Boxes, Check, ChevronDown, CircleHelp, Clock3,
  Download, Factory, LayoutDashboard, Menu, PackageCheck, Search, Settings2, Database, Upload, FileSpreadsheet,
  ShieldAlert, Truck, X,
} from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type Metric = { label: string; value: number | string; detail?: string };
type DashboardResponse = {
  data_status: 'connected' | 'not_configured' | 'error';
  data_message: string;
  kpis: {
    total_orders: number | null; supplier_risk_index: number | null; supplier_count: number | null;
    high_risk_suppliers: number | null; shipment_on_time_rate: number | null;
    total_shipments: number | null; delayed_shipments: number | null;
    high_risk_inventory_items: number | null; inventory_snapshot_rows: number | null;
    inventory_snapshot_date: string | null; high_critical_risk_events: number | null;
  };
  trend: { month: string; shipments: number; on_time_rate: number; delayed: number }[];
  suppliers: { supplier_id: string; supplier_name: string; late_delivery_rate: number | null; risk_score: number | null; risk_level: string; data_origin: string; synthetic_scenario: string | null }[];
  shipments: { shipment_id: string; order_id: string; supplier_count: number | null; warehouse_id: string | null; order_country: string | null; order_region: string | null; ship_datetime: string | null; scheduled_shipping_days: number | null; actual_shipping_days: number | null; delivery_delay_days: number | null; delivery_status: string | null; late_delivery_risk: number | null; shipping_mode: string | null; shipment_status: string | null }[];
  inventory: { inventory_snapshot_id: string; snapshot_date: string; warehouse_id: string; product_id: string; supplier_id: string | null; estimated_daily_demand: number | null; current_stock: number | null; reorder_point: number | null; days_of_cover: number | null; supplier_lead_time_days: number | null; inventory_risk_score: number | null; inventory_risk_level: string; data_origin: string; synthetic_stock_scenario: string | null; product_name: string | null }[];
  risk_signals: { risk_event_id: string; entity_type: string; entity_id: string; risk_type: string; risk_score: number; risk_level: string; explanation: string; event_date: string; data_origin: string }[];
  provenance: Record<string, string>;
  dataset_kind?: 'original' | 'imported'; dataset_id?: string; dataset_name?: string;
};
type DatasetOption = { dataset_id: string; name: string; kind: 'original' | 'imported'; row_count: number | null };
type SupportedField = Record<string, string>;
type DatasetPreview = { filename: string; columns: string[]; row_count: number; preview: Record<string, string>[]; suggested_mappings: Record<string, string>; supported_fields: SupportedField };

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Supplier Risk', icon: Factory },
  { label: 'Shipments', icon: Truck },
  { label: 'Inventory', icon: Boxes },
  { label: 'Risk Signals', icon: Activity },
  { label: 'Datasets', icon: Database },
];

const formatNumber = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString();
const bandClass = (level: string) => {
  const value = level.toLowerCase();
  return ['critical', 'high'].includes(value) ? 'high' : ['medium', 'moderate'].includes(value) ? 'medium' : ['low', 'on time', 'ontime'].includes(value) ? 'low' : 'neutral';
};

function App() {
  const [active, setActive] = useState('Overview');
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('All risks');
  const [tablePage, setTablePage] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [apiMetrics, setApiMetrics] = useState<Metric[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [selectedDataset, setSelectedDataset] = useState('original');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('supplychainx-theme') === 'dark' ? 'dark' : 'light');
  const pageSize = 50;
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => { localStorage.setItem('supplychainx-theme', theme); }, [theme]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${apiBase}/api/overview`).then((response) => { if (!response.ok) throw new Error('API unavailable'); return response.json() as Promise<Metric[]>; }),
      fetch(`${apiBase}/api/datasets`).then((response) => { if (!response.ok) throw new Error('Datasets unavailable'); return response.json() as Promise<DatasetOption[]>; }),
    ]).then(([metrics, availableDatasets]) => {
      if (cancelled) return;
      setApiMetrics(metrics); setDatasets(availableDatasets); setApiStatus('connected');
    }).catch(() => { if (!cancelled) setApiStatus('offline'); });
    return () => { cancelled = true; };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/dashboard?dataset_id=${encodeURIComponent(selectedDataset)}`)
      .then((response) => { if (!response.ok) throw new Error('Dashboard unavailable'); return response.json() as Promise<DashboardResponse>; })
      .then((dashboard) => { if (!cancelled) { setDashboardData(dashboard); setApiStatus('connected'); } })
      .catch(() => { if (!cancelled) setApiStatus('offline'); });
    return () => { cancelled = true; };
  }, [apiBase, selectedDataset]);

  useEffect(() => { setTablePage(0); }, [active, query, riskFilter]);

  const hasData = dashboardData?.data_status === 'connected';
  const isImported = dashboardData?.dataset_kind === 'imported';
  const suppliers = useMemo(() => (hasData ? dashboardData.suppliers : []).map((supplier) => ({
    id: supplier.supplier_id,
    name: supplier.supplier_name,
    category: supplier.data_origin || 'Not specified',
    delay: supplier.late_delivery_rate,
    risk: supplier.risk_score,
    band: supplier.risk_level,
    reason: supplier.synthetic_scenario || supplier.data_origin || 'Risk score from dataset',
  })), [dashboardData, hasData]);
  const visibleSuppliers = useMemo(() => suppliers.filter((supplier) => {
    const matchesQuery = `${supplier.name} ${supplier.id} ${supplier.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (riskFilter === 'All risks' || bandClass(supplier.band) === riskFilter.toLowerCase());
  }), [query, riskFilter, suppliers]);
  const shipments = hasData ? dashboardData.shipments : [];
  const inventory = hasData ? dashboardData.inventory : [];
  const signals = hasData ? dashboardData.risk_signals : [];
  const filteredShipments = shipments.filter((item) => `${item.shipment_id} ${item.order_id} ${item.warehouse_id ?? ''} ${item.order_country ?? ''} ${item.order_region ?? ''} ${item.shipping_mode ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const filteredSignals = signals.filter((item) => `${item.entity_type} ${item.entity_id} ${item.risk_type} ${item.explanation}`.toLowerCase().includes(query.toLowerCase()));
  const shipmentPageCount = Math.max(1, Math.ceil(filteredShipments.length / pageSize));
  const signalPageCount = Math.max(1, Math.ceil(filteredSignals.length / pageSize));

  const exportSuppliers = () => {
    const header = ['Supplier ID', 'Supplier', 'Data origin', 'Historical delay rate', 'Risk score', 'Risk level', 'Explanation'];
    const rows = visibleSuppliers.map((supplier) => [supplier.id, supplier.name, supplier.category, supplier.delay == null ? '' : `${supplier.delay}%`, supplier.risk ?? '', supplier.band, supplier.reason]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supplychainx-supplier-risk.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openDocs = () => window.open(`${apiBase}/docs`, '_blank', 'noopener,noreferrer');
  const readApiError = async (response: Response) => {
    try { const body = await response.json(); return typeof body.detail === 'string' ? body.detail : 'The upload could not be validated.'; }
    catch { return 'The upload could not be validated.'; }
  };
  const previewUpload = async () => {
    if (!uploadFile) return;
    setUploadBusy(true); setUploadError(''); setUploadSuccess(''); setPreview(null);
    try {
      const form = new FormData(); form.append('file', uploadFile);
      const response = await fetch(`${apiBase}/api/datasets/preview`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as DatasetPreview;
      setPreview(result); setMappings(result.suggested_mappings);
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Preview failed. Check the API connection and try again.'); }
    finally { setUploadBusy(false); }
  };
  const importUpload = async () => {
    if (!uploadFile || !preview) return;
    setUploadBusy(true); setUploadError(''); setUploadSuccess('');
    try {
      const form = new FormData(); form.append('file', uploadFile); form.append('mappings', JSON.stringify(mappings));
      const response = await fetch(`${apiBase}/api/datasets/import`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(await readApiError(response));
      const created = await response.json() as { dataset_id: string; name: string; row_count: number };
      const refreshed = await fetch(`${apiBase}/api/datasets`).then((item) => item.json() as Promise<DatasetOption[]>);
      setDatasets(refreshed); setSelectedDataset(created.dataset_id);
      setUploadSuccess(`${created.name} imported with ${formatNumber(created.row_count)} validated rows.`);
      setUploadFile(null); setPreview(null); setMappings({});
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Import failed. Check the API connection and try again.'); }
    finally { setUploadBusy(false); }
  };
  const selectUploadFile = (file?: File) => {
    setUploadFile(file ?? null); setPreview(null); setMappings({}); setUploadError(''); setUploadSuccess('');
  };
  const apiLabel = apiStatus === 'connected' ? 'API online' : apiStatus === 'offline' ? 'API unavailable' : 'Connecting';
  const dataLabel = hasData ? (dashboardData?.dataset_kind === 'imported' ? 'Imported dataset' : 'SQLite connected') : apiStatus === 'offline' ? 'API unavailable' : dashboardData?.data_status === 'error' ? 'Database error' : dashboardData?.data_status === 'not_configured' ? 'Database not configured' : 'Awaiting data';
  const setSection = (section: string) => { setActive(section); setSidebarOpen(false); };

  return (
    <div className="app-shell" data-theme={theme}>
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setSection('Overview'); }}>
          <span className="brand-mark"><Activity size={19} strokeWidth={2.4} /></span>
          <span className="brand-name">SupplyChain<span>X</span><small>OPERATIONS INTELLIGENCE</small></span>
          <button className="mobile-close" aria-label="Close navigation" onClick={(event) => { event.preventDefault(); setSidebarOpen(false); }}><X size={18} /></button>
        </a>
        <div className="workspace-select"><span className="workspace-glyph">S</span><span><small>Workspace</small><strong>Supply chain</strong></span><ChevronDown size={15} /></div>
        <div className="nav-label">Monitor</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} aria-current={active === label ? 'page' : undefined} onClick={() => setSection(label)}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Risk Signals' && <span className="nav-count">{hasData ? formatNumber(signals.length) : '—'}</span>}
          </button>)}
        </nav>
        <div className="nav-label nav-label-secondary">Manage</div>
        <button className={`nav-item ${active === 'Reports' ? 'active' : ''}`} onClick={() => setSection('Reports')}><PackageCheck size={18} strokeWidth={1.8} /><span>Reports & data</span></button>
        <button className={`nav-item ${active === 'Settings' ? 'active' : ''}`} onClick={() => setSection('Settings')}><Settings2 size={18} strokeWidth={1.8} /><span>Settings</span></button>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className={`status-indicator ${hasData ? 'is-good' : ''}`} /><span><strong>{dataLabel}</strong><small>Local data connection</small></span><button aria-label="Open API documentation" onClick={openDocs}><CircleHelp size={17} /></button></div>
          <div className="profile"><div className="avatar">SX</div><div className="profile-text"><strong>Local workspace</strong><small>SupplyChainX</small></div><ChevronDown size={15} className="profile-chevron" /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Operations</span><span className="crumb-sep">/</span><strong>{active}</strong></div>
          <div className="topbar-right"><label className="dataset-switcher"><span>Data</span><select aria-label="Select dashboard dataset" value={selectedDataset} onChange={(event) => setSelectedDataset(event.target.value)}>{datasets.map((dataset) => <option key={dataset.dataset_id} value={dataset.dataset_id}>{dataset.name}</option>)}</select></label><span className={`api-pill api-${apiStatus}`}><i />{apiLabel}</span><button className="help-top" aria-label="Open API documentation" onClick={openDocs}><CircleHelp size={18} /></button><div className="top-avatar">SX</div></div>
        </header>

        <div className="page">
          <div className="page-heading">
            <div><div className="eyebrow"><span /> Supply chain intelligence</div><h1>{active === 'Overview' ? 'Risk overview' : active}</h1><p className="page-subtitle">{active === 'Datasets' ? 'Bring your operational data into a private, local workspace.' : 'A grounded view of supplier health, delivery performance, and operational exposure.'}</p></div>
            <div className="heading-actions"><div className="date-chip"><Clock3 size={16} /><span>{hasData ? `Snapshot ${dashboardData.kpis.inventory_snapshot_date ?? 'available'}` : 'Historical data'}</span></div><button className="export-button" onClick={exportSuppliers} disabled={!hasData}><Download size={16} /> Export register</button></div>
          </div>

          <div className={`notice ${hasData ? 'notice-connected' : ''}`} role="status">
            <span className="notice-icon">{hasData ? <Check size={16} /> : <CircleHelp size={17} />}</span>
            <p><strong>{hasData ? 'Source & scope' : dataLabel}</strong><span>{hasData ? 'Metrics come from the local SQLite dataset. Shipment outcomes are historical; supplier and inventory scenarios may include synthetic fields.' : dashboardData?.data_message ?? (apiStatus === 'offline' ? `Could not reach the API at ${apiBase}. Start the FastAPI service to load database metrics. No sample values are shown.` : 'Connect the local API and SQLite database to view operational metrics. No sample values are shown.')}</span></p>
            <button onClick={() => setSection('Reports')}>Data notes <span>↗</span></button>
          </div>

          {active !== 'Overview' && <div className="section-info"><div><strong>{active} workspace</strong><p>Records from the configured dataset. Synthetic scenario fields are labelled; risk scores are prototype indicators.</p></div><button className="subtle-button" onClick={() => setSection('Overview')}>Back to overview</button></div>}

          {active === 'Supplier Risk' && <section className="panel table-panel">
            <div className="panel-heading supplier-heading"><div><h2>Supplier risk register</h2><p>{isImported ? 'Mapped supplier fields · scores are not calculated' : 'Ranked by risk score from the configured dataset'}</p></div><button className="export-button" onClick={exportSuppliers} disabled={!hasData}><Download size={16} /> Export CSV</button></div>
            <div className="table-tools"><div className="search-box"><Search size={17} /><input aria-label="Search suppliers" placeholder="Search supplier or source…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>{!isImported && <label className="filter-select"><span>Risk level</span><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option>All risks</option><option>High</option><option>Medium</option><option>Low</option></select><ChevronDown size={14} /></label>}</div>
            <div className="table-scroll"><table><thead><tr><th>SUPPLIER</th><th>DATA ORIGIN</th><th>LATE DELIVERY</th><th>RISK SCORE</th><th>RISK LEVEL</th><th>SCENARIO / NOTES</th></tr></thead><tbody>{visibleSuppliers.map((supplier) => <tr key={supplier.id}><td><div className="supplier-cell"><span className={`supplier-logo logo-${bandClass(supplier.band)}`}>{supplier.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{supplier.name}</strong><small>{supplier.id}</small></div></div></td><td><span className="category">{supplier.category}</span></td><td className="numeric">{supplier.delay == null ? '—' : `${supplier.delay.toFixed(1)}%`}</td><td><Score value={supplier.risk} level={supplier.band} /></td><td><RiskBadge level={supplier.band} /></td><td>{supplier.reason}</td></tr>)}</tbody></table>{visibleSuppliers.length === 0 && <EmptyState message={hasData ? 'No suppliers match these filters.' : 'Supplier records will appear when the database is connected.'} />}</div>
            <div className="table-footer"><span>{hasData ? `${visibleSuppliers.length} of ${suppliers.length} suppliers` : 'No supplier records loaded'}</span><span>Scores are prototype indicators, not validated standards</span></div>
          </section>}

          {active === 'Shipments' && <section className="panel table-panel">
            <div className="panel-heading supplier-heading"><div><h2>Shipment performance</h2><p>Historical shipment records from the connected database</p></div></div>
            <div className="module-kpis"><MetricCard label="Total shipments" value={hasData ? formatNumber(dashboardData.kpis.total_shipments) : '—'} detail="Historical records" icon={<Truck size={18} />} /><MetricCard label="Delayed shipments" value={hasData ? formatNumber(dashboardData.kpis.delayed_shipments) : '—'} detail="Delay greater than zero days" icon={<Clock3 size={18} />} /><MetricCard label="On-time rate" value={hasData && dashboardData.kpis.shipment_on_time_rate !== null ? `${dashboardData.kpis.shipment_on_time_rate}%` : '—'} detail="Historical outcomes, not forecasts" icon={<Check size={18} />} /></div>
            <SearchTools query={query} setQuery={setQuery} placeholder="Search shipment, order, warehouse, country…" />
            <div className="table-scroll"><table><thead><tr><th>SHIPMENT</th><th>ORDER</th><th>WAREHOUSE</th><th>COUNTRY / REGION</th><th>SHIP DATE</th><th>MODE</th><th>ACTUAL / PLAN</th><th>DELAY</th><th>STATUS</th></tr></thead><tbody>{filteredShipments.slice(tablePage * pageSize, (tablePage + 1) * pageSize).map((item) => <tr key={item.shipment_id}><td><strong>{item.shipment_id}</strong></td><td>{item.order_id}</td><td>{item.warehouse_id ?? '—'}</td><td>{[item.order_country, item.order_region].filter(Boolean).join(' / ') || '—'}</td><td>{item.ship_datetime?.slice(0, 10) ?? '—'}</td><td>{item.shipping_mode ?? '—'}</td><td className="numeric">{item.actual_shipping_days ?? '—'} / {item.scheduled_shipping_days ?? '—'} days</td><td className="numeric">{item.delivery_delay_days ?? '—'} days</td><td><RiskBadge level={item.delivery_delay_days == null ? (item.delivery_status ?? 'Outcome unavailable') : item.delivery_delay_days > 0 ? 'Delayed' : 'On time'} /></td></tr>)}</tbody></table>{filteredShipments.length === 0 && <EmptyState message={hasData ? 'No shipment records match this search.' : 'Shipment records will appear when the database is connected.'} />}</div>
            <TablePagination count={filteredShipments.length} page={tablePage} pageCount={shipmentPageCount} pageSize={pageSize} setPage={setTablePage} label="shipments" />
          </section>}

          {active === 'Inventory' && <section className="panel table-panel">
            <div className="panel-heading supplier-heading"><div><h2>Inventory risk register</h2><p>Latest snapshot · {hasData ? dashboardData.kpis.inventory_snapshot_date ?? 'Date unavailable' : 'No snapshot loaded'}</p></div></div>
            <div className="module-kpis"><MetricCard label="Snapshot rows" value={hasData ? formatNumber(dashboardData.kpis.inventory_snapshot_rows) : '—'} detail="Rows in latest snapshot" icon={<Boxes size={18} />} /><MetricCard label="High / critical risk" value={hasData ? formatNumber(dashboardData.kpis.high_risk_inventory_items) : '—'} detail="Flagged in latest snapshot" icon={<ShieldAlert size={18} />} /><MetricCard label="Records shown" value={hasData ? formatNumber(inventory.length) : '—'} detail="Highest risk first" icon={<Activity size={18} />} /></div>
            <SearchTools query={query} setQuery={setQuery} placeholder="Search product, warehouse, supplier…" />
            <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>WAREHOUSE</th><th>SUPPLIER</th><th>STOCK</th><th>REORDER POINT</th><th>DAYS COVER</th><th>DAILY DEMAND</th><th>RISK SCORE</th><th>RISK LEVEL</th></tr></thead><tbody>{inventory.filter((item) => `${item.product_name ?? ''} ${item.product_id} ${item.warehouse_id} ${item.supplier_id ?? ''} ${item.synthetic_stock_scenario ?? ''}`.toLowerCase().includes(query.toLowerCase())).map((item) => <tr key={item.inventory_snapshot_id}><td><strong>{item.product_name ?? item.product_id}</strong><small>{item.product_id}</small></td><td>{item.warehouse_id}</td><td>{item.supplier_id ?? '—'}</td><td className="numeric">{item.current_stock ?? '—'}</td><td className="numeric">{item.reorder_point ?? '—'}</td><td className="numeric">{item.days_of_cover ?? '—'}</td><td className="numeric">{item.estimated_daily_demand ?? '—'}</td><td><Score value={item.inventory_risk_score} level={item.inventory_risk_level} /></td><td><RiskBadge level={item.inventory_risk_level} /></td></tr>)}</tbody></table>{inventory.length === 0 && <EmptyState message={hasData ? 'No inventory records in the latest snapshot.' : 'Inventory records will appear when the database is connected.'} />}</div>
            <div className="table-footer"><span>{hasData ? `Showing ${inventory.length} highest-risk records` : 'No inventory records loaded'}</span><span>Snapshot data, not live inventory</span></div>
          </section>}

          {active === 'Risk Signals' && <section className="panel table-panel">
            <div className="panel-heading supplier-heading"><div><h2>Risk event register</h2><p>Database events ordered by severity</p></div></div>
            <SearchTools query={query} setQuery={setQuery} placeholder="Search entity, risk type, explanation…" />
            <div className="table-scroll"><table><thead><tr><th>SEVERITY</th><th>ENTITY</th><th>ENTITY ID</th><th>RISK TYPE</th><th>SCORE</th><th>EXPLANATION</th><th>EVENT DATE</th><th>ORIGIN</th></tr></thead><tbody>{filteredSignals.slice(tablePage * pageSize, (tablePage + 1) * pageSize).map((signal) => <tr key={signal.risk_event_id}><td><RiskBadge level={signal.risk_level} /></td><td>{signal.entity_type}</td><td>{signal.entity_id}</td><td>{signal.risk_type.replaceAll('_', ' ')}</td><td className="numeric">{signal.risk_score.toFixed(1)}</td><td>{signal.explanation}</td><td>{signal.event_date.slice(0, 10)}</td><td>{signal.data_origin}</td></tr>)}</tbody></table>{filteredSignals.length === 0 && <EmptyState message={isImported ? 'Risk event signals are unavailable for imported datasets.' : hasData ? 'No risk events match this search.' : 'Risk events will appear when the database is connected.'} />}</div>
            <TablePagination count={filteredSignals.length} page={tablePage} pageCount={signalPageCount} pageSize={pageSize} setPage={setTablePage} label="risk events" />
          </section>}

          {active === 'Datasets' && <section className="dataset-workspace">
            <section className="panel dataset-import-panel">
              <div className="panel-heading"><div><h2>Import a dataset</h2><p>CSV or Excel workbook · up to 20 MB and 100,000 rows</p></div><span className="dataset-local"><i /> Stored locally</span></div>
              <label className="dataset-file-picker"><span className="file-icon"><FileSpreadsheet size={21} /></span><span><strong>{uploadFile?.name ?? 'Choose a file to get started'}</strong><small>{uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB · CSV or XLSX` : 'CSV and .xlsx files are supported'}</small></span><span className="export-button">Browse files</span><input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => selectUploadFile(event.target.files?.[0])} /></label>
              <div className="dataset-actions"><p>Your original historical dataset remains unchanged. Imported files are saved as separate local datasets.</p><button className="export-button" onClick={previewUpload} disabled={!uploadFile || uploadBusy}><Upload size={16} />{uploadBusy ? 'Validating…' : 'Preview data'}</button></div>
              {uploadBusy && <div className="upload-progress" role="status"><span />Reading and validating your file…</div>}
              {uploadError && <div className="dataset-message dataset-error" role="alert"><AlertTriangle size={17} />{uploadError}</div>}
              {uploadSuccess && <div className="dataset-message dataset-success" role="status"><Check size={17} />{uploadSuccess}</div>}
            </section>

            {preview && <section className="panel dataset-preview-panel">
              <div className="panel-heading"><div><h2>Review columns</h2><p>{preview.filename} · {formatNumber(preview.row_count)} rows · map the fields present in this file</p></div><button className="export-button" onClick={importUpload} disabled={uploadBusy}><Check size={16} />{uploadBusy ? 'Importing…' : 'Import dataset'}</button></div>
              <div className="mapping-grid">{Object.entries(preview.supported_fields).map(([field, label]) => <label className="mapping-row" key={field}><span>{label}</span><select aria-label={`Map ${label}`} value={mappings[field] ?? ''} onChange={(event) => setMappings((current) => ({ ...current, [field]: event.target.value }))}><option value="">Not mapped</option>{preview.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>)}</div>
              <p className="mapping-note">Map an entity identifier and at least one measurable field. Unmapped analyses remain unavailable in the dashboard.</p>
              <div className="preview-table-wrap"><table><thead><tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{preview.preview.map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={column}>{row[column] || '—'}</td>)}</tr>)}</tbody></table></div>
            </section>}

            <section className="panel dataset-list-panel"><div className="panel-heading"><div><h2>Your datasets</h2><p>Switch the workspace to analyze a different source.</p></div></div><div className="dataset-list">{datasets.map((dataset) => <button className={`dataset-list-item ${selectedDataset === dataset.dataset_id ? 'selected' : ''}`} key={dataset.dataset_id} onClick={() => setSelectedDataset(dataset.dataset_id)}><span className="dataset-list-icon"><Database size={18} /></span><span><strong>{dataset.name}</strong><small>{dataset.kind === 'original' ? 'Original · read-only historical source' : `${formatNumber(dataset.row_count ?? 0)} rows · imported locally`}</small></span><span className="dataset-current">{selectedDataset === dataset.dataset_id ? 'Selected' : 'Open'}</span></button>)}</div></section>
          </section>}

          {active === 'Reports' && <section className="panel report-panel"><div className="panel-heading"><div><h2>Data provenance & report notes</h2><p>How to interpret the information in this workspace</p></div><button className="export-button" onClick={exportSuppliers} disabled={!hasData}><Download size={16} /> Export suppliers</button></div><div className="report-notes">{Object.entries(dashboardData?.provenance ?? { data: dashboardData?.data_message ?? 'SQLite database is not connected.', forecasting: 'Not enabled.' }).map(([key, value]) => <div className="report-note" key={key}><span className="note-mark"><Activity size={16} /></span><div><strong>{key.replaceAll('_', ' ')}</strong><p>{value}</p></div></div>)}</div></section>}

          {active === 'Settings' && <section className="panel report-panel"><div className="panel-heading"><div><h2>Workspace settings</h2><p>Connection details for this local environment</p></div></div><div className="settings-list"><div className="setting-row"><span>Appearance</span><div className="appearance-switch" role="group" aria-label="Choose appearance"><button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button><button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button></div></div><Setting label="API status" value={apiLabel} /><Setting label="Database status" value={dataLabel} /><Setting label="API base URL" value={apiBase} /><Setting label="Data source" value="Local SQLite via read-only API" /><Setting label="Forecasting" value="Not enabled" /></div></section>}

          {active === 'Overview' && <>
            <div className="section-title-row"><div><h2>Operational snapshot</h2><p>Key indicators from the configured dataset</p></div><span className={`updated ${hasData ? 'updated-live' : ''}`}><i />{hasData ? (dashboardData.dataset_kind === 'imported' ? 'Imported metrics' : 'Database metrics') : 'Awaiting data'}</span></div>
            <div className="kpi-grid">
              <MetricCard label="Supplier risk index" value={hasData && dashboardData.kpis.supplier_risk_index != null ? dashboardData.kpis.supplier_risk_index.toFixed(1) : '—'} unit={hasData && dashboardData.kpis.supplier_risk_index != null ? '/ 100' : ''} detail={hasData && dashboardData.kpis.supplier_count != null ? `Across ${formatNumber(dashboardData.kpis.supplier_count)} suppliers` : 'Not available for this dataset'} icon={<ShieldAlert size={18} />} tone="amber" />
              <MetricCard label="Shipment on-time rate" value={hasData && dashboardData.kpis.shipment_on_time_rate !== null ? `${dashboardData.kpis.shipment_on_time_rate.toFixed(1)}%` : '—'} detail={hasData ? `${formatNumber(dashboardData.kpis.total_shipments)} historical shipments` : 'Connected dataset required'} icon={<Truck size={18} />} tone="mint" />
              <MetricCard label="High-risk inventory" value={hasData ? formatNumber(dashboardData.kpis.high_risk_inventory_items) : '—'} detail={hasData && dashboardData.kpis.high_risk_inventory_items != null ? `Snapshot ${dashboardData.kpis.inventory_snapshot_date ?? 'available'}` : 'Risk scoring unavailable'} icon={<Boxes size={18} />} tone="violet" />
              <MetricCard label="High / critical events" value={hasData ? formatNumber(dashboardData.kpis.high_critical_risk_events) : '—'} detail={hasData && dashboardData.kpis.high_critical_risk_events != null ? `${formatNumber(signals.length)} recorded risk events` : 'No risk scores calculated'} icon={<AlertTriangle size={18} />} tone="rose" />
            </div>

            <div className="middle-grid">
              <section className="panel trend-panel"><div className="panel-heading"><div><h2>Delivery performance</h2><p>Historical monthly on-time delivery rate</p></div><span className="chart-unit">Percent</span></div>
                <div className="chart-legend"><span><i className="legend-dot ontime" />On time</span><span><i className="legend-dot delayed" />Delayed</span></div>
                {hasData && dashboardData.trend.length > 0 ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={dashboardData.trend.map((row) => ({ ...row, onTime: row.on_time_rate, delayedRate: Number((100 - row.on_time_rate).toFixed(1)) }))} margin={{ top: 10, right: 12, left: -17, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={9} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(value) => `${value}%`} /><Tooltip contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', boxShadow: 'var(--shadow-float)' }} formatter={(value: number, name: string) => [`${value}%`, name === 'onTime' ? 'On time' : 'Delayed']} /><Line type="monotone" dataKey="onTime" name="onTime" stroke="var(--accent)" strokeWidth={2.7} dot={{ r: 3.5, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--surface)' }} activeDot={{ r: 5 }} /><Line type="monotone" dataKey="delayedRate" name="delayedRate" stroke="var(--warning)" strokeWidth={2} strokeDasharray="5 5" dot={false} /></LineChart></ResponsiveContainer></div> : <EmptyState message={isImported ? 'A delivery trend requires mapped shipment IDs and delivery outcomes.' : 'A delivery trend will appear when historical shipment data is available.'} />}
                <div className="chart-foot"><span>Observed outcomes · not a forecast</span><span className="mini-status"><i className={hasData ? 'is-good' : ''} />{hasData ? (dashboardData.dataset_kind === 'imported' ? 'Imported data' : 'SQLite data') : 'No data'}</span></div>
              </section>

              <section className="panel signals-panel"><div className="panel-heading"><div><h2>Priority risk signals</h2><p>Recorded events from the risk register</p></div><button className="text-link" onClick={() => setSection('Risk Signals')}>View register <span>↗</span></button></div>
                <div className="signal-list">{signals.slice(0, 4).map((signal) => <div className="signal-item" key={signal.risk_event_id}><span className={`signal-mark ${bandClass(signal.risk_level)}`}>{signal.entity_type === 'INVENTORY' ? <Boxes size={17} /> : <AlertTriangle size={17} />}</span><div className="signal-copy"><strong>{signal.risk_type.replaceAll('_', ' ')}</strong><p>{signal.explanation}</p><small>{signal.entity_type} · {signal.entity_id} · {signal.event_date.slice(0, 10)}</small></div><RiskBadge level={signal.risk_level} /></div>)}{signals.length === 0 && <EmptyState message={isImported ? 'Risk event signals are unavailable for imported datasets.' : 'Recorded risk events will appear here.'} />}</div>
                <div className="signals-foot"><ShieldAlert size={15} /><span>Risk scores are prototype indicators. Scenario fields are labelled.</span></div>
              </section>
            </div>

            <section className="panel table-panel overview-suppliers"><div className="panel-heading supplier-heading"><div><h2>Supplier risk register</h2><p>{isImported ? 'Mapped supplier fields · scores are not calculated' : 'Suppliers ranked by risk score'}</p></div><button className="text-link" onClick={() => setSection('Supplier Risk')}>Explore suppliers <span>↗</span></button></div>
              <div className="table-tools"><div className="search-box"><Search size={17} /><input aria-label="Search suppliers" placeholder="Search suppliers…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>{!isImported && <label className="filter-select"><span>Risk level</span><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option>All risks</option><option>High</option><option>Medium</option><option>Low</option></select><ChevronDown size={14} /></label>}</div>
              <div className="table-scroll"><table><thead><tr><th>SUPPLIER</th><th>DATA ORIGIN</th><th>LATE DELIVERY</th><th>RISK SCORE</th><th>RISK LEVEL</th><th /></tr></thead><tbody>{visibleSuppliers.map((supplier) => <tr key={supplier.id}><td><div className="supplier-cell"><span className={`supplier-logo logo-${bandClass(supplier.band)}`}>{supplier.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{supplier.name}</strong><small>{supplier.id}</small></div></div></td><td><span className="category">{supplier.category}</span></td><td className="numeric">{supplier.delay == null ? '—' : `${supplier.delay.toFixed(1)}%`}</td><td><Score value={supplier.risk} level={supplier.band} /></td><td><RiskBadge level={supplier.band} /></td><td><button className="row-menu" aria-label={`Open ${supplier.name} supplier risk register`} onClick={() => setSection('Supplier Risk')}>↗</button></td></tr>)}</tbody></table>{visibleSuppliers.length === 0 && <EmptyState message={hasData ? 'No suppliers match these filters.' : 'Supplier records will appear when the database is connected.'} />}</div>
              <div className="table-footer"><span>{hasData ? `${visibleSuppliers.length} of ${suppliers.length} suppliers` : 'No supplier records loaded'}</span><span>Scores 0–100 · prototype indicators</span></div>
            </section>
          </>}

          <footer className="page-footer"><span>© 2026 SupplyChainX <i>·</i> Supply chain risk intelligence</span><span>Foundation build <b>0.1.0</b> <i>·</i> <a href="https://github.com/RugvedTatkare/SupplyChainX" target="_blank" rel="noreferrer">Source repository ↗</a></span></footer>
          {apiStatus === 'connected' && apiMetrics.length > 0 && <div className="api-data-note">API status · {apiMetrics.map((metric) => `${metric.label}: ${metric.value}`).join(' · ')}</div>}
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, unit = '', detail, icon, tone = 'blue' }: { label: string; value: string; unit?: string; detail: string; icon: React.ReactNode; tone?: string }) {
  return <article className="kpi-card"><div className="kpi-top"><span className={`kpi-icon icon-${tone}`}>{icon}</span><span className="kpi-period">DATASET</span></div><div className="kpi-value">{value}<span>{unit}</span></div><div className="kpi-label">{label}</div><div className="kpi-caption">{detail}</div></article>;
}

function RiskBadge({ level }: { level: string }) {
  return <span className={`risk-badge risk-${bandClass(level)}`}><i />{level}</span>;
}

function Score({ value, level }: { value: number | null; level: string }) {
  return <div className="score-cell"><span className="score-track"><i className={`score-fill score-${bandClass(level)}`} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} /></span><strong>{value === null ? '—' : value.toFixed(1)}</strong></div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state"><span><Activity size={18} /></span><p>{message}</p></div>;
}

function SearchTools({ query, setQuery, placeholder }: { query: string; setQuery: (query: string) => void; placeholder: string }) {
  return <div className="table-tools"><div className="search-box"><Search size={17} /><input aria-label={placeholder} placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>;
}

function TablePagination({ count, page, pageCount, pageSize, setPage, label }: { count: number; page: number; pageCount: number; pageSize: number; setPage: (fn: (page: number) => number) => void; label: string }) {
  return <div className="table-footer"><span>Showing {count ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, count)} of {formatNumber(count)} {label}</span><span className="table-pagination"><button className="subtle-button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button><span>Page {Math.min(page + 1, pageCount)} of {pageCount}</span><button className="subtle-button" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</button></span></div>;
}

function Setting({ label, value }: { label: string; value: string }) {
  return <div className="setting-row"><span>{label}</span><strong>{value}</strong></div>;
}

export default App;
