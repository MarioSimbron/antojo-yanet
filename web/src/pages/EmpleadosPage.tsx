import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputLabel, MenuItem, Select, Snackbar, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';

/**
 * GraphQL query to fetch all staff users. Requires ADMIN role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const USUARIOS = gql`
  query Usuarios {
    usuarios {
      id nombre email telefono rol createdAt
    }
  }
`;

/**
 * GraphQL mutation to create a new staff user account. Requires ADMIN role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CREAR_EMPLEADO = gql`
  mutation CrearEmpleado($input: EmpleadoInput!) {
    crearEmpleado(input: $input) {
      id nombre email telefono rol
    }
  }
`;

/**
 * GraphQL mutation to update an existing employee's profile. Requires ADMIN role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const ACTUALIZAR_EMPLEADO = gql`
  mutation ActualizarEmpleado($id: Int!, $input: ActualizarEmpleadoInput!) {
    actualizarEmpleado(id: $id, input: $input) {
      id nombre email telefono rol
    }
  }
`;

const ROLES_STAFF = ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO', 'REPARTIDOR'];

const ROL_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MAESTRO_PANADERO: 'Maestro panadero',
  CAJERO: 'Cajero',
  REPARTIDOR: 'Repartidor',
};

type Empleado = {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  rol: string;
  createdAt: string;
};

type FormState = {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  rol: string;
};

const EMPTY_FORM: FormState = { nombre: '', email: '', password: '', telefono: '', rol: 'CAJERO' };

/**
 * Admin page for managing bakery staff. Shows a table of all employees and
 * provides dialogs to create a new one or edit an existing one (name, email,
 * phone, role). Password can only be set on creation; editing leaves it unchanged.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The employees management page.
 */
export default function EmpleadosPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Empleado | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const { data, loading, error, refetch } = useQuery(USUARIOS, { fetchPolicy: 'cache-and-network' });
  const [crearEmpleado, { loading: creating }] = useMutation(CREAR_EMPLEADO);
  const [actualizarEmpleado, { loading: updating }] = useMutation(ACTUALIZAR_EMPLEADO);

  const handleOpen = (emp?: Empleado) => {
    if (emp) {
      setEditTarget(emp);
      setForm({ nombre: emp.nombre, email: emp.email, password: '', telefono: emp.telefono ?? '', rol: emp.rol });
    } else {
      setEditTarget(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleClose = () => setDialogOpen(false);

  const handleSave = async () => {
    try {
      if (editTarget) {
        await actualizarEmpleado({
          variables: {
            id: editTarget.id,
            input: { nombre: form.nombre, email: form.email, telefono: form.telefono || undefined, rol: form.rol },
          },
        });
        setSnackbar({ open: true, msg: 'Empleado actualizado correctamente.', severity: 'success' });
      } else {
        await crearEmpleado({
          variables: {
            input: { nombre: form.nombre, email: form.email, password: form.password, telefono: form.telefono || undefined, rol: form.rol },
          },
        });
        setSnackbar({ open: true, msg: 'Empleado creado correctamente.', severity: 'success' });
      }
      await refetch();
      handleClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
      setSnackbar({ open: true, msg, severity: 'error' });
    }
  };

  const empleados: Empleado[] = data?.usuarios ?? [];
  const isSaving = creating || updating;
  const canSave =
    form.nombre.trim() !== '' &&
    form.email.trim() !== '' &&
    form.rol !== '' &&
    (editTarget !== null || form.password.trim() !== '');

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">Empleados</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nuevo empleado
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          No se pudo cargar la lista de empleados. Inténtalo de nuevo.
        </Alert>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Teléfono</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {empleados.map((emp) => (
              <TableRow key={emp.id} hover>
                <TableCell>{emp.id}</TableCell>
                <TableCell>{emp.nombre}</TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.telefono ?? '—'}</TableCell>
                <TableCell>{ROL_LABELS[emp.rol] ?? emp.rol}</TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpen(emp)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {empleados.length === 0 && !error && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Sin empleados registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              fullWidth
              required
            />
            {!editTarget && (
              <TextField
                label="Contraseña"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                fullWidth
                required
              />
            )}
            <TextField
              label="Teléfono"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth required>
              <InputLabel>Rol</InputLabel>
              <Select
                label="Rol"
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
              >
                {ROLES_STAFF.map((r) => (
                  <MenuItem key={r} value={r}>
                    {ROL_LABELS[r]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
