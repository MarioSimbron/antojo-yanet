import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { Alert, Avatar, Button, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuthStore } from '../store/auth.store';
import { useGuestStore } from '../store/guest.store';

/**
 * GraphQL mutation that logs a user in.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken refreshToken
      usuario { id nombre email rol puntosSaldo }
    }
  }
`;

/**
 * GraphQL mutation that registers a new customer account.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const REGISTRO_MUTATION = gql`
  mutation Registro($input: RegistroInput!) {
    registro(input: $input) {
      accessToken refreshToken
      usuario { id nombre email rol puntosSaldo }
    }
  }
`;

/**
 * GraphQL mutation that moves guest orders to the logged-in account.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const MIGRAR_MUTATION = gql`
  mutation MigrarGuest($guestToken: String!) {
    migrarGuestACuenta(guestToken: $guestToken)
  }
`;

/**
 * Login / registration page with a toggle between both modes. On success it saves the
 * session, migrates any guest orders to the account and redirects home.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The login/registration form.
 */
export default function LoginPage() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', telefono: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { guestToken } = useGuestStore();

  const [loginMut, { loading: loadingLogin }] = useMutation(LOGIN_MUTATION);
  const [registroMut, { loading: loadingReg }] = useMutation(REGISTRO_MUTATION);
  const [migrarMut] = useMutation(MIGRAR_MUTATION);

  /**
   * Runs login or registration depending on the current mode, stores the session,
   * migrates guest orders (non-critical) and redirects; shows backend errors in the form.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   * @param {React.FormEvent} e - Form submit event.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      let data;
      if (modo === 'login') {
        const r = await loginMut({ variables: { email: form.email, password: form.password } });
        data = r.data?.login;
      } else {
        const r = await registroMut({
          variables: {
            input: {
              nombre: form.nombre,
              email: form.email,
              password: form.password,
              telefono: form.telefono || undefined,
            },
          },
        });
        data = r.data?.registro;
      }
      if (data) {
        login(data);
        // Automatically migrate guest orders if there is a guestToken
        if (guestToken) {
          try {
            await migrarMut({
              variables: { guestToken },
              context: { headers: { authorization: `Bearer ${data.accessToken}` } },
            });
          } catch {
            // non-critical
          }
        }
        navigate('/');
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Error al iniciar sesión');
    }
  };

  return (
    <Paper variant="outlined" sx={{ maxWidth: 440, mx: 'auto', p: { xs: 3, sm: 5 } }}>
      <Stack spacing={1} sx={{ alignItems: 'center', mb: 3 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography variant="h5" component="h1">
          {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack component="form" onSubmit={handleSubmit} spacing={2}>
        {modo === 'registro' && (
          <>
            <TextField
              label="Nombre completo"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
            <TextField
              type="tel"
              label="Teléfono (opcional)"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </>
        )}
        <TextField
          type="email"
          label="Correo electrónico"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoComplete="email"
        />
        <TextField
          type="password"
          label="Contraseña"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
        />
        <Button type="submit" variant="contained" size="large" loading={loadingLogin || loadingReg}>
          {modo === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
        {modo === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
        <Link component="button" type="button" onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}>
          {modo === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
        </Link>
      </Typography>
    </Paper>
  );
}
