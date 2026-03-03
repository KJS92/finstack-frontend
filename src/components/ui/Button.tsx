import React from 'react';
import { theme } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
}

const styles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: theme.colors.btnPrimary,
    color: theme.colors.btnPrimaryText,
    border: 'none',
  },
  secondary: {
    backgroundColor: theme.colors.card,
    color: theme.colors.btnPrimary,
    border: `1px solid ${theme.colors.btnPrimary}`,
  },
  danger: {
    backgroundColor: theme.colors.btnDanger,
    color: theme.colors.btnDangerText,
    border: `1px solid ${theme.colors.btnDangerBorder}`,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: 'none',
  },
};

const sizes: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: '36px', padding: '0 12px', fontSize: theme.fontSizes.label },
  md: { height: '44px', padding: '0 20px', fontSize: theme.fontSizes.body },
  lg: { height: '52px', padding: '0 24px', fontSize: '16px' },
};

export const Button: React.FC<ButtonProps> = ({
  label, onClick, variant = 'primary',
  size = 'md', disabled = false,
  loading = false, fullWidth = false,
  type = 'button',
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    style={{
      ...styles[variant],
      ...sizes[size],
      borderRadius: theme.radius.md,
      fontWeight: theme.fontWeights.semibold,
      fontFamily: 'Inter, sans-serif',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      width: fullWidth ? '100%' : 'auto',
      transition: 'opacity 0.15s, background-color 0.15s',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    }}
  >
    {loading ? '...' : label}
  </button>
);
