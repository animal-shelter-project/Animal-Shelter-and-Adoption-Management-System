import { Link } from 'react-router-dom';
import PetArt from '../components/PetArt.jsx';
import { useDocumentTitle } from '../hooks.js';

const LOST_PET = { id: 'lost', species: 'Dog', breed: 'Beagle' };

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="page narrow">
      <div className="empty">
        <PetArt animal={LOST_PET} className="empty-art" />
        <h1>Page not found</h1>
        <p className="muted">This page wandered off. The animals are this way.</p>
        <Link to="/animals" className="btn btn-primary">
          Go to animals
        </Link>
      </div>
    </div>
  );
}
