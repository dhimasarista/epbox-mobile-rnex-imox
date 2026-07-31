export const MONITORED_ROOMS = [
  {
    id: 'engine-room',
    title: 'Engine Room',
    roomId: 'ER-001',
    deck: 'Lower Deck · Safety Deck',
    status: 'Active',
    metricLabel: 'PT1 / Zone Temp',
    icon: 'engine-outline',
    active: true,
    route: '/stations/engine-room',
  },
  {
    id: 'accommodation-room',
    title: 'Accommodation Room',
    roomId: 'AC-001',
    deck: 'Upper Deck · Living Deck',
    status: 'Active',
    metricLabel: 'Zone Temp / Smoke',
    icon: 'home-outline',
    active: true,
    route: '/stations/accommodation-room',
  },
  {
    id: 'generator-room',
    title: 'Generator Room',
    roomId: 'GR-001',
    deck: 'Lower Deck · Machinery Deck',
    status: 'Active',
    metricLabel: 'Zone Temp / Smoke',
    icon: 'lightning-bolt-outline',
    active: true,
    route: '/stations/generator-room',
  },
] as const;

export type MonitoredRoom = (typeof MONITORED_ROOMS)[number];
