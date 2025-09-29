import { useParams, useNavigate, Link } from 'react-router-dom';
// import { products } from '../data/products.js'; // replaced by API
import { api, mapProductResponse } from '../services/api.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useState, useMemo, useEffect, useCallback } from 'react';
import QuantityStepper from '../components/QuantityStepper.jsx';
import ImageWithFallback from '../components/ImageWithFallback.jsx';
import { useCurrencyFormatter } from '../context/SettingsContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import RatingStars from '../components/RatingStars.jsx';
import PaginationBar from '../components/PaginationBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(null);
  const { user, isAuthenticated } = useAuth();
  const ratingPageSize = 5;
  const [ratingSummary, setRatingSummary] = useState(null);
  const [ratingSummaryLoading, setRatingSummaryLoading] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState(null);
  const [ratingMeta, setRatingMeta] = useState({ page: 0, size: ratingPageSize, totalPages: 0, totalElements: 0, first: true, last: true });
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingForm, setRatingForm] = useState({ rating: 5, title: '', comment: '', name: '' });
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const productId = product?.id;
  const { addItem } = useCart();
  const { push } = useToast();

  const refreshRatingSummary = useCallback(async () => {
    if (!productId) return;
    setRatingSummaryLoading(true);
    try {
      const data = await api.products.ratings.summary(productId);
      setRatingSummary(data);
    } catch (err) {
      setRatingSummary(null);
    } finally {
      setRatingSummaryLoading(false);
    }
  }, [productId]);

  const loadRatings = useCallback(async (page = 0) => {
    if (!productId) return;
    setRatingsLoading(true);
    setRatingsError(null);
    try {
      const res = await api.products.ratings.list(productId, { page, size: ratingPageSize });
      const content = Array.isArray(res?.content) ? res.content : [];
      const currentPage = Number.isFinite(res?.page) ? res.page : page;
      const size = Number.isFinite(res?.size) ? res.size : ratingPageSize;
      const totalElements = Number.isFinite(res?.totalElements) ? res.totalElements : content.length;
      const totalPages = Number.isFinite(res?.totalPages)
        ? res.totalPages
        : (totalElements > 0 ? Math.max(currentPage + 1, Math.ceil(totalElements / Math.max(size, 1))) : 0);
      const first = res?.first ?? currentPage === 0;
  const last = res?.last ?? (totalPages === 0 || currentPage >= totalPages - 1);

      setRatings(content);
      setRatingMeta({
        page: currentPage,
        size,
        totalPages,
        totalElements,
        first,
        last,
      });
    } catch (err) {
      setRatingsError(err?.message || 'Failed to load product ratings.');
    } finally {
      setRatingsLoading(false);
    }
  }, [productId, ratingPageSize]);

  const handleRatingFieldChange = useCallback((field) => (event) => {
    const value = event?.target?.value ?? '';
    setRatingForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleRatingScoreChange = useCallback((score) => {
    setRatingForm(prev => ({ ...prev, rating: score }));
  }, []);

  const handleRatingSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!productId || ratingSubmitting) return;
    if (!ratingForm.rating || ratingForm.rating < 1) {
      push('Please select a rating.', 'error');
      return;
    }
    if (!isAuthenticated) {
      const name = ratingForm.name?.trim();
      if (!name) {
        push('Please enter your name so we can display your review.', 'error');
        return;
      }
    }

    const payload = {
      rating: Number(ratingForm.rating),
      title: ratingForm.title?.trim() || null,
      comment: ratingForm.comment?.trim() || null,
    };
    if (!isAuthenticated && ratingForm.name?.trim()) {
      payload.name = ratingForm.name.trim();
    }

    try {
      setRatingSubmitting(true);
      await api.products.ratings.create(productId, payload);
      push('Thanks for sharing your review!', 'info');
      setRatingForm({ rating: 5, title: '', comment: '', name: '' });
      setShowRatingForm(false);
      await Promise.all([refreshRatingSummary(), loadRatings(0)]);
    } catch (err) {
      push(err?.message || 'Could not submit your rating right now.', 'error');
    } finally {
      setRatingSubmitting(false);
    }
  }, [productId, ratingSubmitting, ratingForm, isAuthenticated, push, refreshRatingSummary, loadRatings]);

  const handleRatingsPageChange = useCallback((nextPage) => {
    loadRatings(nextPage);
  }, [loadRatings]);

  const formatDate = useCallback((isoString) => {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  }, []);
  useEffect(()=>{
    let active=true;
    api.products.get(id)
      .then(p => { if(!active) return; setProduct(mapProductResponse(p)); setLoading(false); })
      .catch(e => { if(!active) return; setError(e.message); setLoading(false); });
    return ()=>{ active=false; };
  },[id]);
  useEffect(() => {
    if (!product?.id) {
      setRelatedProducts([]);
      setRelatedLoading(false);
      setRelatedError(null);
      return;
    }
    let active = true;
    setRelatedLoading(true);
    setRelatedError(null);
    api.products.related(product.id, { limit: 6 })
      .then(res => {
        if (!active) return;
        const rawList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const mapped = rawList.map(mapProductResponse).filter(p => p.id !== product.id);
        setRelatedProducts(mapped);
        setRelatedLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setRelatedError(err.message);
        setRelatedLoading(false);
      });
    return () => { active = false; };
  }, [product?.id]);

  useEffect(() => {
    if (!productId) {
      setRatingSummary(null);
      setRatings([]);
      setRatingsError(null);
      setRatingMeta(prev => ({ ...prev, page: 0, totalPages: 0, totalElements: 0, first: true, last: true }));
      return;
    }
    refreshRatingSummary();
    loadRatings(0);
  }, [productId, refreshRatingSummary, loadRatings]);
  const [qty, setQty] = useState(1);
  const formatCurrency = useCurrencyFormatter();
  const subtotal = useMemo(()=> qty * (product?.price || 0), [qty, product]);
  const ratingDistribution = useMemo(() => {
    const summary = ratingSummary;
    const distribution = summary?.distribution ?? {};
    const total = summary?.count ?? 0;
    return [5, 4, 3, 2, 1].map(star => {
      const count = Number(distribution[star] ?? 0);
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { star, count, percentage };
    });
  }, [ratingSummary]);

  const verifiedShare = useMemo(() => {
    if (!ratingSummary?.count) return 0;
    const verifiedCount = Number(ratingSummary.verifiedCount ?? 0);
    return Math.round((verifiedCount / Math.max(ratingSummary.count, 1)) * 100);
  }, [ratingSummary]);

  if (loading) return <section className="container py-4"><p>Loading product...</p></section>;
  if (error) return <section className="container py-4"><p className="text-danger">{error}</p><button className="btn btn-secondary" onClick={()=>navigate(-1)}>Back</button></section>;
  if (!product) return <section className="container py-4"><p>Product not found.</p><button className="btn btn-secondary" onClick={()=>navigate(-1)}>Back</button></section>;

  function addAndGo() {
    addItem(product, qty);
    push(`${product.name} x${qty} added to cart`);
  }

  return (
    <section className="container py-4">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb small mb-0">
          <li className="breadcrumb-item"><Link to="/">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/products">Products</Link></li>
          <li className="breadcrumb-item active" aria-current="page">{product.name}</li>
        </ol>
      </nav>
      <div className="row g-4 align-items-start">
        <div className="col-12 col-md-5">
          <div className="border rounded p-3 bg-body h-100">
            {product.images && product.images.length > 1 ? <ImageCarousel product={product} /> : (
              <div className="text-center">
                <ImageWithFallback
                  src={product.image}
                  alt={product.name}
                  style={{width:'100%', maxHeight: 360, objectFit:'contain'}}
                  className="mx-auto"
                  placeholder={<span style={{fontSize:'4rem'}}>🧺</span>}
                />
              </div>
            )}
          </div>
        </div>
        <div className="col-12 col-md-7">
          <h1 className="h3 mb-2">{product.name}</h1>
          {product.brand && <p className="text-uppercase text-success small mb-2">Brand: {product.brand}</p>}
          <div className="mb-3">
            {ratingSummaryLoading ? (
              <span className="placeholder-glow"><span className="placeholder col-3"></span></span>
            ) : ratingSummary?.count > 0 ? (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <RatingStars value={ratingSummary.average} count={ratingSummary.count} size="md" showCount readOnly />
                <span className="text-muted small">{Number(ratingSummary.average ?? 0).toFixed(1)} average</span>
                {ratingSummary.verifiedCount > 0 && (
                  <span className="badge text-bg-success-subtle text-success-emphasis">
                    {ratingSummary.verifiedCount} verified
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted small">No ratings yet</span>
            )}
          </div>
          <p className="text-muted small mb-3">{product.description}</p>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <p className="fs-5 fw-semibold mb-0">{formatCurrency(product.price)}{product.unit ? <span className="text-secondary">/{product.unit}</span> : null}</p>
            {product.stock !== undefined && (
              <span className={`badge ${product.stock > 0 ? 'text-bg-success' : 'text-bg-danger'}`}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
            )}
          </div>
          <div className="d-flex flex-column flex-sm-row gap-3 align-items-stretch align-items-sm-end">
            <div className="flex-grow-1">
              <label className="form-label small mb-1">Quantity</label>
              <QuantityStepper value={qty} onChange={setQty} ariaLabel="Quantity" />
              <div className="form-text">Subtotal: {formatCurrency(subtotal)}</div>
            </div>
            <div className="d-flex flex-column gap-2 flex-sm-row flex-sm-wrap">
              <button className="btn btn-success w-100" onClick={addAndGo} disabled={product.stock === 0}>Add to Cart</button>
              <button className="btn btn-outline-primary w-100" onClick={()=>navigate('/cart')}>Go to Cart</button>
              <button className="btn btn-outline-secondary w-100" onClick={()=>navigate(-1)}>Back</button>
            </div>
          </div>
        </div>
      </div>
      <section className="mt-5" id="product-reviews">
        <div className="card border-0 shadow-sm">
          <div className="card-body d-flex flex-column gap-4">
            <div className="d-flex flex-column flex-lg-row gap-4 align-items-start align-items-lg-center justify-content-between">
              <div className="flex-grow-1">
                <h2 className="h5 mb-2">Customer Reviews</h2>
                {ratingSummaryLoading ? (
                  <div className="placeholder-glow">
                    <span className="placeholder col-3"></span>
                  </div>
                ) : ratingSummary?.count > 0 ? (
                  <div className="d-flex flex-column flex-md-row gap-4 align-items-start">
                    <div>
                      <div className="display-6 fw-semibold mb-1">{Number(ratingSummary.average ?? 0).toFixed(1)}</div>
                      <RatingStars value={ratingSummary.average} count={ratingSummary.count} size="lg" showCount readOnly />
                      <p className="text-muted small mb-1">Based on {ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'}</p>
                      {ratingSummary.verifiedCount > 0 && (
                        <p className="text-muted small mb-0">Verified purchases: {ratingSummary.verifiedCount} ({verifiedShare}% of reviews)</p>
                      )}
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: '220px', maxWidth: '380px' }}>
                      {ratingDistribution.map(row => (
                        <div key={row.star} className="d-flex align-items-center gap-2 mb-1">
                          <span className="small" style={{ width: '36px' }}>{row.star}★</span>
                          <div className="progress flex-grow-1" style={{ height: '8px', backgroundColor: 'var(--border)' }}>
                            <div className="progress-bar bg-warning" role="progressbar" style={{ width: `${row.percentage}%` }} aria-valuenow={row.percentage} aria-valuemin="0" aria-valuemax="100"></div>
                          </div>
                          <span className="small text-muted" style={{ width: '48px', textAlign: 'right' }}>{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted small mb-0">No reviews yet. Be the first to share your thoughts!</p>
                )}
              </div>
              <div className="d-flex flex-column gap-2 align-items-start">
                <button type="button" className="btn btn-outline-success" onClick={() => setShowRatingForm(s => !s)}>
                  {showRatingForm ? 'Cancel review' : 'Write a review'}
                </button>
                {!isAuthenticated && <span className="text-muted small">No account? Leave your name and rating.</span>}
                {isAuthenticated && <span className="text-muted small">Signed in as {user?.name || user?.email}.</span>}
              </div>
            </div>

            {showRatingForm && (
              <form onSubmit={handleRatingSubmit} className="border rounded p-3 bg-body-tertiary vstack gap-3">
                <div>
                  <label className="form-label small mb-1">Your rating</label>
                  <RatingStars value={ratingForm.rating} onChange={handleRatingScoreChange} size="lg" />
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small" htmlFor="reviewTitle">Title (optional)</label>
                    <input id="reviewTitle" type="text" maxLength={160} className="form-control" value={ratingForm.title} onChange={handleRatingFieldChange('title')} placeholder="e.g. Great quality and freshness" />
                  </div>
                  {!isAuthenticated && (
                    <div className="col-12 col-md-6">
                      <label className="form-label small" htmlFor="reviewerName">Name</label>
                      <input id="reviewerName" type="text" maxLength={160} required className="form-control" value={ratingForm.name} onChange={handleRatingFieldChange('name')} placeholder="Jane Doe" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label small" htmlFor="reviewComment">Comment (optional)</label>
                  <textarea id="reviewComment" rows={4} className="form-control" maxLength={2000} value={ratingForm.comment} onChange={handleRatingFieldChange('comment')} placeholder="Share any details that would help other shoppers."></textarea>
                  <div className="form-text">Up to 2000 characters.</div>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => { setShowRatingForm(false); setRatingForm({ rating: 5, title: '', comment: '', name: '' }); }} disabled={ratingSubmitting}>Cancel</button>
                  <button type="submit" className="btn btn-success" disabled={ratingSubmitting}>
                    {ratingSubmitting ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
                    Submit review
                  </button>
                </div>
              </form>
            )}

            <div>
              <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                <h3 className="h6 m-0">Recent feedback</h3>
                {ratingSummary?.count > 0 && <span className="badge text-bg-light">{ratingMeta.totalElements} review{ratingMeta.totalElements === 1 ? '' : 's'}</span>}
              </div>
              {ratingsLoading ? (
                <div className="vstack gap-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="border rounded p-3">
                      <div className="placeholder-glow">
                        <span className="placeholder col-2"></span>
                        <span className="placeholder col-4"></span>
                        <span className="placeholder col-8"></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : ratingsError ? (
                <div className="alert alert-warning" role="alert">{ratingsError}</div>
              ) : ratings.length === 0 ? (
                <p className="text-muted small mb-0">No reviews yet.</p>
              ) : (
                <div className="vstack gap-3">
                  {ratings.map(rating => (
                    <article key={rating.id} className="border rounded p-3 bg-body-tertiary">
                      <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                        <div>
                          <strong>{rating.customerName || rating.user?.name || 'Anonymous shopper'}</strong>
                          {rating.createdAt && (
                            <div className="text-muted small">{formatDate(rating.createdAt)}</div>
                          )}
                        </div>
                        <RatingStars value={rating.rating} size="sm" readOnly />
                      </div>
                      {rating.title && <p className="fw-semibold mb-1">{rating.title}</p>}
                      {rating.comment && <p className="mb-2">{rating.comment}</p>}
                      <div className="d-flex flex-wrap gap-2 small text-muted">
                        {rating.isVerified && <span className="badge text-bg-success-subtle text-success-emphasis">Verified purchase</span>}
                        {rating.isFlagged && <span className="badge text-bg-warning-subtle text-warning-emphasis">Flagged</span>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <PaginationBar
                page={ratingMeta.page}
                size={ratingMeta.size}
                totalElements={ratingMeta.totalElements}
                totalPages={Math.max(ratingMeta.totalPages, ratingMeta.totalElements > 0 ? 1 : 0)}
                first={ratingMeta.first}
                last={ratingMeta.last}
                onPageChange={handleRatingsPageChange}
                alwaysVisible={ratingMeta.totalPages > 1}
              />
            </div>
          </div>
        </div>
      </section>
      <div className="mt-5">
        <h2 className="h5 mb-3">You might also like</h2>
        {relatedLoading ? (
          <p className="text-muted">Loading related products…</p>
        ) : relatedError ? (
          <p className="text-danger small">{relatedError}</p>
        ) : relatedProducts.length === 0 ? (
          <p className="text-muted">No related products to show right now.</p>
        ) : (
          <div className="row g-3">
            {relatedProducts.map(rp => (
              <div key={rp.id} className="col-6 col-md-4 col-lg-3">
                <ProductCard product={rp} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ImageCarousel({ product }) {
  const [idx, setIdx] = useState(0);
  const images = product.images || [];
  const maxH = 360;
  function prev(){ setIdx(i => (i === 0 ? images.length - 1 : i - 1)); }
  function next(){ setIdx(i => (i === images.length - 1 ? 0 : i + 1)); }
  return (
    <div>
      <div className="position-relative text-center mb-2">
        <ImageWithFallback
          src={images[idx]}
          alt={product.name}
          style={{width:'100%', maxHeight: maxH, objectFit:'contain'}}
          className="mx-auto"
          placeholder={<span style={{fontSize:'4rem'}}>🧺</span>}
        />
        {images.length > 1 && (
          <>
            <button type="button" className="btn btn-sm btn-light position-absolute top-50 start-0 translate-middle-y" onClick={prev} aria-label="Previous image">‹</button>
            <button type="button" className="btn btn-sm btn-light position-absolute top-50 end-0 translate-middle-y" onClick={next} aria-label="Next image">›</button>
            <div className="position-absolute bottom-0 start-50 translate-middle-x d-flex gap-1 mb-1">
              {images.map((_, i) => (
                <button key={i} type="button" aria-label={`Go to image ${i+1}`} onClick={()=>setIdx(i)} className={"p-0 border-0 bg-transparent"}>
                  <span style={{display:'block', width:8, height:8, borderRadius:'50%', background: i===idx ? 'var(--bs-success)' : 'rgba(0,0,0,.3)'}}></span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          {images.map((img,i)=>(
            <button key={i} type="button" onClick={()=>setIdx(i)} className={`border rounded p-1 bg-white ${i===idx? 'border-success':''}`} style={{width:64,height:64}} aria-label={`Select image ${i+1}`}>
              <img src={img} alt="thumb" style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
