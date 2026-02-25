import { useState, useEffect } from "react";
import { transactionAPI } from "../../services/api";
import "./TransactionPanel.css";

const TEST_ACCOUNTS = [
  { label: "Account 1 (Deployer)", address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
  { label: "Account 2", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
  { label: "Account 3", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
];

export default function TransactionPanel() {
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({
    from: TEST_ACCOUNTS[0].address,
    to: TEST_ACCOUNTS[1].address,
    amount: "0.1",
    contractType: "secure",
  });
  const [depositForm, setDepositForm] = useState({
    address: TEST_ACCOUNTS[0].address,
    amount: "1.0",
    contractType: "secure",
  });
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadTransactions();
    loadBalances();
  }, []);

  const loadTransactions = async () => {
    const res = await transactionAPI.getAll({ limit: 15 });
    setTransactions(res.data.data);
  };

  const loadBalances = async () => {
    const bals = {};
    for (const acc of TEST_ACCOUNTS) {
      for (const ctype of ["vulnerable", "secure"]) {
        try {
          const res = await transactionAPI.getBalance(ctype, acc.address);
          bals[`${ctype}-${acc.address}`] = res.data.balance;
        } catch { bals[`${ctype}-${acc.address}`] = "0"; }
      }
    }
    setBalances(bals);
  };

  const handleDeposit = async () => {
    setLoading(true);
    try {
      await transactionAPI.deposit(depositForm);
      setMessage({ type: "success", text: `Deposited ${depositForm.amount} ETH successfully` });
      loadBalances();
    } catch (e) {
      setMessage({ type: "error", text: e.response?.data?.message || e.message });
    }
    setLoading(false);
  };

  const handleSend = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await transactionAPI.send(form);
      setMessage({ type: "success", text: `Transaction sent! Hash: ${res.data.data.txHash?.substring(0, 20)}...` });
      loadTransactions();
      loadBalances();
    } catch (e) {
      const errData = e.response?.data;
      if (errData?.attacks) {
        setMessage({ type: "error", text: `🛡️ BLOCKED: ${errData.attacks.map((a) => a.reason).join(", ")}` });
      } else {
        setMessage({ type: "error", text: errData?.message || e.message });
      }
    }
    setLoading(false);
  };

  return (
    <div className="tx-panel">
      <div className="panel-grid">
        {/* Deposit */}
        <div className="card">
          <h3>💰 Deposit Funds</h3>
          <div className="form-group">
            <label>Account</label>
            <select value={depositForm.address} onChange={(e) => setDepositForm({ ...depositForm, address: e.target.value })}>
              {TEST_ACCOUNTS.map((a) => <option key={a.address} value={a.address}>{a.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Contract</label>
            <select value={depositForm.contractType} onChange={(e) => setDepositForm({ ...depositForm, contractType: e.target.value })}>
              <option value="secure">Secure Contract</option>
              <option value="vulnerable">Vulnerable Contract</option>
            </select>
          </div>
          <div className="form-group">
            <label>Amount (ETH)</label>
            <input value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} />
          </div>
          <button className="btn btn-success" onClick={handleDeposit} disabled={loading}>
            {loading ? "Processing..." : "Deposit"}
          </button>
        </div>

        {/* Send Transaction */}
        <div className="card">
          <h3>📤 Send Transaction</h3>
          <div className="form-group">
            <label>From</label>
            <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>
              {TEST_ACCOUNTS.map((a) => <option key={a.address} value={a.address}>{a.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>To</label>
            <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>
              {TEST_ACCOUNTS.map((a) => <option key={a.address} value={a.address}>{a.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (ETH)</label>
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Contract Type</label>
            <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
              <option value="secure">🔒 Secure (Protected)</option>
              <option value="vulnerable">⚠️ Vulnerable (No Protection)</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
            {loading ? "Sending..." : "Send Transaction"}
          </button>
        </div>

        {/* Balances */}
        <div className="card balance-card">
          <h3>💼 Account Balances</h3>
          <table className="balance-table">
            <thead>
              <tr><th>Account</th><th>Secure</th><th>Vulnerable</th></tr>
            </thead>
            <tbody>
              {TEST_ACCOUNTS.map((acc) => (
                <tr key={acc.address}>
                  <td>{acc.label}</td>
                  <td>{balances[`secure-${acc.address}`] || "0"} ETH</td>
                  <td>{balances[`vulnerable-${acc.address}`] || "0"} ETH</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-primary" onClick={loadBalances} style={{ marginTop: 12 }}>
            🔄 Refresh Balances
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Transaction History */}
      <div className="card">
        <h3>📜 Transaction History</h3>
        <table className="tx-table">
          <thead>
            <tr><th>From</th><th>To</th><th>Amount</th><th>Contract</th><th>Status</th><th>Replay</th></tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx._id}>
                <td className="mono">{tx.from?.substring(0, 12)}...</td>
                <td className="mono">{tx.to?.substring(0, 12)}...</td>
                <td>{tx.amount} ETH</td>
                <td><span className={`badge badge-${tx.contractType === "secure" ? "success" : "warning"}`}>{tx.contractType}</span></td>
                <td><span className={`badge badge-${tx.status === "success" ? "success" : "danger"}`}>{tx.status}</span></td>
                <td>{tx.isReplay ? <span className="badge badge-danger">REPLAY</span> : "—"}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#4b5563" }}>No transactions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}