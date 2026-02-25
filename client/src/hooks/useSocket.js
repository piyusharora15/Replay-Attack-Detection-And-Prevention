import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export const useSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastAttack, setLastAttack] = useState(null);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [preventionStatus, setPreventionStatus] = useState(true);

  useEffect(() => {
    socketRef.current = io("http://localhost:5000", { transports: ["websocket"] });

    socketRef.current.on("connect", () => setIsConnected(true));
    socketRef.current.on("disconnect", () => setIsConnected(false));

    socketRef.current.on("attack_detected", (data) => {
      setLastAttack(data);
    });

    socketRef.current.on("transaction_update", (data) => {
      setLastTransaction(data);
    });

    socketRef.current.on("prevention_toggled", (data) => {
      setPreventionStatus(data.enabled);
    });

    return () => socketRef.current?.disconnect();
  }, []);

  return { isConnected, lastAttack, lastTransaction, preventionStatus };
};