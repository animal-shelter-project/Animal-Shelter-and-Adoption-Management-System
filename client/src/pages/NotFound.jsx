import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks.js';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="page narrow">
      <div className="empty">
        <h1>Page not found</h1>
        <Link to="/animals" className="btn">
          Go to animals
        </Link>
      </div>
    </div>
  );
}
