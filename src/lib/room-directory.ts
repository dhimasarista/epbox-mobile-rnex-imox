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
] as const;

export type MonitoredRoom = (typeof MONITORED_ROOMS)[number];
