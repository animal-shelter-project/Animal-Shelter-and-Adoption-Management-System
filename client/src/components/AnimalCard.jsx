import { Link } from 'react-router-dom';
import { formatAge } from '../format.js';
import AnimalPhoto from './AnimalPhoto.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function AnimalCard({ animal }) {
  const details = [animal.species, animal.breed, formatAge(animal.age, animal.ageMonths), animal.sex]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={`/animals/${encodeURIComponent(animal.id)}`}
      className="card"
      data-testid="animal-card"
    >
      <AnimalPhoto animal={animal} />
      <div className="card-body">
        <div className="card-title">
          <h3>{animal.name}</h3>
          <StatusBadge status={animal.status} />
        </div>
        {details && <p className="muted">{details}</p>}
      </div>
    </Link>
  );
}
