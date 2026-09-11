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

// Global reference counter for active project room subscriptions
const projectRoomRefCounts = new Map<string, number>();

function joinProjectRoom(socket: Socket, projectId: string, onResult?: (connected: boolean) => void) {
  if (!socket.connected) return;
  socket.emit('join:project', { projectId }, (res?: { success?: boolean; error?: string }) => {
    onResult?.(Boolean(res?.success));
  });
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

    // Increment reference count for this project room
    const currentCount = projectRoomRefCounts.get(projectId) || 0;
    projectRoomRefCounts.set(projectId, currentCount + 1);

    // If first subscriber, join the room
    if (currentCount === 0 && socket.connected) {
      joinProjectRoom(socket, projectId, setIsConnected);
    } else if (socket.connected) {
      setIsConnected(true);
    }

    const handleConnect = () => {
      setIsConnected(true);
      // Re-join project room on reconnect
      joinProjectRoom(socket, projectId, setIsConnected);
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

      // Decrement reference count
      const count = (projectRoomRefCounts.get(projectId) || 1) - 1;
      if (count <= 0) {
        projectRoomRefCounts.delete(projectId);
        if (socket.connected) {
          socket.emit('leave:project', { projectId });
        }
      } else {
        projectRoomRefCounts.set(projectId, count);
      }
      setIsConnected(false);
    };
  }, [projectId]);

  return {
    socket: getSocket(),
    isConnected,
  };
}

