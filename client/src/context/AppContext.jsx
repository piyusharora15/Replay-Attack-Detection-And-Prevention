import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { dashboardAPI } from "../services/api";
import { useSocket } from "../hooks/useSocket";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { isConnected, lastAttack, lastTransaction, preventionStatus } = useSocket();

  const fetchStats = useCallback(async () => {
    try {
      const res = await dashboardAPI.getStats();
      setStats(res.data.data);
    } catch (err) {
      console.error("Stats fetch error:", err);
    }
  }, []);

  // Refresh stats on new attacks or transactions
  useEffect(() => {
    fetchStats();
  }, [lastAttack, lastTransaction, fetchStats]);

  // Show notification on attack detection
  useEffect(() => {
    if (lastAttack) {
      const notification = {
        id: Date.now(),
        type: lastAttack.blocked ? "warning" : "danger",
        message: lastAttack.blocked
          ? `🛡️ Replay attack BLOCKED: ${lastAttack.attackType}`
          : `❌ Replay attack SUCCEEDED: ${lastAttack.attackType}`,
        timestamp: new Date().toISOString(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 10));
    }
  }, [lastAttack]);

  const togglePrevention = async (enabled) => {
    await dashboardAPI.togglePrevention(enabled);
    await fetchStats();
  };

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <AppContext.Provider value={{
      stats, loading, notifications, isConnected, preventionStatus,
      fetchStats, togglePrevention, dismissNotification,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);