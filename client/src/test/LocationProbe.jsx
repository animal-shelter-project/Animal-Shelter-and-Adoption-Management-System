import { useLocation } from 'react-router-dom';

// Test helper: shows the current URL so tests can assert on redirects.
export default function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}
