import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('roe_token');
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    if (socketRef.current?.connected) return;

    const socketUrl = import.meta.env.VITE_API_URL || '/';
    const s = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    s.on('connect', () => {
      console.log('🔌 Socket connected:', s.id);
      setConnected(true);
    });

    s.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnected(false);
    });

    s.on('connect_error', (err) => {
      console.error('Socket error:', err.message);
      setConnected(false);
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const reconnect = () => {
    const token = localStorage.getItem('roe_token');
    if (!token) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socketUrl = import.meta.env.VITE_API_URL || '/';
    const s = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    s.on('connect', () => { setConnected(true); });
    s.on('disconnect', () => { setConnected(false); });
    s.on('connect_error', (err) => { console.error('Socket error:', err.message); setConnected(false); });

    socketRef.current = s;
    setSocket(s);
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, connected, reconnect, disconnect }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider');
  return ctx;
}

export default SocketContext;
