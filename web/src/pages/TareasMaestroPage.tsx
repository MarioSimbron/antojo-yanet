/**
 * Maestro panadero page: shows pending/in-progress production tasks and allows
 * the user to transition them through EN_PROCESO → COMPLETADA. Also shows their
 * own task proposals with their approval status (Feature B).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel,
  MenuItem, Select, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
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

const PRODUCTOS_QUERY = gql`
  query ProductosParaPropuesta {
    productos { id nombre categoria activo }
  }
`;

const ACTUALIZAR_TAREA = gql`
  mutation ActualizarTarea($id: Int!, $input: ActualizarTareaInput!) {
    actualizarTarea(id: $id, input: $input) { id estatus cantidadProducida }
  }
`;

const CREAR_TAREA = gql`
  mutation CrearPropuesta($input: CrearTareaInput!) {
    crearTarea(input: $input) { id }
  }
`;

const ESTATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  PROPUESTA: 'info',
  PENDIENTE: 'warning',
  EN_PROCESO: 'info',
  COMPLETADA: 'success',
  RECHAZADA: 'error',
};

const ESTATUS_LABEL: Record<string, string> = {
  PROPUESTA: 'Esperando aprobación',
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
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
 * Production tasks page for maestro panadero: shows assigned tasks, lets them mark
 * tasks as in-progress or complete, and allows proposing new tasks (Feature B).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element}
 */
export default function TareasMaestroPage() {
  const [completarDialog, setCompletarDialog] = useState<Tarea | null>(null);
  const [cantidadProducida, setCantidadProducida] = useState('');
  const [propuestaOpen, setPropuestaOpen] = useState(false);
  const [propProductoId, setPropProductoId] = useState<number | ''>('');
  const [propCantidad, setPropCantidad] = useState('');
  const [propNotas, setPropNotas] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', ok: true });

  const { data, loading, error, refetch } = useQuery(MIS_TAREAS_QUERY, { fetchPolicy: 'cache-and-network' });
  const { data: prodData } = useQuery(PRODUCTOS_QUERY, { fetchPolicy: 'cache-and-network' });

  const [actualizarTarea, { loading: actualizando }] = useMutation(ACTUALIZAR_TAREA, {
    onCompleted: () => {
      setCompletarDialog(null);
      setCantidadProducida('');
      setSnackbar({ open: true, msg: 'Tarea actualizada', ok: true });
      void refetch();
    },
    onError: (e) => setSnackbar({ open: true, msg: e.message, ok: false }),
  });

  const [crearTarea, { loading: proponiendo }] = useMutation(CREAR_TAREA, {
    onCompleted: () => {
      setPropuestaOpen(false);
      setPropProductoId(''); setPropCantidad(''); setPropNotas('');
      setSnackbar({ open: true, msg: 'Propuesta enviada al administrador', ok: true });
      void refetch();
    },
    onError: (e) => setSnackbar({ open: true, msg: e.message, ok: false }),
  });

  const handleProponerTarea = () => {
    if (!propProductoId || !propCantidad || Number(propCantidad) < 1) return;
    void crearTarea({
      variables: { input: { productoId: Number(propProductoId), cantidadSolicitada: Number(propCantidad), notas: propNotas || undefined } },
    });
  };

  const productos = (prodData?.productos ?? []) as { id: number; nombre: string; categoria: string; activo: boolean }[];

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
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Mis Tareas de Producción
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setPropuestaOpen(true)}>
          Proponer tarea
        </Button>
      </Stack>

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

      {/* Proponer tarea dialog (Feature B) */}
      <Dialog open={propuestaOpen} onClose={() => setPropuestaOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Proponer nueva tarea de producción</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Producto</InputLabel>
              <Select
                value={propProductoId}
                label="Producto"
                onChange={(e) => setPropProductoId(e.target.value as number)}
              >
                {productos.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.nombre} — {p.categoria}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Cantidad a producir"
              type="number"
              size="small"
              value={propCantidad}
              onChange={(e) => setPropCantidad(e.target.value)}
            />
            <TextField
              label="Notas / justificación (opcional)"
              multiline
              rows={3}
              size="small"
              value={propNotas}
              onChange={(e) => setPropNotas(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPropuestaOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleProponerTarea}
            disabled={proponiendo || !propProductoId || !propCantidad}
          >
            Enviar propuesta
          </Button>
        </DialogActions>
      </Dialog>

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
