import { Chip, type ChipProps } from '@mui/material';

/**
 * Display label and chip color for each order status.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const ESTATUS_INFO: Record<string, { label: string; color: ChipProps['color'] }> = {
  PENDIENTE: { label: 'Pendiente', color: 'default' },
  ESPERANDO_CONFIRMACION: { label: 'Esperando confirmación', color: 'warning' },
  EN_PREPARACION: { label: 'En preparación', color: 'info' },
  LISTO: { label: 'Listo', color: 'success' },
  EN_CAMINO: { label: 'En camino', color: 'primary' },
  ENTREGADO: { label: 'Entregado', color: 'success' },
  SOLICITUD_CANCELACION: { label: 'Solicitud de cancelación', color: 'error' },
  CANCELADO: { label: 'Cancelado', color: 'error' },
};

/**
 * Returns the human-readable label for an order status, falling back to the raw value.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} estatus - Order status code (e.g. "EN_PREPARACION").
 * @returns {string} The display label.
 */
export function etiquetaEstatus(estatus: string): string {
  return ESTATUS_INFO[estatus]?.label ?? estatus;
}

/**
 * Colored MUI chip showing an order status.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} props - Component props.
 * @param {string} props.estatus - Order status code.
 * @param {ChipProps['size']} [props.size] - Chip size (defaults to "small").
 * @returns {JSX.Element} The status chip.
 */
export default function EstatusChip({ estatus, size = 'small' }: { estatus: string; size?: ChipProps['size'] }) {
  const info = ESTATUS_INFO[estatus];
  return <Chip label={info?.label ?? estatus} color={info?.color ?? 'default'} size={size} />;
}
