import { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api.js';

export default function AdminAnalytics(){
  const [stats, setStats] = useState(null);
  const [extended, setExtended] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trendMode, setTrendMode] = useState('daily'); // 'daily' | 'weekly' | 'monthly'

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
          <AnalyticCard title="Total Orders" value={stats.totalOrders} />
          <AnalyticCard title="Revenue" value={`KES ${Number(stats.totalRevenue||0).toFixed(2)}`} />
          <AnalyticCard title="Products" value={stats.totalProducts} />
          <AnalyticCard title="Admins" value={stats.totalAdmins} />
          <AnalyticCard title="Pending" value={stats.pendingOrders} />
          <AnalyticCard title="Processing" value={stats.processingOrders} />
          <AnalyticCard title="Completed" value={stats.completedOrders} />
        </div>
      )}
      {extended && (
        <>
          <section className="mb-5">
            <h2 className="h6 mb-3">Low Stock (≤ threshold)</h2>
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
            <h2 className="h6 mb-3">Top Selling Products</h2>
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
          <RevenueTrendSection trendMode={trendMode} setTrendMode={setTrendMode} analytics={extended} />
          <section className="mb-5">
            <h2 className="h6 mb-3">Order Status Funnel (Snapshot)</h2>
            <StatusFunnel stats={stats} />
          </section>
        </>
      )}
      <section className="mb-5">
        <h2 className="h6 mb-3">Coming Soon</h2>
        <ul className="small text-muted mb-0">
          <li>Average order value vs time</li>
          <li>Repeat customer rate</li>
          <li>Churn & retention metrics</li>
          <li>Order status funnel conversion</li>
        </ul>
      </section>
    </div>
  );
}

function AnalyticCard({ title, value }) {
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="card h-100 shadow-sm">
        <div className="card-body d-flex flex-column justify-content-center text-center py-3">
          <div className="small text-muted mb-1">{title}</div>
          <div className="fw-semibold" style={{fontSize:'1.05rem'}}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({ data, height=160 }) {
  const [hoverKey, setHoverKey] = useState(null);
  const max = Math.max(...data.map(d => Number(d.revenue)), 1);
  return (
    <div className="position-relative">
      <div className="d-flex align-items-end gap-1" style={{height:`${height}px`, overflowX:'auto'}}>
        {data.map(d => {
          const h = (Number(d.revenue)/max)*(height-40); // reserve top space for tooltip
          return (
            <div key={d.key} className="d-flex flex-column align-items-center position-relative" style={{minWidth:'34px'}}
                 onMouseEnter={()=>setHoverKey(d.key)} onMouseLeave={()=>setHoverKey(k=>k===d.key?null:k)}>
              <div className="w-100 rounded-top bg-success position-relative" style={{height:`${h}px`, transition:'height .3s'}} role="img" aria-label={`Revenue ${d.label}: KES ${Number(d.revenue).toFixed(2)}`}></div>
              <small className="text-muted mt-1" style={{fontSize:'0.55rem'}}>{d.label}</small>
              {hoverKey === d.key && (
                <div className="position-absolute translate-middle-x" style={{bottom: h+8, left:'50%', background:'rgba(0,0,0,0.75)', color:'#fff', padding:'2px 6px', borderRadius:'4px', fontSize:'0.6rem', whiteSpace:'nowrap', zIndex:10}}>
                  KES {Number(d.revenue).toFixed(2)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevenueTrendSection({ trendMode, setTrendMode, analytics }) {
  const dailyData = analytics.revenueTrendDaily || analytics.revenueTrend || [];
  const weeklyData = analytics.revenueTrendWeekly || [];
  const monthlyData = analytics.revenueTrendMonthly || [];

  const normalizedDaily = useMemo(()=> dailyData.map(d => ({ key: d.day, label: d.day.slice(5), revenue: d.revenue })), [dailyData]);
  const normalizedWeekly = useMemo(()=> weeklyData.map(w => ({ key: w.weekStart, label: w.weekStart.slice(5), revenue: w.revenue })), [weeklyData]);
  const normalizedMonthly = useMemo(()=> monthlyData.map(m => ({ key: `${m.year}-${String(m.month).padStart(2,'0')}`, label: `${String(m.month).padStart(2,'0')}`, revenue: m.revenue })), [monthlyData]);

  const chartData = trendMode === 'daily' ? normalizedDaily : trendMode === 'weekly' ? normalizedWeekly : normalizedMonthly;

  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const total = chartData.reduce((sum, r) => sum + Number(r.revenue), 0);
    const avg = total / chartData.length;
    const best = chartData.reduce((a,b)=> Number(b.revenue) > Number(a.revenue) ? b : a, chartData[0]);
    return { total, avg, best };
  }, [chartData]);

  const pct = trendMode === 'daily' ? analytics.dailyChangePct : trendMode === 'weekly' ? analytics.weeklyChangePct : analytics.monthlyChangePct;
  const pctBadge = pct == null ? null : (
    <span className={`badge ms-2 ${pct > 0 ? 'text-bg-success':'text-bg-danger'}`}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
  );

  return (
    <section className="mb-5">
      <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
        <h2 className="h6 m-0">Revenue Trend ({trendMode.charAt(0).toUpperCase()+trendMode.slice(1)}) {pctBadge}</h2>
        <div className="btn-group btn-group-sm" role="group" aria-label="Trend granularity">
          <button type="button" className={`btn btn-${trendMode==='daily'?'primary':'outline-primary'}`} onClick={()=>setTrendMode('daily')}>Daily</button>
          <button type="button" className={`btn btn-${trendMode==='weekly'?'primary':'outline-primary'}`} onClick={()=>setTrendMode('weekly')}>Weekly</button>
          <button type="button" className={`btn btn-${trendMode==='monthly'?'primary':'outline-primary'}`} onClick={()=>setTrendMode('monthly')}>Monthly</button>
        </div>
      </div>
      {chartData.length === 0 ? <ChartSkeleton /> : <MiniBarChart data={chartData} />}
      {stats && (
        <div className="row row-cols-2 row-cols-sm-4 g-2 mt-3 small">
          <div className="col"><div className="p-2 bg-body-tertiary rounded">Total<br/><strong>KES {stats.total.toFixed(2)}</strong></div></div>
            <div className="col"><div className="p-2 bg-body-tertiary rounded">Average<br/><strong>KES {stats.avg.toFixed(2)}</strong></div></div>
            <div className="col"><div className="p-2 bg-body-tertiary rounded">Best {trendMode==='daily'?'Day': trendMode==='weekly'?'Week':'Month'}<br/><strong>KES {Number(stats.best.revenue).toFixed(2)}</strong></div></div>
            <div className="col"><div className="p-2 bg-body-tertiary rounded">Points<br/><strong>{chartData.length}</strong></div></div>
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
    { label:'Pending', value: stats.pendingOrders },
    { label:'Processing', value: stats.processingOrders },
    { label:'Completed', value: stats.completedOrders }
  ];
  const max = Math.max(...stages.map(s=>s.value),1);
  return (
    <div className="vstack gap-1" style={{maxWidth:'420px'}}>
      {stages.map(s => (
        <div key={s.label} className="d-flex align-items-center gap-2">
          <div style={{width:'80px'}} className="small text-muted">{s.label}</div>
          <div className="flex-grow-1 bg-body-tertiary rounded position-relative" style={{height:'18px'}}>
            <div className="bg-primary h-100 rounded" style={{width:`${(s.value/max)*100}%`}}></div>
            <div className="position-absolute top-0 start-50 translate-middle-x small" style={{lineHeight:'18px'}}>{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
