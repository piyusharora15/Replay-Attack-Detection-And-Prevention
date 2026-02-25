import { useState, useEffect } from "react";
import { attackAPI, transactionAPI } from "../../services/api";
import { useApp } from "../../context/AppContext";
import "./AttackSimulator.css";

export default function AttackSimulator() {
  const { stats } = useApp();
  const [transactions, setTransactions] = useState([]);
  const [selectedTx, setSelectedTx] = useState("");
  const [attackType, setAttackType] = useState("signature_replay");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const preventionEnabled = stats?.preventionEnabled ?? true;

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    const res = await transactionAPI.getAll({ limit: 20, status: "success" });
    setTransactions(res.data.data.filter((tx) => tx.signature));
  };

  const handleSimulate = async () => {
    if (!selectedTx) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await attackAPI.simulate({ originalTxId: selectedTx, attackType });
      setResult(res.data.data);
    } catch (e) {
      setResult({ error: e.response?.data?.message || e.message });
    }
    setLoading(false);
  };

  return (
    <div className="simulator">
      <div className="sim-header card">
        <div>
          <h2>⚔️ Replay Attack Simulator</h2>
          <p>Select a past transaction and attempt to replay it. Toggle prevention in the navbar to see the difference.</p>
        </div>
        <div className={`prevention-badge ${preventionEnabled ? "on" : "off"}`}>
          {preventionEnabled ? "🛡️ Prevention: ON" : "⚠️ Prevention: OFF — Attacks may succeed!"}
        </div>
      </div>

      <div className="sim-body">
        <div className="card sim-form">
          <h3>Configure Attack</h3>

          <div className="form-group">
            <label>Select Transaction to Replay</label>
            <select value={selectedTx} onChange={(e) => setSelectedTx(e.target.value)}>
              <option value="">-- Select a transaction --</option>
              {transactions.map((tx) => (
                <option key={tx._id} value={tx._id}>
                  [{tx.contractType.toUpperCase()}] {tx.from?.substring(0, 10)}... → {tx.to?.substring(0, 10)}... | {tx.amount} ETH
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Attack Type</label>
            <select value={attackType} onChange={(e) => setAttackType(e.target.value)}>
              <option value="signature_replay">Signature Replay</option>
              <option value="nonce_replay">Nonce Replay</option>
              <option value="cross_chain_replay">Cross-Chain Replay</option>
              <option value="expired_tx">Expired Transaction Replay</option>
            </select>
          </div>

          <button className="btn btn-danger" onClick={handleSimulate} disabled={loading || !selectedTx}>
            {loading ? "Simulating..." : "🚀 Launch Attack"}
          </button>
        </div>

        {result && (
          <div className={`card result-card ${result.error ? "error" : result.blocked ? "blocked" : "succeeded"}`}>
            <h3>Attack Result</h3>
            {result.error ? (
              <div className="result-error">❌ Error: {result.error}</div>
            ) : (
              <>
                <div className={`result-status ${result.blocked ? "blocked" : "succeeded"}`}>
                  {result.blocked ? "🛡️ ATTACK BLOCKED" : "❌ ATTACK SUCCEEDED"}
                </div>
                <div className="result-details">
                  <div className="detail-row"><span>Attack Type:</span><span>{result.attackType}</span></div>
                  <div className="detail-row"><span>Prevention:</span>
                    <span className={result.preventionEnabled ? "green" : "red"}>
                      {result.preventionEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="detail-row"><span>Reason:</span><span>{result.reason}</span></div>
                  {result.txHash && (
                    <div className="detail-row"><span>TX Hash:</span><span className="mono">{result.txHash?.substring(0, 25)}...</span></div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* How it works explanation */}
        <div className="card explanation">
          <h3>🔍 How Each Attack Works</h3>
          <div className="attack-explanations">
            <div className="attack-exp">
              <h4>Signature Replay</h4>
              <p>Captures a valid signed transaction and re-broadcasts it. The vulnerable contract accepts the same signature again. The secure contract tracks used signatures in a mapping.</p>
            </div>
            <div className="attack-exp">
              <h4>Nonce Replay</h4>
              <p>Reuses a transaction with an already-spent nonce. The secure contract requires nonces to be sequential and increments on each use.</p>
            </div>
            <div className="attack-exp">
              <h4>Cross-Chain Replay</h4>
              <p>Replays a transaction from one chain on another. Secure contract embeds chainId in the signed message, making it invalid on other chains.</p>
            </div>
            <div className="attack-exp">
              <h4>Expired Transaction</h4>
              <p>Broadcasts a transaction with an old deadline timestamp. The secure contract rejects any transaction where block.timestamp exceeds the deadline.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}