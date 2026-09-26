import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';
import {
  Alert, Box, Card, CardContent, CircularProgress, Divider, Stack, Step, StepContent, StepLabel,
  Stepper, Typography,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { useSocket } from '../hooks/useSocket';
import EstatusChip, { etiquetaEstatus } from '../components/EstatusChip';

/**
 * GraphQL query for a single order (with history and items), authorized by JWT or token.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const PEDIDO_QUERY = gql`
  query Pedido($id: Int!, $token: String) {
    pedido(id: $id, token: $token) {
      id estatus nombreCliente tipoEntrega tiempoEstimadoMinutos
      total fechaEntregaEstimada repartidorId
      historial { id estatus timestamp nota }
      items { id cantidad precioUnitario esEncargo producto { nombre } }
    }
  }
`;

/**
 * Order tracking page. Reads the order ID from the route and the guest token from
 * `?token=`, shows the status history as a vertical stepper, the estimated time and the
 * order summary, and refetches when a real-time `pedido:estado_actualizado` event
 * arrives. Shows a generic "not found" message when the order is missing or not
 * accessible.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The tracking page.
 */
export default function SeguimientoPage() {
  const { pedidoId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? undefined;

  const { data, loading, error, refetch } = useQuery(PEDIDO_QUERY, {
    variables: { id: Number(pedidoId), token },
    skip: !pedidoId,
    fetchPolicy: 'cache-and-network',
  });

  const { unirseAPedido, onEstadoActualizado } = useSocket();

  useEffect(() => {
    if (pedidoId) unirseAPedido(Number(pedidoId));
    const cleanup = onEstadoActualizado(() => refetch());
    return cleanup;
  }, [pedidoId, unirseAPedido, onEstadoActualizado, refetch]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data?.pedido) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <SearchOffIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography color="text.secondary">No encontramos ese pedido, verifica el enlace.</Typography>
      </Box>
    );
  }

  const pedido = data.pedido;
  const historial: { id: number; estatus: string; timestamp: string; nota?: string }[] =
    pedido.historial ?? [];

  return (
    <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Pedido #{pedido.id}
        </Typography>
        <EstatusChip estatus={pedido.estatus} size="medium" />
      </Stack>

      {pedido.tiempoEstimadoMinutos && (
        <Alert icon={<AccessTimeIcon />} severity="info">
          Tiempo estimado: {pedido.tiempoEstimadoMinutos} minutos
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Historial
          </Typography>
          <Stepper orientation="vertical" activeStep={historial.length - 1}>
            {historial.map((h) => (
              <Step key={h.id} completed expanded>
                <StepLabel optional={<Typography variant="caption">{new Date(Number(h.timestamp)).toLocaleString('es-MX')}</Typography>}>
                  {etiquetaEstatus(h.estatus)}
                </StepLabel>
                <StepContent>
                  {h.nota && (
                    <Typography variant="body2" color="text.secondary">
                      {h.nota}
                    </Typography>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Resumen del pedido
          </Typography>
          <Stack spacing={1}>
            {pedido.items.map(
              (item: { id: number; cantidad: number; precioUnitario: string; producto?: { nombre: string }; esEncargo: boolean }) => (
                <Stack key={item.id} direction="row" sx={{ justifyContent: 'space-between', color: 'text.secondary' }}>
                  <Typography variant="body2">
                    {item.producto?.nombre ?? 'Producto'} × {item.cantidad}
                    {item.esEncargo && ' (encargo)'}
                  </Typography>
                  <Typography variant="body2">${(Number(item.precioUnitario) * item.cantidad).toFixed(2)}</Typography>
                </Stack>
              ),
            )}
            <Divider />
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600 }}>Total</Typography>
              <Typography sx={{ fontWeight: 600 }}>${pedido.total} MXN</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
