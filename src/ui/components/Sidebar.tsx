"use client";

import * as React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const Sidebar = ({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  ...props
}: React.ComponentProps<"aside"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}) => {
  const [open, setOpen] = React.useState(true);
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      data-side={side}
      data-variant={variant}
      data-collapsible={collapsible}
      data-collapsed={collapsed}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-line bg-bg-raised transition-all duration-200",
        {
          "w-64": !collapsed,
          "w-16": collapsed && variant === "sidebar",
        },
        props.className
      )}
      {...props}
    >
      <div className="flex h-full flex-col">
        {props.children}
      </div>
    </aside>
  );
};
Sidebar.displayName = "Sidebar";

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-16 shrink-0 items-center gap-2 overflow-hidden p-4", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex shrink-0 items-center gap-2 overflow-hidden p-4", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex grow overflow-y-auto", className)} {...props} />
));
SidebarContent.displayName = "SidebarContent";

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />
));
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-h-sm shrink-0 items-center rounded-sm px-2 text-xs font-medium text-fg-muted", className)}
    {...props}
  />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("w-full min-w-0", className)} {...props} />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn(className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
  "flex w-full items-center gap-2 overflow-hidden rounded-sm px-2 py-1.5 text-sm outline-none ring-focus transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "text-fg hover:bg-accent-fill hover:text-accent",
        outline: "bg-transparent text-fg hover:bg-accent-fill hover:text-accent",
      },
      size: {
        default: "h-9 text-sm",
        sm: "h-h-sm text-xs",
        lg: "h-h-md text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    isActive?: boolean;
    variant?: "default" | "outline";
    size?: "default" | "sm" | "lg";
  }
>(({ asChild = false, isActive, variant = "default", size = "default", className, children, ...props }, ref) => {
  const Comp = asChild ? "button" : "button";
  return (
    <Comp
      ref={ref}
      data-active={isActive}
      className={cn(
        sidebarMenuButtonVariants({ variant, size }),
        isActive && "bg-accent-fill text-accent font-medium",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("flex w-full min-w-0 flex-col gap-1 pl-6", className)} {...props} />
));
SidebarMenuSub.displayName = "SidebarMenuSub";

const SidebarMenuSubButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    size?: "default" | "sm" | "lg";
  }
>(({ asChild = false, size = "default", className, children, ...props }, ref) => {
  const Comp = asChild ? "button" : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "flex w-full items-center gap-2 overflow-hidden rounded-sm px-2 py-1.5 text-sm outline-none ring-focus transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-h-sm text-xs",
        size === "lg" && "h-h-md text-base",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

const SidebarCollapse = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "flex size-h-md items-center justify-center rounded-sm border border-line bg-bg-raised text-fg-muted transition-colors hover:bg-accent-fill hover:text-accent",
      className
    )}
    {...props}
  >
    <PanelLeftClose className="h-4 w-4" />
    <PanelLeftOpen className="h-4 w-4 rotate-180" />
  </button>
));
SidebarCollapse.displayName = "SidebarCollapse";

export {
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarCollapse,
};