'use client';

import { useActionState, useMemo, useState } from 'react';
import Image from 'next/image';
import { submitReview, voteReviewHelpful } from '@/app/product/[slug]/actions';

interface Review {
  id: string;
  author_name: string;
  rating: number;
  body: string;
  created_at: string;
  photo_urls?: string[] | null;
  verified_purchase?: boolean;
  helpful_count?: number;
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= rating ? '#F7C948' : '#e5e7eb'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

// 1-to-5 star rating input. Stars render left-to-right 1…5; clicking the
// Nth star records rating N. Fill is driven by React state (hover OR the
// chosen rating), so it lights cumulatively 1…N. The old version rendered
// the stars reversed ([5,4,3,2,1]) and walked the wrong DOM siblings, so a
// 5-star click was saved as a 1-star review.
function StarPicker({ name }: { name: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const active = hover || rating;
  return (
    <div style={{ display: 'flex', gap: 4 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(v => (
        <label key={v} style={{ cursor: 'pointer', lineHeight: 0 }} onMouseEnter={() => setHover(v)}>
          <input
            type="radio" name={name} value={v} required
            onChange={() => setRating(v)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
          <svg width="28" height="28" viewBox="0 0 24 24"
            fill={v <= active ? '#F7C948' : '#e5e7eb'}
            style={{ display: 'block', transition: 'fill 0.1s' }}
            role="img"
            aria-label={`${v} star${v > 1 ? 's' : ''}`}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </label>
      ))}
    </div>
  );
}

type SortKey = 'recent' | 'helpful' | 'highest' | 'lowest';

// ─── Helpful-vote button (server action through wrapper) ───────────────────
function HelpfulButton({ reviewId, initialCount }: { reviewId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={voted || pending}
      onClick={async () => {
        setPending(true);
        const res = await voteReviewHelpful(reviewId);
        if (res.ok) {
          setVoted(true);
          if (typeof res.count === 'number') setCount(res.count);
        }
        setPending(false);
      }}
      style={{
        background: voted ? '#f0fdf4' : 'transparent',
        border: '1px solid', borderColor: voted ? '#bbf7d0' : 'var(--line)',
        color: voted ? '#15803d' : 'var(--ink-700)',
        borderRadius: 100, fontSize: '0.75rem', padding: '4px 12px',
        cursor: voted ? 'default' : 'pointer',
      }}
    >
      {voted ? '✓ Helpful' : '👍 Helpful'} {count > 0 && <span>({count})</span>}
    </button>
  );
}

// ─── Review-photo uploader ──────────────────────────────────────────────────
function ReviewPhotoUploader({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const MAX = 4;

  async function handleUpload(file: File) {
    setUploading(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/review', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      onChange([...urls, json.url].slice(0, MAX));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        Photos (optional)
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {urls.map((u, i) => (
          <div key={u} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <Image src={u} alt={`Review photo ${i + 1}`} fill sizes="64px" style={{ objectFit: 'cover' }} />
            <button
              type="button"
              onClick={() => onChange(urls.filter(x => x !== u))}
              aria-label="Remove photo"
              style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, lineHeight: 1 }}
            >×</button>
          </div>
        ))}
        {urls.length < MAX && (
          <label style={{
            width: 64, height: 64, borderRadius: 8, border: '1px dashed var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer', color: 'var(--ink-500)', fontSize: 20,
          }}>
            {uploading ? '…' : '+'}
            <input
              type="file" accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ''; }}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>
      {err && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>{err}</p>}
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────
export function ReviewsSection({ productId, reviews, photosEnabled = true }: { productId: string; reviews: Review[]; photosEnabled?: boolean }) {
  const [state, action, pending] = useActionState(submitReview, null);
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const stats = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];   // index 0 = 1 star … 4 = 5 star
    let sum = 0;
    for (const r of reviews) {
      buckets[Math.max(1, Math.min(5, r.rating)) - 1]++;
      sum += r.rating;
    }
    const total = reviews.length;
    const avg = total > 0 ? sum / total : 0;
    return { buckets, total, avg };
  }, [reviews]);

  const sorted = useMemo(() => {
    const cp = [...reviews];
    if (sortBy === 'recent')   return cp.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sortBy === 'helpful')  return cp.sort((a, b) => (b.helpful_count ?? 0) - (a.helpful_count ?? 0));
    if (sortBy === 'highest')  return cp.sort((a, b) => b.rating - a.rating);
    if (sortBy === 'lowest')   return cp.sort((a, b) => a.rating - b.rating);
    return cp;
  }, [reviews, sortBy]);

  return (
    <section id="reviews" style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)', scrollMarginTop: 80 }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }} className="duo-grid">

          {/* Left: review list + histogram */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500, margin: 0 }}>
                Customer Reviews
              </h2>
              {stats.total > 0 && (
                <span style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>
                  ({stats.total} review{stats.total !== 1 ? 's' : ''})
                </span>
              )}
            </div>

            {stats.total > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 24, marginBottom: 28, padding: '16px 20px', background: 'var(--paper2)', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 500, lineHeight: 1 }}>
                    {stats.avg.toFixed(1)}
                  </div>
                  <Stars rating={Math.round(stats.avg)} size={18} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 4 }}>
                    Based on {stats.total} review{stats.total !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = stats.buckets[star - 1];
                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--ink-700)' }}>
                        <span style={{ width: 20 }}>{star}★</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-yellow)' }} />
                        </div>
                        <span style={{ width: 24, textAlign: 'right', color: 'var(--ink-500)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stats.total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className="small-text">{sorted.length} review{sorted.length !== 1 ? 's' : ''}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="small-text">Sort</span>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={{
                    padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6,
                    background: 'var(--paper)', fontFamily: 'var(--font-ui)', fontSize: '0.75rem',
                  }}>
                    <option value="recent">Most recent</option>
                    <option value="helpful">Most helpful</option>
                    <option value="highest">Highest rated</option>
                    <option value="lowest">Lowest rated</option>
                  </select>
                </div>
              </div>
            )}

            {stats.total === 0 ? (
              <div style={{
                padding: '32px 24px', textAlign: 'center',
                background: 'var(--paper2)', borderRadius: 'var(--radius-card)', border: '1px dashed var(--line)',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.45 }}>✦</div>
                <p style={{ margin: 0, color: 'var(--ink-700)', fontSize: '0.9375rem', fontWeight: 600 }}>
                  No reviews yet
                </p>
                <p style={{ margin: '4px 0 0', color: 'var(--ink-500)', fontSize: '0.8125rem' }}>
                  Tried it? Write the first review — other shoppers count on it.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {sorted.map(r => (
                  <div key={r.id} style={{ padding: '16px 20px', background: 'white', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-pink-cta)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.875rem' }}>
                          {r.author_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.author_name}</span>
                            {r.verified_purchase && (
                              <span title="Verified purchase" style={{
                                fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px',
                                background: '#f0fdf4', color: '#15803d',
                                border: '1px solid #bbf7d0', borderRadius: 4,
                              }}>VERIFIED</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Stars rating={r.rating} size={14} />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-700)', lineHeight: 1.6 }}>{r.body}</p>
                    {r.photo_urls && r.photo_urls.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {r.photo_urls.map((u, i) => (
                          <div key={u} style={{ position: 'relative', width: 64, height: 64, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
                            <Image src={u} alt={`Review photo ${i + 1}`} fill sizes="64px" style={{ objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)' }}>
                        {new Date(r.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <HelpfulButton reviewId={r.id} initialCount={r.helpful_count ?? 0} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: write a review */}
          <div style={{ position: 'sticky', top: 100 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500, margin: '0 0 24px' }}>
              Write a Review
            </h2>

            {state && 'success' in state ? (
              <div style={{ padding: '20px 24px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 'var(--radius-card)', color: '#166534', fontWeight: 600 }}>
                Thank you! Your review has been submitted and will appear after approval.
              </div>
            ) : (
              <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <input type="hidden" name="product_id" value={productId} />
                <input type="hidden" name="photo_urls" value={photoUrls.join(',')} />

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Your Rating
                  </label>
                  <StarPicker name="rating" />
                </div>

                <div className="duo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="review-author-name" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Name *</label>
                    <input id="review-author-name" name="author_name" required autoComplete="name" placeholder="Your name" style={inp} />
                  </div>
                  <div>
                    <label htmlFor="review-reviewer-email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email (for verified badge)</label>
                    <input id="review-reviewer-email" name="reviewer_email" type="email" autoComplete="email" placeholder="you@example.com" style={inp} />
                  </div>
                </div>

                <div>
                  <label htmlFor="review-body" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Review *</label>
                  <textarea
                    id="review-body"
                    name="body" required minLength={10} rows={4}
                    placeholder="Share your experience with this product..."
                    style={{ ...inp, resize: 'vertical' }}
                  />
                </div>

                {photosEnabled && <ReviewPhotoUploader urls={photoUrls} onChange={setPhotoUrls} />}

                {state && 'error' in state && state.error && (
                  <p style={{ margin: 0, color: '#ef4444', fontSize: '0.8125rem' }}>{state.error}</p>
                )}

                <button type="submit" disabled={pending} className="btn-primary" style={{ alignSelf: 'flex-start', opacity: pending ? 0.6 : 1 }}>
                  {pending ? 'Submitting…' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
