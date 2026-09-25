import { ApolloProvider } from '@apollo/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { client } from './lib/apollo';
import { useAuthStore } from './store/auth.store';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import CheckoutPage from './pages/CheckoutPage';
import SeguimientoPage from './pages/SeguimientoPage';
import MisPedidosPage from './pages/MisPedidosPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ChatWidget from './components/ChatWidget';

/**
 * Roles allowed to access the staff dashboard.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const ROLES_STAFF = ['ADMIN', 'CAJERO', 'MAESTRO_PANADERO', 'REPARTIDOR'];

/**
 * Route guard: redirects to /login when there is no session, and to / when the user's
 * role is not in the allowed list.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Content rendered when access is granted.
 * @param {string[]} [props.roles] - Allowed roles; any authenticated user if omitted.
 * @returns {JSX.Element} The children or a <Navigate> redirect.
 */
function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { usuario } = useAuthStore();
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Root component: provides the Apollo client, defines the app routes inside the shared
 * Layout and mounts the floating ChatWidget on every page.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The application tree.
 */
export default function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/seguimiento/:pedidoId" element={<SeguimientoPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/mis-pedidos"
              element={
                <ProtectedRoute>
                  <MisPedidosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute roles={ROLES_STAFF}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
        <ChatWidget />
      </BrowserRouter>
    </ApolloProvider>
  );
}
