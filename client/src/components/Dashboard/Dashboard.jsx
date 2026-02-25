import { useEffect } from "react";
import { useApp } from "../../context/AppContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import "./Dashboard.css";

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"];

export default function Dashboard() {
  const { stats, fetchStats, notifications, dismissNotification } = useApp();

  useEffect(() => { fetchStats(); }, []);

  if (!stats) return <div className="loading">Loading dashboard...</div>;

  const attackTypeData = (stats.attacks.byType || []).map((a) => ({
    name: a._id?.replace(/_/g, " ") || "Unknown",
    count: a.count,
  }));

  const overviewData = [
    { name: "Total Txns", value: stats.transactions.total },
    { name: "Successful", value: stats.transactions.successful },
    { name: "Attacks", value: stats.attacks.total },
    { name: "Blocked", value: stats.attacks.blocked },
  ];

  return (
    <div className="dashboard">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="notifications">
          {notifications.slice(0, 3).map((n) => (
            <div key={n.id} className={`notification ${n.type}`}>
              <span>{n.message}</span>
              <button onClick={() => dismissNotification(n.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div className="stat-grid">
        <StatCard title="Total Transactions" value={stats.transactions.total} icon="💸" color="blue" />
        <StatCard title="Attacks Detected" value={stats.attacks.total} icon="🚨" color="red" />
        <StatCard title="Attacks Blocked" value={stats.attacks.blocked} icon="🛡️" color="green" />
        <StatCard
          title="Block Rate"
          value={`${stats.attacks.blockRate}%`}
          icon="📊"
          color={stats.attacks.blockRate >= 80 ? "green" : "red"}
        />
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="card">
          <h3 className="chart-title">Transaction Overview</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={overviewData}>
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="chart-title">Attack Types Distribution</h3>
          {attackTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={attackTypeData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {attackTypeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No attacks recorded yet. Try the Attack Simulator!</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-grid">
        <div className="card">
          <h3 className="chart-title">Recent Transactions</h3>
          {stats.recentTransactions.map((tx) => (
            <div key={tx._id} className="recent-item">
              <div>
                <span className="address">{tx.from?.substring(0, 10)}...</span>
                <span className="arrow"> → </span>
                <span className="address">{tx.to?.substring(0, 10)}...</span>
              </div>
              <div className="recent-meta">
                <span className={`badge badge-${tx.status === "success" ? "success" : "danger"}`}>
                  {tx.status}
                </span>
                <span className="amount">{tx.amount} ETH</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="chart-title">Recent Attacks</h3>
          {stats.recentAttacks.length === 0 && <div className="no-data">No attacks yet</div>}
          {stats.recentAttacks.map((log) => (
            <div key={log._id} className="recent-item">
              <div className="attack-type">{log.attackType?.replace(/_/g, " ")}</div>
              <div className="recent-meta">
                <span className={`badge badge-${log.blocked ? "success" : "danger"}`}>
                  {log.blocked ? "Blocked" : "Succeeded"}
                </span>
                <span className="contract-type badge badge-blue">{log.contractType}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
    </div>
  );
}