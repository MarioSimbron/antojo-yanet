import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom';
import { AppBar, Badge, Box, Button, Container, IconButton, Toolbar, Typography } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LogoutIcon from '@mui/icons-material/Logout';
import { useApolloClient } from '@apollo/client';
import { useAuthStore } from '../store/auth.store';
import { useCarritoStore } from '../store/carrito.store';
import { useGuestStore } from '../store/guest.store';
import NotificationCenter from './NotificationCenter';

/**
 * Roles allowed to see the staff dashboard link.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const ROLES_STAFF = ['ADMIN', 'CAJERO', 'MAESTRO_PANADERO', 'REPARTIDOR'];

/**
 * Shared page layout: app bar with navigation (menu, cart with item badge, my orders,
 * dashboard for staff, login/logout), the routed page via <Outlet /> and a footer.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The layout wrapping the current route.
 */
export default function Layout() {
  const { usuario, logout } = useAuthStore();
  const { guestToken } = useGuestStore();
  const items = useCarritoStore((s) => s.items);
  const navigate = useNavigate();
  const apolloClient = useApolloClient();
  const totalItems = items.reduce((acc, i) => acc + i.cantidad, 0);
  const mostrarCampana = Boolean(usuario || guestToken);

  /**
   * Logs the user out, clears the Apollo in-memory cache so the next user
   * never sees stale data from the previous session, and returns to the home page.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   * @returns {void}
   */
  const handleLogout = () => {
    logout();
    void apolloClient.clearStore();
    navigate('/');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky">
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 1 }}>
            <Box
              component="img"
              src="/logo-antojo.webp"
              alt="Antojo de Yanet"
              sx={{ width: 36, height: 36, mr: 1, objectFit: 'contain' }}
            />
            <Typography
              variant="h6"
              component={RouterLink}
              to="/"
              sx={{ color: 'inherit', textDecoration: 'none', flexGrow: 1 }}
            >
              Antojo de Yanet
            </Typography>
            <Button color="inherit" component={RouterLink} to="/menu">
              Menú
            </Button>
            {usuario && (
              <Button color="inherit" component={RouterLink} to="/mis-pedidos">
                Mis pedidos
              </Button>
            )}
            {usuario && ROLES_STAFF.includes(usuario.rol) && (
              <Button color="inherit" component={RouterLink} to="/dashboard">
                Dashboard
              </Button>
            )}
            {mostrarCampana && <NotificationCenter />}
            <IconButton color="inherit" component={RouterLink} to="/checkout" aria-label="Carrito">
              <Badge badgeContent={totalItems} color="secondary">
                <ShoppingCartIcon />
              </Badge>
            </IconButton>
            {usuario ? (
              <Button color="inherit" onClick={handleLogout} endIcon={<LogoutIcon />}>
                {usuario.nombre}
              </Button>
            ) : (
              <Button color="inherit" variant="outlined" component={RouterLink} to="/login">
                Iniciar sesión
              </Button>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Container component="main" maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        <Outlet />
      </Container>

      <Box component="footer" sx={{ bgcolor: 'primary.dark', color: 'secondary.light', py: 2 }}>
        <Typography variant="body2" align="center">
          © 2026 Antojo de Yanet — Pan artesanal con amor
        </Typography>
      </Box>
    </Box>
  );
}
