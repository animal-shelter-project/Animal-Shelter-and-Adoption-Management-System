import { Link, useParams } from 'react-router-dom';

// PLACEHOLDER for M2 (US-03). M2 replaces this file with the real
// application form. The route /animals/:id/apply is already wired in App.jsx
// and limited to Adopter accounts. Use `request` from ../api.js so the
// token is sent automatically.
export default function ApplicationForm() {
  const { id } = useParams();
  return (
    <div className="page narrow">
      <div className="placeholder">
        <h1>Adoption application</h1>
        <p className="muted">Coming soon (M2, US-03). Animal ID: {id}</p>
        <Link to={`/animals/${id}`}>← Back to profile</Link>
      </div>
    </div>
  );
}
