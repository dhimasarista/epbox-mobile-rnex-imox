export const MONITORED_ROOMS = [
  {
    id: 'pump-room',
    title: 'Pump Room',
    roomId: 'PR-001',
    deck: 'Lower Deck',
    status: 'Active',
    metricLabel: 'Discharge Flow',
    icon: 'fire-hydrant',
    active: true,
    route: '/stations/pump-room',
  },
  {
    id: 'accommodation-room',
    title: 'Accommodation Room',
    roomId: 'AR-001',
    deck: 'Safety Deck',
    status: 'Active',
    metricLabel: 'Zone Temp',
    icon: 'bed-outline',
    active: true,
    route: '/stations/accommodation-room',
  },
  {
    id: 'fire-fighting-room',
    title: 'Fire Fighting Room',
    roomId: 'FF-001',
    deck: 'Engine Room',
    status: 'Active',
    metricLabel: 'DO Active',
    icon: 'electric-switch',
    active: true,
    route: '/stations/fire-fighting-room',
  },
] as const;

export type MonitoredRoom = (typeof MONITORED_ROOMS)[number];
