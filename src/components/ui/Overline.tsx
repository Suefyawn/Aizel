import React from 'react';

export function Overline({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span className="overline" style={style}>{children}</span>
  );
}
