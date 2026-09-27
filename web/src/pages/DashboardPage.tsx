import { useState, useEffect } from 'react';
import { Routes, Route, Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl,
  InputLabel, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader,
  MenuItem, Paper, Select, Snackbar, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import HistoryIcon from '@mui/icons-material/History';
import InventoryIcon from '@mui/icons-material/Inventory';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PeopleIcon from '@mui/icons-material/People';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useAuthStore } from '../store/auth.store';
import EstatusChip, { etiquetaEstatus } from '../components/EstatusChip';
import { usePushNotifications } from '../hooks/usePushNotifications';
import EmpleadosPage from './EmpleadosPage';
import ProductosPage from './ProductosPage';
import TareasAdminPage from './TareasAdminPage';
import TareasMaestroPage from './TareasMaestroPage';
import InventarioPage from './InventarioPage';
import ListaCompraPage from './ListaCompraPage';

/**
 * GraphQL query for the staff order listing (used for active orders).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const PEDIDOS_QUERY = gql`
  query Pedidos($estatus: String) {
    pedidos(estatus: $estatus) {
      id estatus nombreCliente tipoEntrega total createdAt direccion
      cancelacionMotivo repartidorId
      items { id esEncargo cantidad producto { nombre } }
    }
  }
`;

/**
 * GraphQL query for listing all staff users (filtered client-side for REPARTIDOR).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const REPARTIDORES_QUERY = gql`
  query Repartidores {
    usuarios { id nombre rol }
  }
`;

/**
 * GraphQL mutation that assigns a delivery driver to a LISTO home-delivery order.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const ASIGNAR_REPARTIDOR = gql`
  mutation AsignarRepartidor($pedidoId: Int!, $repartidorId: Int!) {
    asignarRepartidor(pedidoId: $pedidoId, repartidorId: $repartidorId) { id repartidorId }
  }
`;

/**
 * GraphQL query for the completed-order history (ENTREGADO + CANCELADO).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const HISTORIAL_ENTREGADO_QUERY = gql`
  query HistorialEntregados {
    entregados: pedidos(estatus: "ENTREGADO") {
      id estatus nombreCliente tipoEntrega total createdAt
      items { id cantidad producto { nombre } }
    }
    cancelados: pedidos(estatus: "CANCELADO") {
      id estatus nombreCliente tipoEntrega total createdAt cancelacionMotivo
      items { id cantidad producto { nombre } }
    }
  }
`;

/**
 * GraphQL mutation that changes an order's status.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const ACTUALIZAR_ESTATUS = gql`
  mutation ActualizarEstatus($pedidoId: Int!, $estatus: String!) {
    actualizarEstatusPedido(pedidoId: $pedidoId, estatus: $estatus) { id estatus }
  }
`;

/**
 * GraphQL mutation that approves or rejects a cancellation request.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const RESOLVER_CANCELACION = gql`
  mutation ResolverCancelacion($pedidoId: Int!, $decision: String!) {
    resolverCancelacion(pedidoId: $pedidoId, decision: $decision) { id estatus }
  }
`;

/**
 * GraphQL query for the sales report.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const REPORTE_QUERY = gql`
  query ReporteVentas {
    reporteVentas {
      totalIngresos totalPedidos ticketPromedio
      topProductos { productoId nombre totalVendidos }
    }
  }
`;

/**
 * Valid status transitions from each non-terminal state — mirrors the backend state machine
 * so invalid calls are never sent.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const TRANSICIONES_DESDE: Record<string, string[]> = {
  PENDIENTE: ['EN_PREPARACION', 'CANCELADO'],
  ESPERANDO_CONFIRMACION: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['LISTO'],
  LISTO: ['EN_CAMINO', 'ENTREGADO'],
  EN_CAMINO: ['ENTREGADO'],
  SOLICITUD_CANCELACION: ['EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'CANCELADO'],
};

/** Statuses that have no further transitions. */
const TERMINALES = new Set(['ENTREGADO', 'CANCELADO']);

/**
 * Staff view of orders: shows only active (non-terminal) orders with their status, lets
 * staff approve/reject cancellation requests and offers only the transition buttons that
 * are valid from the order's current state AND allowed for the acting role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The active orders list.
 */
function PedidosActivos() {
  const { usuario } = useAuthStore();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [repartidorPorPedido, setRepartidorPorPedido] = useState<Record<number, number>>({});

  const puedeAsignar = usuario?.rol === 'ADMIN' || usuario?.rol === 'CAJERO';

  // cache-and-network: show cached data immediately but always re-fetch so new orders
  // placed after the last visit appear without a manual page refresh.
  const { data, loading, error, refetch } = useQuery(PEDIDOS_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const { data: repData } = useQuery(REPARTIDORES_QUERY, {
    skip: !puedeAsignar,
    fetchPolicy: 'cache-and-network',
  });
  const [actualizarEstatus] = useMutation(ACTUALIZAR_ESTATUS, { onCompleted: () => refetch() });
  const [resolverCancelacion] = useMutation(RESOLVER_CANCELACION, { onCompleted: () => refetch() });
  const [asignarRepartidor] = useMutation(ASIGNAR_REPARTIDOR, { onCompleted: () => refetch() });

  const repartidores: { id: number; nombre: string }[] =
    (repData?.usuarios ?? []).filter((u: { id: number; nombre: string; rol: string }) => u.rol === 'REPARTIDOR');

  useEffect(() => { if (error) setSnackbarOpen(true); }, [error]);

  if (loading && !data) return <CircularProgress />;

  // Only show orders that can still change (hide ENTREGADO / CANCELADO)
  const pedidos: Record<string, unknown>[] = (data?.pedidos ?? []).filter(
    (p: Record<string, unknown>) => !TERMINALES.has(p.estatus as string),
  );

  const transicionesPorRol: Record<string, string[]> = {
    CAJERO: ['EN_PREPARACION', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'],
    MAESTRO_PANADERO: ['EN_PREPARACION', 'LISTO'],
    REPARTIDOR: ['EN_CAMINO', 'ENTREGADO'],
    ADMIN: ['EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'],
  };

  /**
   * Returns the transition buttons the current user may click for a given order.
   * Intersects role permissions with the state machine to avoid invalid calls.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   * @param {Record<string, unknown>} pedido - The order row from the query.
   * @returns {string[]} Allowed target statuses.
   */
  function transicionesParaPedido(pedido: Record<string, unknown>): string[] {
    const rolPermitidas = transicionesPorRol[usuario?.rol ?? ''] ?? [];
    const maquinaPermitidas = TRANSICIONES_DESDE[pedido.estatus as string] ?? [];
    return rolPermitidas.filter((est) => {
      if (!maquinaPermitidas.includes(est)) return false;
      // EN_CAMINO is only valid for home-delivery orders
      if (est === 'EN_CAMINO' && pedido.tipoEntrega !== 'DOMICILIO') return false;
      return true;
    });
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Pedidos activos
      </Typography>
      {pedidos.length === 0 && <Typography color="text.secondary">No hay pedidos activos.</Typography>}
      <Stack spacing={2}>
        {pedidos.map((p) => (
          <Card key={p.id as number}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography variant="h6" component="span">
                    #{p.id as number}
                  </Typography>{' '}
                  <Typography component="span" color="text.secondary">
                    {p.nombreCliente as string}
                  </Typography>
                </Box>
                <EstatusChip estatus={p.estatus as string} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: p.direccion ? 0.5 : 2 }}>
                {p.tipoEntrega as string} · ${p.total as string} MXN
              </Typography>
              {(p.direccion as string | null) && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  <LocalShippingIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  {p.direccion as string}
                </Typography>
              )}
              {(p.estatus as string) === 'SOLICITUD_CANCELACION' && (
                <Alert
                  severity="error"
                  sx={{ mb: 2 }}
                  action={
                    <Stack direction="row" spacing={1}>
                      <Button
                        color="error"
                        variant="contained"
                        size="small"
                        onClick={() => resolverCancelacion({ variables: { pedidoId: p.id, decision: 'APROBAR' } })}
                      >
                        Aprobar
                      </Button>
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => resolverCancelacion({ variables: { pedidoId: p.id, decision: 'RECHAZAR' } })}
                      >
                        Rechazar
                      </Button>
                    </Stack>
                  }
                >
                  Motivo: {p.cancelacionMotivo as string}
                </Alert>
              )}
              {/* Delivery assignment widget — shown for LISTO home-delivery orders without a driver */}
              {puedeAsignar && (p.estatus as string) === 'LISTO' && p.tipoEntrega === 'DOMICILIO' && !(p.repartidorId as number | null) && (
                <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Repartidor</InputLabel>
                    <Select
                      label="Repartidor"
                      value={repartidorPorPedido[p.id as number] ?? ''}
                      onChange={(e) =>
                        setRepartidorPorPedido((prev) => ({ ...prev, [p.id as number]: Number(e.target.value) }))
                      }
                    >
                      {repartidores.length === 0 && (
                        <MenuItem disabled value="">Sin repartidores disponibles</MenuItem>
                      )}
                      {repartidores.map((r) => (
                        <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<LocalShippingIcon />}
                    disabled={!repartidorPorPedido[p.id as number]}
                    onClick={() =>
                      void asignarRepartidor({
                        variables: { pedidoId: p.id, repartidorId: repartidorPorPedido[p.id as number] },
                      })
                    }
                  >
                    Asignar
                  </Button>
                </Stack>
              )}
              {/* Show assigned driver name when already set */}
              {puedeAsignar && (p.repartidorId as number | null) && (p.estatus as string) !== 'ENTREGADO' && (
                <Typography variant="body2" sx={{ mb: 1, color: 'success.main' }}>
                  <LocalShippingIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  {repartidores.find((r) => r.id === (p.repartidorId as number))?.nombre ?? `Repartidor #${p.repartidorId as number}`}
                </Typography>
              )}
              <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
                {transicionesParaPedido(p).map((est) => (
                  <Button
                    key={est}
                    variant="outlined"
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => actualizarEstatus({ variables: { pedidoId: p.id, estatus: est } })}
                  >
                    {etiquetaEstatus(est)}
                  </Button>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>
          No se pudieron cargar los pedidos. Inténtalo de nuevo.
        </Alert>
      </Snackbar>
    </Box>
  );
}

/**
 * Single KPI tile used in the sales report.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} props - Component props.
 * @param {string} props.titulo - Metric label.
 * @param {React.ReactNode} props.valor - Metric value.
 * @returns {JSX.Element} The KPI card.
 */
function Kpi({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h4" color="primary">
          {valor}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {titulo}
        </Typography>
      </CardContent>
    </Card>
  );
}

/**
 * ADMIN sales report view: revenue, order count, average ticket and top products.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element | null} The report, or null if no data is available.
 */
function Reportes() {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const { data, loading, error } = useQuery(REPORTE_QUERY, { fetchPolicy: 'cache-and-network' });
  useEffect(() => { if (error) setSnackbarOpen(true); }, [error]);
  if (loading && !data) return <CircularProgress />;
  const r = data?.reporteVentas;
  if (!r) return (
    <>
      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>No se pudo cargar el reporte.</Alert>
      </Snackbar>
    </>
  );
  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Reportes
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 4 }}>
        <Kpi titulo="Ingresos totales" valor={`$${r.totalIngresos}`} />
        <Kpi titulo="Pedidos" valor={r.totalPedidos} />
        <Kpi titulo="Ticket promedio" valor={`$${r.ticketPromedio}`} />
      </Box>
      <Typography variant="h6" gutterBottom>
        Top productos
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Vendidos</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {r.topProductos.map((p: { productoId: number; nombre: string; totalVendidos: number }) => (
              <TableRow key={p.productoId} hover>
                <TableCell>{p.nombre}</TableCell>
                <TableCell align="right">{p.totalVendidos} uds.</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>No se pudo cargar el reporte.</Alert>
      </Snackbar>
    </Box>
  );
}

/**
 * Formats an ISO date string as a short locale date + time in Spanish.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} iso - ISO date string.
 * @returns {string} Formatted date string.
 */
function fmtFecha(iso: string): string {
  const ms = Number(iso);
  const d = Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date(iso);
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Staff history view: lists all ENTREGADO and CANCELADO orders in a compact table,
 * newest first. Accessible to every staff role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The completed-orders history.
 */
function Historial() {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const { data, loading, error } = useQuery(HISTORIAL_ENTREGADO_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  useEffect(() => { if (error) setSnackbarOpen(true); }, [error]);
  if (loading && !data) return <CircularProgress />;

  type PedidoRow = {
    id: number; estatus: string; nombreCliente: string; tipoEntrega: string;
    total: string; createdAt: string; cancelacionMotivo?: string;
    items: { id: number; cantidad: number; producto: { nombre: string } }[];
  };

  const entregados: PedidoRow[] = data?.entregados ?? [];
  const cancelados: PedidoRow[] = data?.cancelados ?? [];
  const toMs = (s: string) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? n : new Date(s).getTime(); };
  const todos = [...entregados, ...cancelados].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Historial de pedidos
      </Typography>
      {todos.length === 0 ? (
        <Typography color="text.secondary">Sin pedidos completados aún.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Productos</TableCell>
                <TableCell>Entrega</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Estatus</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {todos.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>#{p.id}</TableCell>
                  <TableCell>{p.nombreCliente}</TableCell>
                  <TableCell>
                    {p.items.map((i) => `${i.cantidad}× ${i.producto.nombre}`).join(', ')}
                  </TableCell>
                  <TableCell>{p.tipoEntrega}</TableCell>
                  <TableCell align="right">${p.total}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtFecha(p.createdAt)}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.estatus === 'ENTREGADO' ? 'Entregado' : 'Cancelado'}
                      size="small"
                      color={p.estatus === 'ENTREGADO' ? 'success' : 'default'}
                      variant="outlined"
                    />
                    {p.cancelacionMotivo && (
                      <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                        {p.cancelacionMotivo}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>No se pudo cargar el historial.</Alert>
      </Snackbar>
    </Box>
  );
}

/**
 * Route wrapper that redirects to /dashboard if the current user's role is not allowed.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ roles: string[]; children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
function RoleGuard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { usuario } = useAuthStore();
  if (!roles.includes(usuario?.rol ?? '')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/**
 * Staff dashboard shell: side navigation filtered by role and nested routes for active
 * orders (index), order history and reports (/dashboard/reportes).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The dashboard page.
 */
export default function DashboardPage() {
  const { usuario } = useAuthStore();
  const { pathname } = useLocation();

  usePushNotifications();

  const navItems = [
    // MAESTRO_PANADERO: their default is mis-tareas; they also need pedidos to advance orders
    {
      to: '/dashboard/mis-tareas',
      label: 'Mis Tareas',
      icon: <AssignmentIcon />,
      roles: ['MAESTRO_PANADERO'],
    },
    {
      to: '/dashboard',
      label: 'Pedidos activos',
      icon: <ListAltIcon />,
      roles: ['ADMIN', 'CAJERO', 'REPARTIDOR'],
    },
    {
      to: '/dashboard/historial',
      label: 'Historial',
      icon: <HistoryIcon />,
      roles: ['ADMIN', 'CAJERO', 'REPARTIDOR'],
    },
    { to: '/dashboard/tareas', label: 'Tareas', icon: <AssignmentIcon />, roles: ['ADMIN'] },
    { to: '/dashboard/mis-tareas', label: 'Mis Tareas', icon: <AssignmentIcon />, roles: ['ADMIN'] },
    { to: '/dashboard/inventario', label: 'Inventario', icon: <InventoryIcon />, roles: ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO'] },
    { to: '/dashboard/compras', label: 'Lista de compras', icon: <ShoppingCartIcon />, roles: ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO'] },
    { to: '/dashboard/reportes', label: 'Reportes', icon: <BarChartIcon />, roles: ['ADMIN'] },
    { to: '/dashboard/productos', label: 'Productos', icon: <StorefrontIcon />, roles: ['ADMIN'] },
    { to: '/dashboard/empleados', label: 'Empleados', icon: <PeopleIcon />, roles: ['ADMIN'] },
  ].filter((item) => item.roles.includes(usuario?.rol ?? ''));

  // Deduplicate nav items by `to` (MAESTRO_PANADERO entry for mis-tareas is separate from ADMIN's)
  const navItemsUniq = navItems.filter(
    (item, idx, arr) => arr.findIndex((x) => x.to === item.to) === idx,
  );

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
      <Paper variant="outlined" sx={{ width: { md: 220 }, flexShrink: 0, alignSelf: 'flex-start' }}>
        <List
          subheader={
            <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 700 }}>Dashboard</ListSubheader>
          }
        >
          {navItemsUniq.map((item) => (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={pathname === item.to}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Routes>
          {/* Default index: maestro lands on mis-tareas; everyone else on pedidos activos */}
          <Route
            index
            element={
              usuario?.rol === 'MAESTRO_PANADERO'
                ? <Navigate to="/dashboard/mis-tareas" replace />
                : <PedidosActivos />
            }
          />
          <Route path="historial" element={<Historial />} />
          <Route
            path="reportes"
            element={<RoleGuard roles={['ADMIN']}><Reportes /></RoleGuard>}
          />
          <Route
            path="productos"
            element={<RoleGuard roles={['ADMIN']}><ProductosPage /></RoleGuard>}
          />
          <Route
            path="empleados"
            element={<RoleGuard roles={['ADMIN']}><EmpleadosPage /></RoleGuard>}
          />
          <Route
            path="tareas"
            element={<RoleGuard roles={['ADMIN']}><TareasAdminPage /></RoleGuard>}
          />
          <Route
            path="mis-tareas"
            element={<RoleGuard roles={['ADMIN', 'MAESTRO_PANADERO']}><TareasMaestroPage /></RoleGuard>}
          />
          <Route
            path="inventario"
            element={<RoleGuard roles={['ADMIN', 'MAESTRO_PANADERO', 'CAJERO']}><InventarioPage /></RoleGuard>}
          />
          <Route
            path="compras"
            element={<RoleGuard roles={['ADMIN', 'MAESTRO_PANADERO', 'CAJERO']}><ListaCompraPage /></RoleGuard>}
          />
        </Routes>
      </Box>
    </Stack>
  );
}
