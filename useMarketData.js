import { useEffect, useState } from 'react';
import io from 'socket.io-client';

// Railway Production URL
const SOCKET_URL = 'https://spikemv-production.up.railway.app';

export const useMarketData = () => {
  const [marketData, setMarketData] = useState({});

  useEffect(() => {
    // 1. Initial State Fetch from Railway API
    const fetchInitialState = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/state`);
        const result = await res.json();
        // Server sends data inside result.data
        if (result && result.data) {
          setMarketData(result.data);
        }
      } catch (err) {
        console.error("Error fetching state from Railway:", err);
      }
    };

    fetchInitialState();
    
    // Polling every 10 seconds
    const interval = setInterval(fetchInitialState, 10000);

    // 2. Real-time Socket Listener connected to Railway
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    // Matches server io.emit('live-feed-update', allPairsData)
    socket.on('live-feed-update', (updatedPairs) => {
      if (updatedPairs) {
        setMarketData(updatedPairs);
      }
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  return Object.values(marketData);
};
