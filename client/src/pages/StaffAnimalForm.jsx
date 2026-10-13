import { useParams } from 'react-router-dom';

// PLACEHOLDER for M3 (US-06). M3 replaces this file with the add / edit
// animal form. Routes /staff/animals/new and /staff/animals/:id/edit are
// wired in App.jsx and limited to Staff accounts. `id` is undefined on /new.
export default function StaffAnimalForm() {
  const { id } = useParams();
  return (
    <div className="page narrow">
      <div className="placeholder">
        <h1>{id ? `Edit animal #${id}` : 'Add animal'}</h1>
        <p className="muted">Coming soon (M3, US-06).</p>
      </div>
    </div>
  );
}
