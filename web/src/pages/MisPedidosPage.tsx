import { Link as RouterLink } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';
import { Box, Button, Card, CardActions, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EstatusChip from '../components/EstatusChip';

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
 * link, or an empty state pointing to the menu.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The orders list.
 */
export default function MisPedidosPage() {
  const { data, loading } = useQuery(MIS_PEDIDOS, { fetchPolicy: 'cache-and-network' });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const pedidos: Record<string, unknown>[] = data?.misPedidos ?? [];

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
    </Box>
  );
}
