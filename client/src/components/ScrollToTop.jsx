import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Opening a profile from far down the list should start at the top of the
// profile, not mid-page. Only reacts to path changes, so changing filters
// (?species=...) keeps your scroll position.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
