import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = 'https://spikemv.com';

export const useMarketData = () => {
  const [marketData, setMarketData] = useState({});

  useEffect(() => {
    // 1. Initial State Fetch (Only once or every 10-15 seconds)
    const fetchInitialState = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/state`);
        const data = await res.json();
        if (data && data.allPairs) {
          setMarketData(data.allPairs);
        }
      } catch (err) {
        console.error("Error fetching state:", err);
      }
    };

    fetchInitialState();
    
    // Polling every 10 seconds to drastically reduce Vercel Invocations
    const interval = setInterval(fetchInitialState, 10000);

    // 2. Real-time Socket Listener (Zero CDN Requests)
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('market-update', (updatedPair) => {
      setMarketData((prev) => ({
        ...prev,
        [updatedPair.symbol]: updatedPair
      }));
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  return Object.values(marketData);
};
