import { Link } from 'react-router-dom';
import { formatAge } from '../format.js';
import AnimalPhoto from './AnimalPhoto.jsx';
import StatusBadge from './StatusBadge.jsx';

// A "name tag" card: portrait, status tag, name, then species / breed / age.
export default function AnimalCard({ animal }) {
  const details = [animal.breed, formatAge(animal.age, animal.ageMonths), animal.sex].filter(Boolean);

  return (
    <Link
      to={`/animals/${encodeURIComponent(animal.id)}`}
      className={`card${animal.status === 'Available' ? '' : ' card-taken'}`}
      data-testid="animal-card"
    >
      <div className="card-photo">
        <AnimalPhoto animal={animal} />
        <span className="card-status">
          <StatusBadge status={animal.status} />
        </span>
      </div>
      <div className="card-body">
        <h3 className="card-name">{animal.name}</h3>
        <p className="card-details">
          {animal.species && <span className="species-chip">{animal.species}</span>}
          {details.length > 0 && <span className="muted">{details.join(', ')}</span>}
        </p>
      </div>
    </Link>
  );
}
