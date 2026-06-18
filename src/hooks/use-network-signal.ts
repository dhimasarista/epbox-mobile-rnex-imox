import type { NetInfoCellularGeneration, NetInfoState } from '@react-native-community/netinfo';
import { addEventListener, fetch } from '@react-native-community/netinfo/lib/module/index.js';
import { useEffect, useRef, useState } from 'react';

const TOTAL_SIGNAL_BARS = 10;

type NetworkSignal = {
  activeBars: number;
  totalBars: number;
  label: string;
  value: string;
};

type UseNetworkSignalOptions = {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toBars(percent: number) {
  return Math.round((clamp(percent, 0, 100) / 100) * TOTAL_SIGNAL_BARS);
}

function getCellularPercent(generation: NetInfoCellularGeneration | null) {
  // NetInfo exposes cellular generation, not raw signal strength, so we map it to a reasonable bar estimate.
  switch (generation) {
    case '2g':
      return 20;
    case '3g':
      return 45;
    case '4g':
      return 70;
    case '5g':
      return 95;
    default:
      return 35;
  }
}

function getSignalFromState(state: NetInfoState): NetworkSignal {
  if (!state.isConnected) {
    return {
      activeBars: 0,
      totalBars: TOTAL_SIGNAL_BARS,
      label: 'Signal',
      value: 'Off',
    };
  }

  if (state.type === 'wifi' && state.details && 'strength' in state.details) {
    const strength = typeof state.details.strength === 'number' ? clamp(state.details.strength, 0, 100) : null;

    if (strength !== null) {
      return {
        activeBars: toBars(strength),
        totalBars: TOTAL_SIGNAL_BARS,
        label: 'Wi-Fi',
        value: `${Math.round(strength)}%`,
      };
    }

    return {
      activeBars: 6,
      totalBars: TOTAL_SIGNAL_BARS,
      label: 'Wi-Fi',
      value: 'WiFi',
    };
  }

  if (state.type === 'cellular' && state.details && 'cellularGeneration' in state.details) {
    const generation = state.details.cellularGeneration ?? null;
    const percent = getCellularPercent(generation);

    return {
      activeBars: toBars(percent),
      totalBars: TOTAL_SIGNAL_BARS,
      label: 'Mobile',
      value: generation ? generation.toUpperCase() : 'Cell',
    };
  }

  if (state.type === 'ethernet') {
    return {
      activeBars: TOTAL_SIGNAL_BARS,
      totalBars: TOTAL_SIGNAL_BARS,
      label: 'Network',
      value: 'LAN',
    };
  }

  return {
    activeBars: 6,
    totalBars: TOTAL_SIGNAL_BARS,
    label: state.type === 'unknown' ? 'Signal' : state.type,
    value: 'On',
  };
}

export function useNetworkSignal(options: UseNetworkSignalOptions = {}) {
  const { enabled = true, refreshIntervalMs = 2000 } = options;
  const [liveNetInfo, setLiveNetInfo] = useState<NetInfoState>({
    type: 'unknown',
    isConnected: null,
    isInternetReachable: null,
    details: null,
  } as NetInfoState);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = addEventListener((nextState) => {
      if (isMounted) {
        setLiveNetInfo(nextState);
      }
    });

    const pollNetworkState = async () => {
      if (isFetchingRef.current) {
        if (isMounted) {
          timeoutId = setTimeout(pollNetworkState, refreshIntervalMs);
        }
        return;
      }

      isFetchingRef.current = true;

      try {
        const nextState = await fetch();

        if (isMounted) {
          setLiveNetInfo(nextState);
        }
      } finally {
        isFetchingRef.current = false;

        if (isMounted) {
          timeoutId = setTimeout(pollNetworkState, refreshIntervalMs);
        }
      }
    };

    void pollNetworkState();

    return () => {
      isMounted = false;
      unsubscribe();

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [enabled, refreshIntervalMs]);

  return getSignalFromState(liveNetInfo);
}
