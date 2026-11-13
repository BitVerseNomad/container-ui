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
  children: React.ReactNode;
}): React.JSX.Element {
  const { trigger, label, align, wide, children } = props;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={clsx("pop", wide && "wide")}
          aria-label={label}
          collisionPadding={8}
          align={align}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
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
        {shortcut && <span className="kbd">{shortcut}</span>}
      </span>
      {why && <span className="why">{why}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator(): React.JSX.Element {
  return <DropdownMenu.Separator className="menu-sep" />;
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