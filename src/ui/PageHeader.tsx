import { ReactNode } from "react";

export default function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {actions}
    </header>
  );
}
