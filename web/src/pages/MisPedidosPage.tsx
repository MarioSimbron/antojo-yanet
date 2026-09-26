import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';
import { Alert, Box, Button, Card, CardActions, CardContent, CircularProgress, Snackbar, Stack, Typography } from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EstatusChip from '../components/EstatusChip';
import { useSocket } from '../hooks/useSocket';

/**
 * GraphQL query for the authenticated user's orders.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const MIS_PEDIDOS = gql`
  query MisPedidos {
    misPedidos {
      id estatus total createdAt tipoEntrega
      items { id producto { nombre } cantidad }
    }
  }
`;

/**
 * "My orders" page: lists the user's orders with a status chip, total and a tracking
 * link, or an empty state pointing to the menu. Subscribes to Socket.IO `pedido:estado_actualizado`
 * events for every listed order so the status chips update in real-time without a page
 * reload. Shows a Snackbar when the network request fails.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The orders list.
 */
export default function MisPedidosPage() {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const { data, loading, error, refetch } = useQuery(MIS_PEDIDOS, { fetchPolicy: 'cache-and-network' });
  const { unirseAPedido, onEstadoActualizado } = useSocket();

  useEffect(() => {
    if (error) setSnackbarOpen(true);
  }, [error]);

  // Subscribe to status-update events once on mount; refetch when any order changes.
  useEffect(() => {
    return onEstadoActualizado(() => void refetch());
  }, [onEstadoActualizado, refetch]);

  // Join the Socket.IO room for each order the first time data arrives (and whenever
  // new orders appear). unirseAPedido is idempotent per ID so duplicate calls are safe.
  useEffect(() => {
    const pedidos = (data?.misPedidos ?? []) as Record<string, unknown>[];
    pedidos.forEach((p) => unirseAPedido(p.id as number));
  }, [data, unirseAPedido]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const pedidos: Record<string, unknown>[] = data?.misPedidos ?? [];

  const snackbar = (
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={5000}
      onClose={() => setSnackbarOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>
        No pudimos cargar tus pedidos. Inténtalo de nuevo.
      </Alert>
    </Snackbar>
  );

  if (pedidos.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <ReceiptLongIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Aún no tienes pedidos
        </Typography>
        <Button variant="contained" component={RouterLink} to="/menu">
          Ver menú
        </Button>
        {snackbar}
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Mis pedidos
      </Typography>
      <Stack spacing={2}>
        {pedidos.map((p) => (
          <Card key={p.id as number}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">Pedido #{p.id as number}</Typography>
                <EstatusChip estatus={p.estatus as string} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Total: ${p.total as string} MXN · {p.tipoEntrega as string}
              </Typography>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2 }}>
              <Button size="small" component={RouterLink} to={`/seguimiento/${p.id as number}`}>
                Ver seguimiento
              </Button>
            </CardActions>
          </Card>
        ))}
      </Stack>
      {snackbar}
    </Box>
  );
}
