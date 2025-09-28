import { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { buildTooltip } from '../../utils/metricsGlossary';
import '../../App.admin.css';
import { api } from '../../services/api.js';
import InfoTooltip from '../../components/InfoTooltip.jsx';
import { useCurrencyFormatter, useSettings } from '../../context/SettingsContext.jsx';

export default function AdminAnalytics(){
  const [stats, setStats] = useState(null);
  const [extended, setExtended] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trendMode, setTrendMode] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  // Unified analytics
  const [unified, setUnified] = useState(null);
  const [uLoading, setULoading] = useState(false);
  const [uError, setUError] = useState(null);
  const [granularity, setGranularity] = useState('DAILY');
  const [range, setRange] = useState(()=>{
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate()-29); // default 30 days
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const [statuses, setStatuses] = useState(['PENDING','PROCESSING','SHIPPED','DELIVERED']);
  const [includeRefunded, setIncludeRefunded] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  // Advanced analytics
  const [advanced, setAdvanced] = useState(null);
  const [advLoading, setAdvLoading] = useState(false);
  const [advError, setAdvError] = useState(null);
  const formatCurrency = useCurrencyFormatter();
  const { settings } = useSettings();
  const currencyLabel = settings?.currency?.symbol || settings?.currency?.code || 'KES';
  const formatAmount = useCallback((value, override) => formatCurrency(Number(value ?? 0), override), [formatCurrency]);

  useEffect(()=>{
    let active = true;
    // Reuse dashboard stats for now; could call dedicated analytics endpoint later
    Promise.all([
      api.admin.stats(),
      api.admin.analytics.overview({ lowStockThreshold:5, revenueDays:30 })
    ])
      .then(([s,ov])=>{ if(!active) return; setStats(s); setExtended(ov); setLoading(false); })
      .catch(e=>{ if(!active) return; setError(e.message); setLoading(false); });
    return ()=>{ active = false; };
  },[]);

  // Unified fetch
  useEffect(()=>{
    let active = true;
    setULoading(true); setUError(null);
    api.admin.analytics.unified({
      from: range.from,
      to: range.to,
      granularity,
      statuses,
      includeRefunded,
      includeCancelled
    }).then(data => { if(!active) return; setUnified(data); setULoading(false); })
      .catch(e => { if(!active) return; setUError(e.message); setULoading(false); });
    return ()=>{ active = false; };
  }, [range.from, range.to, granularity, statuses, includeRefunded, includeCancelled]);

  // Advanced fetch (reuses same date range window)
  useEffect(()=>{
    let active = true;
    setAdvLoading(true); setAdvError(null);
    api.admin.analytics.advanced({ from: range.from, to: range.to })
      .then(data => { if(!active) return; setAdvanced(data); setAdvLoading(false); })
      .catch(e => { if(!active) return; setAdvError(e.message); setAdvLoading(false); });
    return ()=>{ active=false; };
  }, [range.from, range.to]);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 m-0">Analytics</h1>
        <a href="/admin/dashboard" className="btn btn-outline-secondary btn-sm">Back to Dashboard</a>
      </div>
      {loading && <p>Loading analytics...</p>}
      {error && <div className="alert alert-danger">{error}</div>}
      {stats && (
        <div className="row g-3 mb-4">
          <AnalyticCard title="Total Orders" value={stats.totalOrders} accent="info" />
          <AnalyticCard title="Revenue" value={formatAmount(stats.totalRevenue)} accent="success" />
          <AnalyticCard title="Products" value={stats.totalProducts} accent="warning" />
          <AnalyticCard title="Admins" value={stats.totalAdmins} accent="danger" />
          <AnalyticCard title="Pending" value={stats.pendingOrders} accent="info" />
          <AnalyticCard title="Processing" value={stats.processingOrders} accent="primary" />
          <AnalyticCard title="Completed" value={stats.completedOrders} accent="success" />
        </div>
      )}
      {extended && (
        <>
          <section className="mb-5">
            <h2 className="h6 mb-3 d-flex align-items-center gap-2">Low Stock (≤ threshold)
              <InfoTooltip text="Products with stock at or below the configured threshold (default 5). Helps identify items to restock." />
            </h2>
            {extended.lowStock.length === 0 ? <p className="text-muted small mb-0">No low stock products.</p> : (
              <div className="table-responsive small">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Name</th><th className="text-end">Stock</th></tr></thead>
                  <tbody>
                    {extended.lowStock.map(p => <tr key={p.id}><td>{p.name}</td><td className="text-end">{p.stock}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="mb-5">
            <h2 className="h6 mb-3 d-flex align-items-center gap-2">Top Selling Products
              <InfoTooltip text="Ranked by quantity sold in the current lookback window (default 30 days). Top 10 displayed." />
            </h2>
            {extended.topSelling.length === 0 ? <p className="text-muted small mb-0">No sales yet.</p> : (
              <div className="table-responsive small">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>Name</th><th className="text-end">Qty Sold</th></tr></thead>
                  <tbody>
                    {extended.topSelling.slice(0,10).map(t => <tr key={t.id}><td>{t.name}</td><td className="text-end">{t.quantity}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {/* Revenue trend now unified: we will render it below using unified buckets so gross matches AOV */}
          <section className="mb-5">
            <h2 className="h6 mb-3 d-flex align-items-center gap-2">Order Status Funnel (Snapshot)
              <InfoTooltip text="Current counts of orders by status. Operational WIP snapshot, not a sequential conversion metric yet." />
            </h2>
            <StatusFunnel stats={stats} />
          </section>
        </>
      )}
      <UnifiedSection
        unified={unified}
        loading={uLoading}
        error={uError}
        granularity={granularity}
        onGranularityChange={setGranularity}
        range={range}
        setRange={setRange}
        statuses={statuses}
        setStatuses={setStatuses}
        includeRefunded={includeRefunded}
        setIncludeRefunded={setIncludeRefunded}
        includeCancelled={includeCancelled}
        setIncludeCancelled={setIncludeCancelled}
        formatAmount={formatAmount}
        currencyLabel={currencyLabel}
      />
      <RevenueTrendSection unified={unified} formatAmount={formatAmount} currencyLabel={currencyLabel} />
  <AdvancedSections advanced={advanced} loading={advLoading} error={advError} />
      <section className="mb-5">
        <h2 className="h6 mb-3">Coming Soon</h2>
        <ul className="small text-muted mb-0">
          <li><s>Average order value vs time</s> (Implemented)</li>
          <li>Repeat customer rate</li>
          <li>Churn & retention metrics</li>
          <li>Order status funnel conversion</li>
        </ul>
      </section>
    </div>
  );
}

// Human-readable tooltip explanations for each metric.
const METRIC_EXPLANATIONS = {
  'Total Orders': 'Count of all orders ever created (any status). Includes cancelled / refunded for historical completeness.',
  'Revenue': 'Sum of gross order totals (sum of item price * quantity) for all non-cancelled orders. Refunded handling depends on backend implementation.',
  'Products': 'Total number of distinct active products in the catalog (may exclude soft-deleted items if backend filters them).',
  'Admins': 'Number of users with administrative privileges (role-based count).',
  'Pending': 'Orders created but not yet picked/processed. status = PENDING.',
  'Processing': 'Orders currently being prepared / picked / packed. status = PROCESSING.',
  'Completed': 'Orders reaching a terminal success state (e.g. DELIVERED). Uses provided completedOrders count.'
};

function AnalyticCard({ title, value, accent }) {
  const accentClass = accent ? `admin-metric-accent-${accent}` : '';
  const tip = METRIC_EXPLANATIONS[title];
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className={`admin-metric-card card h-100 shadow-sm ${accentClass}`} aria-label={tip || title}>
        <div className="card-body d-flex flex-column justify-content-center text-center py-3">
          <div className="metric-title text-muted mb-1 d-flex justify-content-center align-items-center gap-1">
            <span>{title}</span>
            {tip && <InfoTooltip text={tip} />}
          </div>
          <div className="metric-value">{value}</div>
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({ data, formatAmount, currencyLabel, height=160 }) {
  const [hoverKey, setHoverKey] = useState(null);
  const [coords, setCoords] = useState({x:0,y:0});
  const max = Math.max(...data.map(d => Number(d.revenue)), 1);
  const label = currencyLabel || 'KES';
  const formatValue = typeof formatAmount === 'function'
    ? (value) => formatAmount(value)
    : (value) => {
        const target = Number(value ?? 0);
        return Number.isFinite(target) ? `${label} ${target.toFixed(2)}` : `${label} 0.00`;
      };
  return (
    <div className="position-relative">
      <div className="d-flex align-items-end gap-1" style={{height:`${height}px`, overflowX:'auto'}}>
        {data.map(d => {
          const h = (Number(d.revenue)/max)*(height-40); // reserve top space for tooltip
          const formattedRevenue = formatValue(d.revenue);
          return (
            <div key={d.key} className="d-flex flex-column align-items-center position-relative" style={{minWidth:'34px'}}
                 onMouseEnter={e=>{ const rect=e.currentTarget.getBoundingClientRect(); setCoords({x:rect.left+rect.width/2, y:rect.top-6}); setHoverKey(d.key);} }
                 onMouseLeave={()=>setHoverKey(k=>k===d.key?null:k)}>
              <div className="w-100 rounded-top bg-success position-relative" style={{height:`${h}px`, transition:'height .3s'}} role="img" aria-label={`Revenue ${d.label}: ${formattedRevenue}`}></div>
              <small className="text-muted mt-1" style={{fontSize:'0.55rem'}}>{d.label}</small>
              {hoverKey === d.key && <ChartTooltipPortal x={coords.x} y={coords.y} children={formattedRevenue} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Unified revenue trend derived from unified buckets so gross matches AOV sums.
function RevenueTrendSection({ unified, formatAmount, currencyLabel }) {
  const buckets = unified?.buckets || [];
  const data = useMemo(()=> buckets.map(b => ({ key: b.start, label: b.start.slice(5,10), revenue: b.gross })), [buckets]);
  const stats = useMemo(()=>{
    if(!data.length) return null;
    const total = data.reduce((s,d)=> s + Number(d.revenue),0);
    const avg = total / data.length;
    const best = data.reduce((a,b)=> Number(b.revenue) > Number(a.revenue) ? b : a, data[0]);
    return { total, avg, best };
  },[data]);
  const change = useMemo(()=>{
    if(data.length < 2) return null;
    const last = Number(data[data.length-1].revenue);
    const prev = Number(data[data.length-2].revenue);
    if(prev === 0) return null;
    return ((last - prev)/prev)*100;
  },[data]);
  const label = currencyLabel || 'KES';
  const formatValue = typeof formatAmount === 'function'
    ? (value) => formatAmount(value)
    : (value) => {
        const target = Number(value ?? 0);
        return Number.isFinite(target) ? `${label} ${target.toFixed(2)}` : `${label} 0.00`;
      };
  const trendTooltip = 'Unified revenue trend: each bar = bucket gross. Uses same filters & range as AOV; values will match Gross (Sum) total.';
  return (
    <section className="mb-5" aria-label={trendTooltip}>
      <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
        <h2 className="h6 m-0 d-flex align-items-center gap-2">Revenue Trend (Unified){change!=null && (
          <span className={`badge ms-2 ${change>0?'text-bg-success':'text-bg-danger'}`}>{change>0?'+':''}{change.toFixed(1)}%</span>
        )}<InfoTooltip text={trendTooltip} /></h2>
      </div>
      {data.length === 0 ? <ChartSkeleton /> : <MiniBarChart data={data} formatAmount={formatAmount} currencyLabel={currencyLabel} />}
      {stats && (
        <div className="row row-cols-2 row-cols-sm-4 g-2 mt-3 small">
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Total<br/><strong>{formatValue(stats.total)}</strong></div></div>
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Average<br/><strong>{formatValue(stats.avg)}</strong></div></div>
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Best Bucket<br/><strong>{formatValue(stats.best.revenue)}</strong></div></div>
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Buckets<br/><strong>{data.length}</strong></div></div>
        </div>
      )}
    </section>
  );
}

function ChartSkeleton(){
  return (
    <div className="d-flex align-items-end gap-1" style={{height:'160px'}} aria-hidden="true">
      {Array.from({length:16}).map((_,i)=>(
        <div key={i} className="bg-body-tertiary rounded-top" style={{width:'34px', height:`${20 + (i%5)*10}px`, opacity:0.4}}></div>
      ))}
    </div>
  );
}

function StatusFunnel({ stats }) {
  const stages = [
    { label:'Pending', value: stats.pendingOrders, color:'bg-secondary' },
    { label:'Processing', value: stats.processingOrders, color:'bg-primary' },
    { label:'Shipped', value: stats.shippedOrders, color:'bg-info' },
    { label:'Delivered', value: stats.deliveredOrders, color:'bg-success' },
    { label:'Cancelled', value: stats.cancelledOrders, color:'bg-warning' },
    { label:'Refunded', value: stats.refundedOrders, color:'bg-danger' }
  ];
  const max = Math.max(...stages.map(s=>s.value),1);
  return (
    <div className="vstack gap-1" style={{maxWidth:'540px'}}>
      {stages.map(s => (
        <div key={s.label} className="d-flex align-items-center gap-2">
          <div style={{width:'90px'}} className="small text-muted">{s.label}</div>
          <div className="flex-grow-1 bg-body-tertiary rounded position-relative" style={{height:'18px'}}>
            <div className={`${s.color} h-100 rounded`} style={{width:`${(s.value/max)*100}%`, transition:'width .4s'}}></div>
            <div className="position-absolute top-0 start-50 translate-middle-x small" style={{lineHeight:'18px'}}>{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UnifiedSection({ unified, loading, error, granularity, onGranularityChange, range, setRange, statuses, setStatuses, includeRefunded, setIncludeRefunded, includeCancelled, setIncludeCancelled, formatAmount, currencyLabel }) {
  const tip = 'Average Order Value vs Time: buckets with gross revenue, order counts, derived AOV, and overall aggregates. Filters: statuses, refunded/cancelled inclusion, date range.';
  const buckets = unified?.buckets || [];
  const current = buckets[buckets.length-1];
  const previous = buckets[buckets.length-2];
  const percentChange = current && previous && previous.aov && previous.aov !== 0 ? ((Number(current.aov) - Number(previous.aov)) / Number(previous.aov))*100 : null;
  const totalOrders = unified?.aggregates?.totalOrders || 0;
  const totalGross = Number(unified?.aggregates?.totalGross || 0);
  const label = currencyLabel || 'KES';
  const formatValue = typeof formatAmount === 'function'
    ? (value) => formatAmount(value)
    : (value) => {
        const target = Number(value ?? 0);
        return Number.isFinite(target) ? `${label} ${target.toFixed(2)}` : `${label} 0.00`;
      };

  function onDateRangeChange(days){
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate()-(days-1));
    setRange({ from: from.toISOString(), to: to.toISOString() });
  }

  const statusOptions = ['PENDING','PROCESSING','SHIPPED','DELIVERED'];
  function toggleStatus(s){
    setStatuses(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s]);
  }

  const subtitle = `Range: ${range.from.slice(0,10)} → ${range.to.slice(0,10)} (Statuses: ${statuses.join(', ')}${includeRefunded?', REFUNDED':''}${includeCancelled?', CANCELLED':''})`;

  return (
    <section className="mb-5" aria-label={tip}>
      <div className="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-2">
        <div>
          <h2 className="h6 m-0 d-flex align-items-center gap-2">Average Order Value vs Time ({granularity}) {percentChange!=null && (
            <span className={`badge ms-2 ${percentChange>0?'text-bg-success':'text-bg-danger'}`}>{percentChange>0?'+':''}{percentChange.toFixed(2)}%</span>
          )}<InfoTooltip text={tip} /></h2>
          <div className="small text-muted mt-1">{subtitle}</div>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <div className="btn-group btn-group-sm" role="group" aria-label="Granularity">
            {['DAILY','WEEKLY','MONTHLY'].map(g => <button key={g} type="button" className={`btn btn-${granularity===g?'primary':'outline-primary'}`} onClick={()=>onGranularityChange(g)}>{g.charAt(0)+g.slice(1).toLowerCase()}</button>)}
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="Range">
            {[7,14,30,60].map(d => <button key={d} type="button" className={`btn btn-${(new Date(range.from).getDate()=== (new Date().getDate()-(d-1)) && ( (new Date().getTime()-new Date(range.from).getTime())/86400000+1)===d )?'primary':'outline-primary'}`} onClick={()=>onDateRangeChange(d)}>{d}d</button>)}
          </div>
        </div>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        {statusOptions.map(s => (
          <button key={s} type="button" className={`btn btn-sm ${statuses.includes(s)?'btn-secondary':'btn-outline-secondary'}`} onClick={()=>toggleStatus(s)}>{s}</button>
        ))}
        <div className="form-check form-check-inline small">
          <input className="form-check-input" type="checkbox" id="incRefunded" checked={includeRefunded} onChange={e=>setIncludeRefunded(e.target.checked)} />
          <label className="form-check-label" htmlFor="incRefunded">Refunded</label>
        </div>
        <div className="form-check form-check-inline small">
          <input className="form-check-input" type="checkbox" id="incCancelled" checked={includeCancelled} onChange={e=>setIncludeCancelled(e.target.checked)} />
          <label className="form-check-label" htmlFor="incCancelled">Cancelled</label>
        </div>
      </div>
      {loading && <ChartSkeleton />}
      {error && <div className="alert alert-danger small mb-0">{error}</div>}
      {buckets.length === 0 && !loading && !error && <p className="text-muted small mb-0">No orders in range.</p>}
      {buckets.length>0 && !loading && !error && <AovMiniChart points={buckets.map(b=>({ start:b.start, end:b.end, aov:b.aov, orderCount:b.orderCount, grossTotal:b.gross }))} granularity={granularity} formatAmount={formatAmount} currencyLabel={currencyLabel} />}
      {unified && !loading && !error && (
        <div className="row row-cols-2 row-cols-sm-5 g-2 mt-3 small">
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Current AOV<br/><strong>{current ? formatValue(current.aov) : formatValue(0)}</strong></div></div>
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Previous AOV<br/><strong>{previous ? formatValue(previous.aov) : formatValue(0)}</strong></div></div>
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Buckets<br/><strong>{buckets.length}</strong></div></div>
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Orders (Total)<br/><strong>{totalOrders}</strong></div></div>
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Gross (Sum)<br/><strong>{formatValue(totalGross)}</strong></div></div>
        </div>
      )}
    </section>
  );
}

function AovMiniChart({ points, granularity, formatAmount, currencyLabel, height=160 }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [coords, setCoords] = useState({x:0,y:0});
  const max = Math.max(...points.map(p => Number(p.aov)), 1);
  const currencyTag = currencyLabel || 'KES';
  const formatValue = typeof formatAmount === 'function'
    ? (value) => formatAmount(value)
    : (value) => {
        const target = Number(value ?? 0);
        return Number.isFinite(target) ? `${currencyTag} ${target.toFixed(2)}` : `${currencyTag} 0.00`;
      };
  return (
    <div className="position-relative">
      {/* Removed horizontal scrolling: bars now flex to available width */}
      <div className="d-flex align-items-end gap-1" style={{height:`${height}px`}}>
        {points.map((p,i) => {
          const val = Number(p.aov);
          const h = (val/max)*(height-40);
          const bucketLabel = granularity === 'DAILY' ? p.start.slice(5,10) : granularity === 'WEEKLY' ? p.start.slice(5,10) : p.start.slice(0,7);
          const gross = Number(p.grossTotal || 0);
          const orders = p.orderCount || 0;
          const formattedAov = formatValue(val);
          const formattedGross = formatValue(gross);
          return (
            <div key={i} className="d-flex flex-column align-items-center position-relative" style={{flex:'1 1 0'}}
                 onMouseEnter={e=>{ const rect=e.currentTarget.getBoundingClientRect(); setCoords({x:rect.left+rect.width/2, y:rect.top-8}); setHoverIndex(i);} }
                 onMouseLeave={()=>setHoverIndex(h=>h===i?null:h)}>
              <div className="w-100 rounded-top bg-info position-relative" style={{height:`${h}px`, transition:'height .3s'}} role="img" aria-label={`AOV ${bucketLabel}: ${formattedAov}`}></div>
              <small className="text-muted mt-1" style={{fontSize:'0.55rem'}}>{bucketLabel}</small>
              {hoverIndex === i && (
                <ChartTooltipPortal x={coords.x} y={coords.y}>
                  <div style={{fontWeight:'600'}}>{bucketLabel}</div>
                  <div>AOV: {formattedAov}</div>
                  <div>Orders: {orders}</div>
                  <div>Gross: {formattedGross}</div>
                </ChartTooltipPortal>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Portal component for chart tooltips to break out of clipping/stacking contexts
function ChartTooltipPortal({ x, y, children }) {
  const el = useMemo(()=>{
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = `${y}px`;
    div.style.left = `${x}px`;
    div.style.transform = 'translate(-50%, -100%)';
    div.style.background = 'rgba(0,0,0,0.9)';
    div.style.color = '#fff';
    div.style.padding = '6px 10px';
    div.style.fontSize = '0.65rem';
    div.style.lineHeight = '1.15';
    div.style.borderRadius = '6px';
    div.style.pointerEvents = 'none';
    div.style.zIndex = '2147483647';
    div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    div.style.whiteSpace = 'nowrap';
    return div;
  }, [x,y]);
  useEffect(()=>{
    document.body.appendChild(el);
    return ()=>{ document.body.removeChild(el); };
  }, [el]);
  // Update coordinates on prop change
  useEffect(()=>{
    el.style.top = `${y}px`;
    el.style.left = `${x}px`;
  }, [x,y,el]);
  return createPortal(children, el);
}

function AdvancedSections({ advanced, loading, error }) {
  if (loading) return <ChartSkeleton />; // reuse skeleton for simplicity
  if (error) return <div className="alert alert-danger small">{error}</div>;
  if (!advanced) return null;
  const { customers, retention, funnel } = advanced;

  const t = {
    repeat: buildTooltip('repeatRate'),
    repeatCustomers: buildTooltip('repeatCustomers'),
    repeatOrders: buildTooltip('ordersFromRepeat'),
    repeatOrderShare: buildTooltip('repeatOrderShare'),
    retention: buildTooltip('retentionRate'),
    churn: buildTooltip('churnRate'),
    fPendingProcessing: buildTooltip('funnelPendingToProcessing'),
    fProcessingShipped: buildTooltip('funnelProcessingToShipped'),
    fShippedDelivered: buildTooltip('funnelShippedToDelivered'),
    fOverall: buildTooltip('funnelOverallDelivered'),
    cancellation: buildTooltip('cancellationRate'),
    refund: buildTooltip('refundRate')
  };

  return (
    <section className="mb-5">
      <h2 className="h6 mb-3 d-flex align-items-center gap-2">Customer Metrics<InfoTooltip text={t.repeat} /></h2>
      <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-6 g-2 small mb-4">
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Customers<br/><strong>{customers.totalCustomers}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Repeat <InfoTooltip text={t.repeatCustomers} /><strong>{customers.repeatCustomers}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Repeat Rate <InfoTooltip text={t.repeat} /><strong>{Number(customers.repeatRatePct).toFixed(2)}%</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Orders (Total)<br/><strong>{customers.totalOrders}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Orders from Repeat <InfoTooltip text={t.repeatOrders} /><strong>{customers.ordersFromRepeat}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Repeat Order Share <InfoTooltip text={t.repeatOrderShare} /><strong>{Number(customers.ordersFromRepeatPct).toFixed(2)}%</strong></div></div>
      </div>
      <h3 className="h6 mb-3 d-flex align-items-center gap-2">Retention & Churn<InfoTooltip text={t.retention} /></h3>
      <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-6 g-2 small mb-4">
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Prev Window Cust<br/><strong>{retention.previousWindowCustomers}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Retained <InfoTooltip text={t.retention} /><strong>{retention.retainedCustomers}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Retention Rate <InfoTooltip text={t.retention} /><strong>{Number(retention.retentionRatePct).toFixed(2)}%</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Churned <InfoTooltip text={t.churn} /><strong>{retention.churnedCustomers}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Churn Rate <InfoTooltip text={t.churn} /><strong>{Number(retention.churnRatePct).toFixed(2)}%</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Window Length (days)<br/><strong>{Math.max(1, Math.round((new Date(advanced.to).getTime()-new Date(advanced.from).getTime())/86400000))}</strong></div></div>
      </div>
      <h3 className="h6 mb-3 d-flex align-items-center gap-2">Order Funnel Conversion<InfoTooltip text={t.fPendingProcessing} /></h3>
      <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-6 g-2 small mb-3">
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Pending<br/><strong>{funnel.pending}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Processing<br/><strong>{funnel.processing}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Shipped<br/><strong>{funnel.shipped}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Delivered<br/><strong>{funnel.delivered}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Cancelled<br/><strong>{funnel.cancelled}</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded">Refunded<br/><strong>{funnel.refunded}</strong></div></div>
      </div>
      <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-6 g-2 small">
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Pending→Processing <InfoTooltip text={t.fPendingProcessing} /><strong>{Number(funnel.convPendingToProcessing).toFixed(2)}%</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Processing→Shipped <InfoTooltip text={t.fProcessingShipped} /><strong>{Number(funnel.convProcessingToShipped).toFixed(2)}%</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Shipped→Delivered <InfoTooltip text={t.fShippedDelivered} /><strong>{Number(funnel.convShippedToDelivered).toFixed(2)}%</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Overall Delivered <InfoTooltip text={t.fOverall} /><strong>{Number(funnel.overallConversionToDelivered).toFixed(2)}%</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Cancellation Rate <InfoTooltip text={t.cancellation} /><strong>{Number(funnel.cancellationRatePct).toFixed(2)}%</strong></div></div>
        <div className="col"><div className="p-2 bg-body-tertiary rounded d-flex flex-column">Refund Rate <InfoTooltip text={t.refund} /><strong>{Number(funnel.refundRatePct).toFixed(2)}%</strong></div></div>
      </div>
    </section>
  );
}
