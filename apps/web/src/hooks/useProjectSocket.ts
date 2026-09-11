"use client";

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { Socket } from 'socket.io-client';

interface UseProjectSocketOptions {
  projectId: string;
  onReconnect?: () => void;
}

interface UseProjectSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
}

export function useProjectSocket({
  projectId,
  onReconnect,
}: UseProjectSocketOptions): UseProjectSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!projectId) return;

    const socket = getSocket();

    // Helper to join room
    const joinRoom = () => {
      socket.emit('join:project', { projectId }, (res?: { success?: boolean; error?: string }) => {
        if (res?.success) {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });
    };

    // If socket is already connected, join immediately
    if (socket.connected) {
      joinRoom();
    }

    const handleConnect = () => {
      setIsConnected(true);
      joinRoom();
      // Trigger REST reconciliation callback if provided (ARCHITECTURE.md §6)
      if (onReconnectRef.current) {
        onReconnectRef.current();
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      if (socket.connected) {
        socket.emit('leave:project', { projectId });
      }
      setIsConnected(false);
    };
  }, [projectId]);

  return {
    socket: getSocket(),
    isConnected,
  };
}
