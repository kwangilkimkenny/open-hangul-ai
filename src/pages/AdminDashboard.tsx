/**
 * Admin Dashboard
 * 관리자 전용 — 사용자/결제/구독/감사로그 조회
 *
 * 접근 권한: profile.plan === 'enterprise' (데모 환경)
 * 운영 환경: 별도 admin role / RLS 정책 필요
 */
import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getSupabase, isSupabaseEnabled } from '../lib/supabase/client';
import PublicHeader from '../components/public/PublicHeader';
import AdminDocs from '../components/admin/AdminDocs';

type Tab = 'overview' | 'users' | 'payments' | 'subscriptions' | 'audit' | 'docs';

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  revenueThisMonth: number;
  failedPayments: number;
}

interface Profile {
  id: string;
  email: string;
  name: string;
  plan: string;
  plan_period: string | null;
  plan_expires_at: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  user_id: string;
  order_id: string;
  provider: string;
  amount: number;
  status: string;
  plan_id: string;
  paid_at: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  period: string;
  status: string;
  current_period_end: string;
  provider: string;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
}

export function AdminDashboard() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeSubscriptions: 0, revenueThisMonth: 0, failedPayments: 0 });
  const [users, setUsers] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  // 어드민 권한 확인 (데모: enterprise 플랜)
  const isAdmin = user?.plan === 'enterprise';

  const loadStats = useCallback(async () => {
    if (!isSupabaseEnabled) {
      // 데모 모드 더미 데이터
      setStats({ totalUsers: 142, activeSubscriptions: 38, revenueThisMonth: 1247000, failedPayments: 3 });
      return;
    }
    const supabase = getSupabase()!;
    const [usersRes, subsRes, paymentsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('payments')
        .select('amount, status')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    const monthRevenue = (paymentsRes.data || [])
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const failed = (paymentsRes.data || []).filter(p => p.status === 'failed').length;

    setStats({
      totalUsers: usersRes.count || 0,
      activeSubscriptions: subsRes.count || 0,
      revenueThisMonth: monthRevenue,
      failedPayments: failed,
    });
  }, []);

  const loadTabData = useCallback(async () => {
    if (!isSupabaseEnabled) {
      // 데모 더미 데이터
      const demo = (n: number, type: string) => Array.from({ length: n }, (_, i) => ({
        id: `${type}-${i}`,
        email: `user${i}@example.com`,
        name: `사용자${i + 1}`,
        plan: ['free', 'personal', 'business'][i % 3],
        plan_period: 'monthly',
        plan_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      })) as any[];

      if (tab === 'users') setUsers(demo(8, 'u'));
      else if (tab === 'payments') {
        setPayments(Array.from({ length: 6 }, (_, i) => ({
          id: `p-${i}`, user_id: `u-${i}`, order_id: `HV-20260411-${i}AB12`,
          provider: i % 2 === 0 ? 'toss' : 'kakao',
          amount: [9900, 99000, 29900][i % 3],
          status: i === 5 ? 'failed' : 'completed',
          plan_id: 'personal', paid_at: new Date().toISOString(),
          created_at: new Date(Date.now() - i * 3600000).toISOString(),
        })));
      } else if (tab === 'subscriptions') {
        setSubscriptions(Array.from({ length: 5 }, (_, i) => ({
          id: `s-${i}`, user_id: `u-${i}`, plan: 'personal', period: 'monthly',
          status: 'active', provider: 'toss',
          current_period_end: new Date(Date.now() + 20 * 86400000).toISOString(),
        })));
      } else if (tab === 'audit') {
        setAuditLogs(Array.from({ length: 10 }, (_, i) => ({
          id: `a-${i}`, user_id: `u-${i}`,
          action: ['payment.completed', 'subscription.renewed', 'login', 'plan.changed'][i % 4],
          resource_type: 'payment', resource_id: `r-${i}`,
          created_at: new Date(Date.now() - i * 1800000).toISOString(),
        })));
      }
      return;
    }

    setLoading(true);
    const supabase = getSupabase()!;

    if (tab === 'users') {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
      setUsers((data as Profile[]) || []);
    } else if (tab === 'payments') {
      const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(50);
      setPayments((data as Payment[]) || []);
    } else if (tab === 'subscriptions') {
      const { data } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(50);
      setSubscriptions((data as Subscription[]) || []);
    } else if (tab === 'audit') {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
      setAuditLogs((data as AuditLog[]) || []);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab !== 'overview') loadTabData(); }, [tab, loadTabData]);

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="admin-page">
        <PublicHeader />
        <div className="admin-denied">
          <h1>접근 권한 없음</h1>
          <p>이 페이지는 관리자(Enterprise 플랜)만 접근할 수 있습니다.</p>
          <a href="/">홈으로 이동</a>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PublicHeader />

      <div className="admin-container">
        <header className="admin-header">
          <h1>관리자 대시보드</h1>
          <span className="mode-badge">{isSupabaseEnabled ? 'PRODUCTION' : 'DEMO'}</span>
        </header>

        {/* 탭 */}
        <nav className="admin-tabs">
          {(['overview', 'users', 'payments', 'subscriptions', 'audit'] as Tab[]).map(t => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {{ overview: '개요', users: '사용자', payments: '결제', subscriptions: '구독', audit: '감사로그' }[t]}
            </button>
          ))}
          <div className="tab-divider" />
          <button
            className={`tab tab-docs ${tab === 'docs' ? 'active' : ''}`}
            onClick={() => setTab('docs')}
          >
            <span className="ref-icon">⌘</span> Reference &rsaquo; Docs
          </button>
        </nav>

        {/* 개요 */}
        {tab === 'overview' && (
          <div className="stats-grid">
            <StatCard label="총 사용자" value={stats.totalUsers.toLocaleString()} icon="👥" color="#2b579a" />
            <StatCard label="활성 구독" value={stats.activeSubscriptions.toLocaleString()} icon="✓" color="#10b981" />
            <StatCard label="이달 매출" value={`₩${stats.revenueThisMonth.toLocaleString()}`} icon="₩" color="#f59e0b" />
            <StatCard label="결제 실패" value={stats.failedPayments.toLocaleString()} icon="!" color="#ef4444" />
          </div>
        )}

        {/* 사용자 테이블 */}
        {tab === 'users' && (
          <Table loading={loading} headers={['이메일', '이름', '플랜', '주기', '만료일', '가입일']}
            rows={users.map(u => [
              u.email,
              u.name,
              <PlanBadge key={u.id} plan={u.plan} />,
              u.plan_period || '-',
              u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString('ko-KR') : '-',
              new Date(u.created_at).toLocaleDateString('ko-KR'),
            ])} />
        )}

        {/* 결제 테이블 */}
        {tab === 'payments' && (
          <Table loading={loading} headers={['주문번호', '사용자', '제공사', '금액', '상태', '플랜', '결제일']}
            rows={payments.map(p => [
              <code key={p.id} style={{ fontSize: 11 }}>{p.order_id}</code>,
              <code key={`u-${p.id}`} style={{ fontSize: 10 }}>{p.user_id.slice(0, 8)}</code>,
              <ProviderBadge key={`pr-${p.id}`} provider={p.provider} />,
              `₩${p.amount.toLocaleString()}`,
              <StatusBadge key={`s-${p.id}`} status={p.status} />,
              p.plan_id,
              p.paid_at ? new Date(p.paid_at).toLocaleString('ko-KR') : '-',
            ])} />
        )}

        {/* 구독 테이블 */}
        {tab === 'subscriptions' && (
          <Table loading={loading} headers={['ID', '사용자', '플랜', '주기', '상태', '제공사', '만료일']}
            rows={subscriptions.map(s => [
              <code key={s.id} style={{ fontSize: 10 }}>{s.id.slice(0, 8)}</code>,
              <code key={`u-${s.id}`} style={{ fontSize: 10 }}>{s.user_id.slice(0, 8)}</code>,
              <PlanBadge key={`p-${s.id}`} plan={s.plan} />,
              s.period === 'monthly' ? '월간' : '연간',
              <StatusBadge key={`st-${s.id}`} status={s.status} />,
              <ProviderBadge key={`pr-${s.id}`} provider={s.provider} />,
              new Date(s.current_period_end).toLocaleDateString('ko-KR'),
            ])} />
        )}

        {/* Reference > Docs */}
        {tab === 'docs' && <AdminDocs />}

        {/* 감사 로그 */}
        {tab === 'audit' && (
          <Table loading={loading} headers={['시간', '사용자', '액션', '리소스']}
            rows={auditLogs.map(l => [
              new Date(l.created_at).toLocaleString('ko-KR'),
              l.user_id ? <code key={l.id} style={{ fontSize: 10 }}>{l.user_id.slice(0, 8)}</code> : '-',
              <code key={`a-${l.id}`} style={{ fontSize: 11, color: '#2b579a' }}>{l.action}</code>,
              `${l.resource_type}/${l.resource_id?.slice(0, 8) || '-'}`,
            ])} />
        )}
      </div>

      <style>{`
        .admin-page {
          min-height: 100vh;
          background: #f9fafb;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
        }
        .admin-container { max-width: 1280px; margin: 0 auto; padding: 32px; }
        .admin-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .admin-header h1 { font-size: 28px; font-weight: 800; margin: 0; color: #111; }
        .mode-badge {
          padding: 4px 10px; background: ${isSupabaseEnabled ? '#10b981' : '#f59e0b'};
          color: #fff; font-size: 11px; font-weight: 700; border-radius: 100px; letter-spacing: 0.5px;
        }
        .admin-tabs {
          display: flex; gap: 4px; background: #fff; padding: 6px;
          border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 24px; width: fit-content;
        }
        .tab {
          padding: 8px 18px; background: none; border: none; font-size: 13px;
          font-weight: 600; color: #6b7280; cursor: pointer; border-radius: 6px;
        }
        .tab.active { background: #2b579a; color: #fff; }
        .tab-divider {
          width: 1px;
          background: #e5e7eb;
          margin: 4px 6px;
        }
        .tab-docs {
          background: #fff7ed !important;
          color: #c2410c !important;
        }
        .tab-docs:hover { background: #fed7aa !important; }
        .tab-docs.active {
          background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%) !important;
          color: #fff !important;
        }
        .ref-icon {
          display: inline-block;
          margin-right: 4px;
          font-weight: 700;
        }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .admin-denied {
          max-width: 480px; margin: 80px auto; padding: 48px;
          background: #fff; border-radius: 12px; text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }
        .admin-denied h1 { font-size: 22px; color: #ef4444; margin: 0 0 8px; }
        .admin-denied p { color: #6b7280; margin: 0 0 24px; }
        .admin-denied a { color: #2b579a; text-decoration: none; font-weight: 600; }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}

// 통계 카드
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      background: '#fff', padding: 24, borderRadius: 12,
      border: '1px solid #e5e7eb', display: 'flex', gap: 16, alignItems: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#111', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

// 테이블
function Table({ headers, rows, loading }: { headers: string[]; rows: React.ReactNode[][]; loading: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={headers.length} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>불러오는 중...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>데이터 없음</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = { free: '#9ca3af', personal: '#2b579a', business: '#7c3aed', enterprise: '#f59e0b' };
  return <span style={{
    padding: '2px 8px', background: colors[plan] || '#9ca3af', color: '#fff',
    fontSize: 10, fontWeight: 700, borderRadius: 10, textTransform: 'uppercase',
  }}>{plan}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: '#10b981', active: '#10b981', pending: '#f59e0b', past_due: '#f59e0b',
    failed: '#ef4444', canceled: '#9ca3af', refunded: '#9ca3af',
  };
  return <span style={{
    padding: '2px 8px', background: `${colors[status] || '#9ca3af'}20`, color: colors[status] || '#9ca3af',
    fontSize: 10, fontWeight: 700, borderRadius: 10,
  }}>{status}</span>;
}

function ProviderBadge({ provider }: { provider: string }) {
  return <span style={{
    padding: '2px 8px', background: provider === 'toss' ? '#0064ff20' : '#fee50020',
    color: provider === 'toss' ? '#0064ff' : '#3c1e1e',
    fontSize: 10, fontWeight: 700, borderRadius: 10, textTransform: 'uppercase',
  }}>{provider}</span>;
}

export default AdminDashboard;
