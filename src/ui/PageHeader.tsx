import { ReactNode } from "react";

export default function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 pb-5">
      <h1>{title}</h1>
      {actions}
    </header>
  );
}
