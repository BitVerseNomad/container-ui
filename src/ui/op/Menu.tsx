import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

export function Menu(props: {
  trigger: React.ReactElement;
  label: string;
  align?: "start" | "end";
  wide?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { trigger, label, align, wide, open, onOpenChange, contentClassName, children } = props;
  // Open state lives here so Escape can close the menu even when it arrives before Radix has re-rendered its layers.
  const [ownOpen, setOwnOpen] = React.useState(false);
  const isOpen = open ?? ownOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setOwnOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );
  // An open menu owns Escape. A Sheet holding the menu also listens for Escape, and Radix can still have that listener
  // live for a moment after the menu opens, so this capture listener on window stops the key before the Sheet sees it.
  React.useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [isOpen, setOpen]);
  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={clsx("pop menu-fit z-50", wide && "wide", contentClassName)}
          aria-label={label}
          avoidCollisions
          collisionPadding={12}
          align={align}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuRadioGroup(props: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const { value, onValueChange, children } = props;
  return (
    <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
      {children}
    </DropdownMenu.RadioGroup>
  );
}

export function MenuRadioItem(props: {
  value: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { value, children } = props;
  return <DropdownMenu.RadioItem className="row" value={value}>{children}</DropdownMenu.RadioItem>;
}

export function MenuItem(props: {
  label: string;
  why?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  icon?: IconName;
  onSelect: () => void;
}): React.JSX.Element {
  const { label, why, shortcut, danger, disabled, icon, onSelect } = props;
  return (
    <DropdownMenu.Item
      className={clsx("menu-item", danger && "danger")}
      disabled={disabled}
      onSelect={() => onSelect()}
    >
      <span className="top">
        {icon && <Icon name={icon} size="sm" />}
        <span>{label}</span>
        {shortcut && <span className="ml-auto font-mono text-micro text-fg-faint">{shortcut}</span>}
      </span>
      {why && <span className="block text-meta text-fg-faint">{why}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator(): React.JSX.Element {
  return <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-line" />;
}

export function MenuCaption(props: { children: React.ReactNode }): React.JSX.Element {
  return <DropdownMenu.Label className="menu-cap">{props.children}</DropdownMenu.Label>;
}

export const MoreButton = React.forwardRef<
  HTMLButtonElement,
  { name: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function MoreButton(props, ref) {
  const { name, ...rest } = props;
  return (
    <Button
      {...rest}
      ref={ref}
      variant="ghost"
      iconOnly
      icon="more"
      aria-label={`More actions for ${name}`}
    />
  );
});