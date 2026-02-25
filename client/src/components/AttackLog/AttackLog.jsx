import { useState, useEffect } from "react";
import { attackAPI } from "../../services/api";
import { useApp } from "../../context/AppContext";
import "./AttackLog.css";

export default function AttackLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const { lastAttack } = useApp() || {};

  useEffect(() => { loadLogs(); }, []);
  useEffect(() => { if (lastAttack) loadLogs(); }, [lastAttack]);

  const loadLogs = async () => {
    const res = await attackAPI.getLogs({ limit: 50 });
    setLogs(res.data.data);
    setTotal(res.data.total);
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all attack logs?")) return;
    await attackAPI.clearLogs();
    setLogs([]);
    setTotal(0);
  };

  return (
    <div className="attack-log">
      <div className="log-header card">
        <div>
          <h2>📋 Attack Logs</h2>
          <p>{total} total attack attempts recorded</p>
        </div>
        <button className="btn btn-danger" onClick={handleClear}>🗑️ Clear All Logs</button>
      </div>

      <div className="card">
        <table className="log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Attack Type</th>
              <th>Attacker</th>
              <th>Contract</th>
              <th>Detected At</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className={log.blocked ? "" : "attack-succeeded"}>
                <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td><span className="attack-type">{log.attackType?.replace(/_/g, " ")}</span></td>
                <td className="mono">{log.attackerAddress?.substring(0, 12)}...</td>
                <td><span className={`badge badge-${log.contractType === "secure" ? "success" : "warning"}`}>{log.contractType}</span></td>
                <td><span className="badge badge-blue">{log.detectedAt}</span></td>
                <td>
                  <span className={`badge badge-${log.blocked ? "success" : "danger"}`}>
                    {log.blocked ? "🛡️ Blocked" : "❌ Succeeded"}
                  </span>
                </td>
                <td className="reason-cell">{log.reason}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#4b5563", padding: "40px" }}>
                No attack logs. Use the Attack Simulator to generate some!
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}