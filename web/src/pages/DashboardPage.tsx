import { Routes, Route, Link as RouterLink, useLocation } from 'react-router-dom';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, List, ListItemButton, ListItemIcon,
  ListItemText, ListSubheader, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BarChartIcon from '@mui/icons-material/BarChart';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { useAuthStore } from '../store/auth.store';
import EstatusChip, { etiquetaEstatus } from '../components/EstatusChip';

/**
 * GraphQL query for the staff order listing.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const PEDIDOS_QUERY = gql`
  query Pedidos($estatus: String) {
    pedidos(estatus: $estatus) {
      id estatus nombreCliente tipoEntrega total createdAt
      cancelacionMotivo repartidorId
      items { id esEncargo cantidad producto { nombre } }
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
 * Staff view of orders: shows each order with its status, lets staff approve/reject
 * cancellation requests and offers status-change buttons allowed for the current role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The active orders list.
 */
function PedidosActivos() {
  const { usuario } = useAuthStore();
  const { data, loading, refetch } = useQuery(PEDIDOS_QUERY);
  const [actualizarEstatus] = useMutation(ACTUALIZAR_ESTATUS, { onCompleted: () => refetch() });
  const [resolverCancelacion] = useMutation(RESOLVER_CANCELACION, { onCompleted: () => refetch() });

  if (loading) return <CircularProgress />;

  const pedidos: Record<string, unknown>[] = data?.pedidos ?? [];

  const transicionesPorRol: Record<string, string[]> = {
    CAJERO: ['EN_PREPARACION', 'EN_CAMINO', 'ENTREGADO'],
    MAESTRO_PANADERO: ['EN_PREPARACION', 'LISTO'],
    REPARTIDOR: ['EN_CAMINO', 'ENTREGADO'],
    ADMIN: ['EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'],
  };

  const transicionesPermitidas = transicionesPorRol[usuario?.rol ?? ''] ?? [];

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
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {p.tipoEntrega as string} · ${p.total as string} MXN
              </Typography>
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
              <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
                {transicionesPermitidas.map((est) => (
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
  const { data, loading } = useQuery(REPORTE_QUERY);
  if (loading) return <CircularProgress />;
  const r = data?.reporteVentas;
  if (!r) return null;
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
    </Box>
  );
}

/**
 * Staff dashboard shell: side navigation filtered by role and nested routes for active
 * orders (index) and reports (/dashboard/reportes).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The dashboard page.
 */
export default function DashboardPage() {
  const { usuario } = useAuthStore();
  const { pathname } = useLocation();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Pedidos activos',
      icon: <ListAltIcon />,
      roles: ['ADMIN', 'CAJERO', 'MAESTRO_PANADERO', 'REPARTIDOR'],
    },
    { to: '/dashboard/reportes', label: 'Reportes', icon: <BarChartIcon />, roles: ['ADMIN'] },
  ].filter((item) => item.roles.includes(usuario?.rol ?? ''));

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
      <Paper variant="outlined" sx={{ width: { md: 220 }, flexShrink: 0, alignSelf: 'flex-start' }}>
        <List
          subheader={
            <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 700 }}>Dashboard</ListSubheader>
          }
        >
          {navItems.map((item) => (
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
          <Route index element={<PedidosActivos />} />
          <Route path="reportes" element={<Reportes />} />
        </Routes>
      </Box>
    </Stack>
  );
}
