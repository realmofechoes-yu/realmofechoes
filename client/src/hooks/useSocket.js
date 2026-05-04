import { useEffect, useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';

/**
 * Subscribe to a socket event with auto-cleanup
 */
export function useSocketEvent(event, callback) {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;
    socket.on(event, callback);
    return () => socket.off(event, callback);
  }, [socket, event, callback]);
}

/**
 * Returns a function to emit socket events
 */
export function useSocketEmit() {
  const { socket } = useSocketContext();

  const emit = useCallback((event, data) => {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }
      socket.emit(event, data, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Socket emit failed'));
        }
      });
    });
  }, [socket]);

  const emitNoAck = useCallback((event, data) => {
    if (socket?.connected) socket.emit(event, data);
  }, [socket]);

  return { emit, emitNoAck };
}

export default { useSocketEvent, useSocketEmit };
