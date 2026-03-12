import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

interface SupplierScore {
  supplier_id: string;
  supplier_name: string;
  overall_score: number; // 0-100
  reliability_score: number; // Based on issue frequency
  quality_score: number; // Based on expiry/damage events
  responsiveness_score: number; // Based on lead times
  product_count: number;
  issues_90d: number;
  expiry_events_90d: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  flags: string[];
}

interface ScorecardReport {
  generated_at: string;
  suppliers: SupplierScore[];
  best_performer: string | null;
  needs_attention: string[];
}

/**
 * Generates composite reliability scores for each supplier
 * based on issue logs, expiry events, and delivery patterns.
 */
export async function generateSupplierScorecard(
  supabase: SupabaseClient<Database>
): Promise<ScorecardReport> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const sinceStr = ninetyDaysAgo.toISOString();

  // Get active suppliers
  const { data: suppliers, error: supError } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('is_active', true);

  if (supError) throw supError;

  // Get products per supplier
  const { data: products } = await supabase
    .from('products')
    .select('id, supplier_id')
    .eq('is_active', true)
    .not('supplier_id', 'is', null);

  const supplierProducts: Record<string, string[]> = {};
  for (const p of products ?? []) {
    if (!p.supplier_id) continue;
    if (!supplierProducts[p.supplier_id]) supplierProducts[p.supplier_id] = [];
    supplierProducts[p.supplier_id].push(p.id);
  }

  // Get supplier-related issues
  const { data: issues } = await supabase
    .from('issues')
    .select('id, issue_type, severity, created_at, description')
    .eq('issue_type', 'supplier')
    .gte('created_at', sinceStr);

  // Get expiry flag events for supplier products
  const { data: expiryEvents } = await supabase
    .from('stock_events')
    .select('product_id, created_at')
    .eq('event_type', 'expiry_flag')
    .gte('created_at', sinceStr);

  const expiryByProduct: Record<string, number> = {};
  for (const e of expiryEvents ?? []) {
    expiryByProduct[e.product_id] = (expiryByProduct[e.product_id] || 0) + 1;
  }

  const scores: SupplierScore[] = [];

  for (const supplier of suppliers ?? []) {
    const productIds = supplierProducts[supplier.id] ?? [];
    const productCount = productIds.length;

    // Reliability: inverse of issue count (fewer issues = higher score)
    const issueCount = issues?.length ?? 0; // All supplier issues (TODO: filter by specific supplier when issue has supplier_id)
    const reliabilityScore = Math.max(0, 100 - issueCount * 10);

    // Quality: based on expiry events for this supplier's products
    let totalExpiry = 0;
    for (const pid of productIds) {
      totalExpiry += expiryByProduct[pid] ?? 0;
    }
    const expiryRate = productCount > 0 ? totalExpiry / productCount : 0;
    const qualityScore = Math.max(0, 100 - expiryRate * 20);

    // Responsiveness: placeholder (would need delivery tracking data)
    // Default to 80 as baseline
    const responsivenessScore = 80;

    // Overall composite score
    const overall = Math.round(
      reliabilityScore * 0.4 + qualityScore * 0.35 + responsivenessScore * 0.25
    );

    // Grade
    const grade: SupplierScore['grade'] =
      overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 40 ? 'D' : 'F';

    // Flags
    const flags: string[] = [];
    if (issueCount >= 5) flags.push(`${issueCount} supplier issues in 90 days`);
    if (totalExpiry >= 10) flags.push(`${totalExpiry} products flagged for expiry`);
    if (productCount === 0) flags.push('No active products linked');

    scores.push({
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      overall_score: overall,
      reliability_score: Math.round(reliabilityScore),
      quality_score: Math.round(qualityScore),
      responsiveness_score: responsivenessScore,
      product_count: productCount,
      issues_90d: issueCount,
      expiry_events_90d: totalExpiry,
      grade,
      flags,
    });
  }

  // Sort by overall score descending
  scores.sort((a, b) => b.overall_score - a.overall_score);

  return {
    generated_at: new Date().toISOString(),
    suppliers: scores,
    best_performer: scores.length > 0 ? scores[0].supplier_name : null,
    needs_attention: scores.filter((s) => s.grade === 'D' || s.grade === 'F').map((s) => s.supplier_name),
  };
}
