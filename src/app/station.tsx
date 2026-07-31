import { Redirect, type Href } from 'expo-router';

export default function StationRedirect() {
  return <Redirect href={'/stations/engine-room' as Href} />;
}
