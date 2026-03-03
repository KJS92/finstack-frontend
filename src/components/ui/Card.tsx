import React from 'react';
import { theme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  padding?: string;
  style?: React.CSSProperties;
  accentColor?: string; // top border accent
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = theme.spacing.md,
  style,
  accentColor,
}) => (
  <div
    style={{
      backgroundColor: theme.colors.card,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      padding,
      boxShadow: theme.shadows.card,
      borderTop: accentColor ? `3px solid ${accentColor}` : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);
