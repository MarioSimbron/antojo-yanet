/**
 * Maestro panadero page: shows pending/in-progress production tasks and allows
 * the user to transition them through EN_PROCESO → COMPLETADA.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Snackbar,
  Stack, TextField, Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const MIS_TAREAS_QUERY = gql`
  query MisTareas {
    misTareas {
      id estatus cantidadSolicitada cantidadProducida notas createdAt
      producto { id nombre categoria }
    }
  }
`;

const ACTUALIZAR_TAREA = gql`
  mutation ActualizarTarea($id: Int!, $input: ActualizarTareaInput!) {
    actualizarTarea(id: $id, input: $input) { id estatus cantidadProducida }
  }
`;

const ESTATUS_COLOR: Record<string, 'warning' | 'info' | 'success'> = {
  PENDIENTE: 'warning',
  EN_PROCESO: 'info',
  COMPLETADA: 'success',
};

const ESTATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
};

interface Tarea {
  id: number;
  estatus: string;
  cantidadSolicitada: number;
  cantidadProducida: number | null;
  notas: string | null;
  createdAt: string;
  producto: { id: number; nombre: string; categoria: string };
}

function fmtFecha(iso: string) {
  const ms = Number(iso);
  const d = Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Production tasks page for maestro panadero: shows assigned tasks and lets them
 * mark a task as in-progress or complete with a produced quantity.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element}
 */
export default function TareasMaestroPage() {
  const [completarDialog, setCompletarDialog] = useState<Tarea | null>(null);
  const [cantidadProducida, setCantidadProducida] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', ok: true });

  const { data, loading, error, refetch } = useQuery(MIS_TAREAS_QUERY, { fetchPolicy: 'cache-and-network' });

  const [actualizarTarea, { loading: actualizando }] = useMutation(ACTUALIZAR_TAREA, {
    onCompleted: () => {
      setCompletarDialog(null);
      setCantidadProducida('');
      setSnackbar({ open: true, msg: 'Tarea actualizada', ok: true });
      void refetch();
    },
    onError: (e) => setSnackbar({ open: true, msg: e.message, ok: false }),
  });

  const iniciarTarea = (id: number) => {
    void actualizarTarea({ variables: { id, input: { estatus: 'EN_PROCESO' } } });
  };

  const completarTarea = () => {
    if (!completarDialog || !cantidadProducida || Number(cantidadProducida) < 1) return;
    void actualizarTarea({
      variables: {
        id: completarDialog.id,
        input: { estatus: 'COMPLETADA', cantidadProducida: Number(cantidadProducida) },
      },
    });
  };

  const tareas = (data?.misTareas ?? []) as Tarea[];

  return (
    <Box>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Mis Tareas de Producción
      </Typography>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">Error al cargar tareas.</Alert>}

      {!loading && tareas.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
          No tienes tareas asignadas por el momento.
        </Typography>
      )}

      <Stack spacing={2}>
        {tareas.map((t) => (
          <Card key={t.id} variant="outlined">
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{t.producto.nombre}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.producto.categoria}</Typography>
                </Box>
                <Chip
                  label={ESTATUS_LABEL[t.estatus] ?? t.estatus}
                  color={ESTATUS_COLOR[t.estatus] ?? 'default'}
                  size="small"
                />
              </Stack>

              <Stack direction="row" spacing={3} sx={{ mt: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Solicitado</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{t.cantidadSolicitada}</Typography>
                </Box>
                {t.cantidadProducida != null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Producido</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{t.cantidadProducida}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Asignada</Typography>
                  <Typography variant="body1">{fmtFecha(t.createdAt)}</Typography>
                </Box>
              </Stack>

              {t.notas && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t.notas}
                </Typography>
              )}

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                {t.estatus === 'PENDIENTE' && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => iniciarTarea(t.id)}
                    disabled={actualizando}
                  >
                    Iniciar
                  </Button>
                )}
                {(t.estatus === 'PENDIENTE' || t.estatus === 'EN_PROCESO') && (
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => {
                      setCompletarDialog(t);
                      setCantidadProducida(String(t.cantidadSolicitada));
                    }}
                  >
                    Completar
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Completar dialog */}
      <Dialog open={!!completarDialog} onClose={() => setCompletarDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Completar tarea</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 2 }}>
            ¿Cuántas piezas de <strong>{completarDialog?.producto.nombre}</strong> se produjeron?
          </Typography>
          <TextField
            label="Cantidad producida"
            type="number"
            fullWidth
            size="small"
            value={cantidadProducida}
            onChange={(e) => setCantidadProducida(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletarDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={completarTarea}
            disabled={actualizando || !cantidadProducida || Number(cantidadProducida) < 1}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.ok ? 'success' : 'error'} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
