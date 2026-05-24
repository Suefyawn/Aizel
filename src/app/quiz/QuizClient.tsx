'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { QUESTIONS, scoreAnswers, type ScoredResult } from '@/lib/quiz';
import type { Product } from '@/types';

interface Props {
  products: Product[];
}

// Single-route, multi-step quiz. State stays in React (no URL hash) because:
//   • The quiz is short — five questions on one page that swap in place.
//   • Mid-quiz refreshes lose progress on purpose; otherwise a bookmark
//     could pin the customer to question 3 forever.
//
// Result reveal lives on the same component — the questions transform into
// a "Here's your routine" panel with a curated product rail. No second route
// = no extra navigation latency, no analytics dead-end on bounce.
export function QuizClient({ products }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const total = QUESTIONS.length;
  const current = QUESTIONS[step];

  function pickAnswer(answerId: string) {
    const next = { ...answers, [current.id]: answerId };
    setAnswers(next);
    if (step < total - 1) {
      // Small async hop so the button-press feedback registers before the
      // step transition; otherwise the next question paints mid-tap and
      // the operator can't tell if their tap landed.
      window.requestAnimationFrame(() => setStep(step + 1));
    } else {
      setDone(true);
    }
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function restart() {
    setStep(0);
    setAnswers({});
    setDone(false);
  }

  // ── Result view ───────────────────────────────────────────────────────
  if (done) {
    const result = scoreAnswers(answers);
    return <ResultView products={products} result={result} onRestart={restart} />;
  }

  // ── Quiz view ─────────────────────────────────────────────────────────
  const progressPct = (step / total) * 100;
  const selected = answers[current.id];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>
          Routine Quiz
        </Overline>
        <h1 className="display-l" style={{ fontSize: '2.25rem', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Build your routine in 60 seconds
        </h1>
        <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 460, margin: '0 auto' }}>
          Five questions about your hair. We&apos;ll match you to the right starting
          point from our UK Afro/Black hair-care range.
        </p>
      </div>

      {/* Progress bar — role=progressbar so the aria-label is permitted
          (axe-core flags aria-label on a bare div as aria-prohibited-attr). */}
      <div
        role="progressbar"
        aria-label={`Question ${step + 1} of ${total}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        style={{ height: 4, background: 'var(--paper2)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', marginBottom: 8 }}
      >
        <div style={{
          height: '100%',
          width: `${progressPct}%`,
          background: 'var(--brand-pink)',
          transition: 'width 280ms ease-out',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--ink-500)', marginBottom: 28 }}>
        <span>Question {step + 1} of {total}</span>
        {step > 0 && (
          <button
            type="button"
            onClick={back}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-700)', fontSize: '0.75rem', padding: 0 }}
          >
            ← Back
          </button>
        )}
      </div>

      <div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.625rem', fontWeight: 500,
          margin: '0 0 8px', letterSpacing: '-0.015em', lineHeight: 1.2,
        }}>
          {current.prompt}
        </h2>
        {current.helper && (
          <p className="small-text" style={{ color: 'var(--ink-500)', marginBottom: 20 }}>
            {current.helper}
          </p>
        )}

        <div role="radiogroup" aria-label={current.prompt} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {current.answers.map(a => {
            const isSelected = selected === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => pickAnswer(a.id)}
                style={{
                  textAlign: 'left',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid ' + (isSelected ? 'var(--brand-pink)' : 'var(--line)'),
                  background: isSelected ? 'rgba(107, 44, 145, 0.05)' : 'var(--paper)',
                  fontFamily: 'var(--font-ui)', fontSize: '0.9375rem',
                  color: 'var(--ink-900)', cursor: 'pointer',
                  fontWeight: isSelected ? 600 : 500,
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'border-color 160ms, background 160ms',
                  minHeight: 56,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 18, height: 18, borderRadius: '50%',
                    border: '2px solid ' + (isSelected ? 'var(--brand-pink)' : 'var(--ink-500)'),
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: isSelected ? 'var(--brand-pink)' : 'transparent',
                  }}
                >
                  {isSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </span>
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Result view ────────────────────────────────────────────────────────
function ResultView({ products, result, onRestart }: {
  products: Product[];
  result: ScoredResult;
  onRestart: () => void;
}) {
  // Build the curated rail: products whose category matches the top pick,
  // sorted bestsellers-first so the highest-confidence picks lead, then
  // a runner-up rail per `alsoConsider`. Capped at 6 to keep the page light.
  const topPicks = useMemo(() => {
    return products
      .filter(p => p.category === result.topCategory)
      .sort((a, b) => Number(b.is_bestseller ?? false) - Number(a.is_bestseller ?? false))
      .slice(0, 6);
  }, [products, result.topCategory]);

  const alsoPicks = useMemo(() => {
    return result.alsoConsider
      .map(cat => ({
        cat,
        items: products.filter(p => p.category === cat).slice(0, 4),
      }))
      .filter(g => g.items.length > 0);
  }, [products, result.alsoConsider]);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Your routine</Overline>
        <h1 className="display-l" style={{ fontSize: '2.25rem', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Start with <em style={{ fontStyle: 'italic', color: 'var(--brand-pink)' }}>{result.topCategory}</em>
        </h1>
        <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 520, margin: '0 auto 20px' }}>
          {result.summary}
        </p>
        <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            href={`/shop?category=${encodeURIComponent(result.topCategory)}`}
            className="btn-primary"
            style={{ fontSize: '0.8125rem' }}
          >
            See all {result.topCategory.toLowerCase()}
          </Link>
          <button
            type="button"
            onClick={onRestart}
            className="btn-secondary"
            style={{ fontSize: '0.8125rem' }}
          >
            Retake quiz
          </button>
        </div>
      </div>

      {/* Top-pick rail */}
      {topPicks.length > 0 ? (
        <section style={{ marginBottom: 48 }}>
          <Overline style={{ display: 'block', marginBottom: 18, color: 'var(--ink-500)' }}>
            Our picks for you
          </Overline>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(topPicks.length, 3)}, 1fr)`,
              gap: 'var(--gutter)',
            }}
            className="product-grid"
          >
            {topPicks.map(p => <ProductTile key={p.id} product={p} />)}
          </div>
        </section>
      ) : (
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          background: 'var(--paper2)', borderRadius: 'var(--radius-card)',
          color: 'var(--ink-700)', marginBottom: 32,
        }}>
          <p style={{ margin: '0 0 12px' }}>
            We don&apos;t have any {result.topCategory} in stock right now. Browse the full hair range while we restock.
          </p>
          <Link href="/shop?taxon=hair" className="btn-primary" style={{ fontSize: '0.8125rem' }}>
            Browse hair care
          </Link>
        </div>
      )}

      {/* Runner-up rails */}
      {alsoPicks.length > 0 && (
        <section>
          <Overline style={{ display: 'block', marginBottom: 18, color: 'var(--ink-500)' }}>
            Also worth a look
          </Overline>
          {alsoPicks.map(({ cat, items }) => (
            <div key={cat} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 500,
                  fontSize: '1.125rem', margin: 0,
                }}>
                  {cat}
                </h3>
                <Link
                  href={`/shop?category=${encodeURIComponent(cat)}`}
                  style={{ fontSize: '0.75rem', color: 'var(--brand-pink-text)', textDecoration: 'none', fontWeight: 600 }}
                >
                  See all →
                </Link>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
                  gap: 'var(--gutter)',
                }}
                className="product-grid"
              >
                {items.map(p => <ProductTile key={p.id} product={p} />)}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
