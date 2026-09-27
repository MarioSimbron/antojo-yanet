/**
 * Notification center component. Renders a bell icon in the navbar with a badge
 * showing the count of unread notifications. Clicking it opens a Popover listing
 * the last 50 notifications for the current user or guest.
 *
 * Data is fetched via Apollo and refreshed in real-time when the Socket.IO server
 * emits a `notificacion:nueva` event (no polling required).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} Bell icon button with notification popover.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  Button,
  Typography,
  Box,
  Divider,
  CircularProgress,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

// ── GraphQL operations ─────────────────────────────────────────────────────────

const MIS_NOTIFICACIONES = gql`
  query MisNotificaciones {
    misNotificaciones {
      id
      titulo
      cuerpo
      url
      leida
      creadaEn
    }
  }
`;

const MARCAR_LEIDA = gql`
  mutation MarcarLeida($id: Int!) {
    marcarLeida(id: $id)
  }
`;

const MARCAR_TODAS_LEIDAS = gql`
  mutation MarcarTodasLeidas {
    marcarTodasLeidas
  }
`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Notificacion {
  id: number;
  titulo: string;
  cuerpo: string;
  url?: string;
  leida: boolean;
  creadaEn: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const { data, loading, refetch } = useQuery<{ misNotificaciones: Notificacion[] }>(
    MIS_NOTIFICACIONES,
    { fetchPolicy: 'cache-and-network' },
  );

  const [marcarLeida] = useMutation(MARCAR_LEIDA);
  const [marcarTodasLeidas] = useMutation(MARCAR_TODAS_LEIDAS);

  const { onNotificacion } = useSocket();

  // Refresh the list whenever the server signals a new notification
  useEffect(() => {
    const unsub = onNotificacion(() => {
      void refetch();
    });
    return unsub;
  }, [onNotificacion, refetch]);

  const notificaciones = data?.misNotificaciones ?? [];
  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  /**
   * Marks a notification as read and navigates to its URL if one is set.
   * @param {Notificacion} n - The notification that was clicked.
   */
  const handleClick = async (n: Notificacion) => {
    if (!n.leida) {
      await marcarLeida({ variables: { id: n.id } });
      void refetch();
    }
    setAnchorEl(null);
    if (n.url) navigate(n.url);
  };

  /**
   * Marks all unread notifications as read.
   */
  const handleMarcarTodas = async () => {
    await marcarTodasLeidas();
    void refetch();
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="Notificaciones"
      >
        <Badge badgeContent={noLeidas} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 340 } }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            Notificaciones
          </Typography>
          {noLeidas > 0 && (
            <Button size="small" onClick={handleMarcarTodas}>
              Marcar todas leídas
            </Button>
          )}
        </Box>

        <Divider />

        {/* List */}
        <List
          dense
          disablePadding
          sx={{ maxHeight: 420, overflowY: 'auto' }}
        >
          {loading && notificaciones.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && notificaciones.length === 0 && (
            <ListItemButton disabled>
              <ListItemText
                primary="No hay notificaciones"
                primaryTypographyProps={{ color: 'text.secondary', fontSize: 14 }}
              />
            </ListItemButton>
          )}

          {notificaciones.map((n) => (
            <ListItemButton
              key={n.id}
              onClick={() => void handleClick(n)}
              sx={{
                bgcolor: n.leida ? 'transparent' : 'action.hover',
                alignItems: 'flex-start',
                py: 1,
              }}
            >
              {!n.leida && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    mt: 0.75,
                    mr: 1,
                    flexShrink: 0,
                  }}
                />
              )}
              <ListItemText
                primary={n.titulo}
                secondary={n.cuerpo}
                primaryTypographyProps={{ fontWeight: n.leida ? 'normal' : 'bold', fontSize: 14 }}
                secondaryTypographyProps={{ fontSize: 12 }}
                sx={{ ml: n.leida ? '16px' : 0 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Popover>
    </>
  );
}
