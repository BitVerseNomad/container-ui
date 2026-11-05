import { ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon, IconName } from "./ui/icons";

// removed: useConfirm from ./ui since Empty doesn't need it

export type EmptySize = "sm" | "md" | "lg";

interface EmptyProps {
  title?: string;
  description?: string;
  action?: string;
  size?: EmptySize;
  children?: ReactNode;
}

export function Empty({ title, description, action, size = "md", children }: EmptyProps) {
  const sizeStyles = {
    sm: { iconSize: 40, titleFontSize: 16, descFontSize: 13, gap: 16 },
    md: { iconSize: 60, titleFontSize: 20, descFontSize: 16, gap: 24 },
    lg: { iconSize: 80, titleFontSize: 28, descFontSize: 20, gap: 32 },
  }[size];

  return (
    <div className="empty" role="status" aria-live="polite" style={{
      fontSize: sizeStyles.titleFontSize,
      color: "var(--ink)",
      gap: sizeStyles.gap,
      textAlign: "center"
    }}>
      <Icon name="info" size={sizeStyles.iconSize} className="empty-icon" />
      {title && <h3 className="empty-title">{title}</h3>}
      {description && <p className="empty-content">{description}</p>}
      {children && <span className="empty-children">{children}</span>}
    </div>
  );
}