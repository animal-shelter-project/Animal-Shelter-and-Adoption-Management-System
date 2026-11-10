import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import RequireRole from './auth/RequireRole.jsx';
import AnimalList from './pages/AnimalList.jsx';
import AnimalProfile from './pages/AnimalProfile.jsx';
import Account from './pages/Account.jsx';
import Notifications from './pages/Notifications.jsx';
import Register from './pages/Register.jsx';
import StaffAccounts from './pages/StaffAccounts.jsx';
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
            {/* v2: accounts */}
            <Route path="/register" element={<Register />} />
            <Route
              path="/account"
              element={
                <RequireRole>
                  <Account />
                </RequireRole>
              }
            />
            <Route
              path="/notifications"
              element={
                <RequireRole>
                  <Notifications />
                </RequireRole>
              }
            />
            <Route
              path="/staff/accounts"
              element={
                <RequireRole role="Staff">
                  <StaffAccounts />
                </RequireRole>
              }
            />
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
