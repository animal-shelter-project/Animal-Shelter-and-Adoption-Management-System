import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import RequireRole from './auth/RequireRole.jsx';
import AnimalList from './pages/AnimalList.jsx';
import AnimalProfile from './pages/AnimalProfile.jsx';
import Login from './pages/Login.jsx';
import MyApplications from './pages/MyApplications.jsx';
import NotFound from './pages/NotFound.jsx';
// Placeholders: M2 and M3 replace the contents of these files with their pages.
import ApplicationForm from './pages/ApplicationForm.jsx';
import StaffApplications from './pages/StaffApplications.jsx';
import StaffAnimalForm from './pages/StaffAnimalForm.jsx';

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollToTop />
      <Navbar />
      <main id="main" tabIndex={-1}>
        <ErrorBoundary resetKey={pathname}>
          <Routes>
            <Route path="/" element={<Navigate to="/animals" replace />} />
            {/* M1 */}
            <Route path="/animals" element={<AnimalList />} />
            <Route path="/animals/:id" element={<AnimalProfile />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/my-applications"
              element={
                <RequireRole role="Adopter">
                  <MyApplications />
                </RequireRole>
              }
            />
            {/* M2 */}
            <Route
              path="/animals/:id/apply"
              element={
                <RequireRole role="Adopter">
                  <ApplicationForm />
                </RequireRole>
              }
            />
            <Route
              path="/staff/applications"
              element={
                <RequireRole role="Staff">
                  <StaffApplications />
                </RequireRole>
              }
            />
            {/* M3 */}
            <Route
              path="/staff/animals/new"
              element={
                <RequireRole role="Staff">
                  <StaffAnimalForm />
                </RequireRole>
              }
            />
            <Route
              path="/staff/animals/:id/edit"
              element={
                <RequireRole role="Staff">
                  <StaffAnimalForm />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </>
  );
}
