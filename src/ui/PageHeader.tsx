import { ReactNode } from "react";

export default function PageHeader({ breadcrumb, title, status }: { breadcrumb: string; title: string; status?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <div className="crumb">{breadcrumb}</div>
        <h1>{title}</h1>
      </div>
      {status}
    </header>
  );
}
