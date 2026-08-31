import type { Backend } from './types';
import { createDemoBackend } from './demoBackend';
import { createSupabaseBackend, hasSupabaseConfig } from './supabaseBackend';

/**
 * 有設定環境變數就連真的 Supabase,沒有就退回 demo。
 * 這樣你可以先把網站部署上 Vercel 給人看,之後再補上環境變數切成真實模式。
 */
export const backend: Backend = hasSupabaseConfig ? createSupabaseBackend() : createDemoBackend();

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // 中文取最後一個字,英文取首字母
  return /[\u4e00-\u9fff]/.test(trimmed) ? trimmed.slice(-1) : trimmed[0].toUpperCase();
}

export function shortTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}
