import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ConfirmProvider } from "./ui";
import { ToastProvider, TooltipProvider } from "./ui/op";
import { migrateStorage } from "./lib/migrateStorage";
import "./ui/openpier.css";

migrateStorage(window.localStorage);
const root = ReactDOM.createRoot(document.getElementById("root")!);
if (import.meta.env.DEV && window.location.hash === "#/dev/gallery") {
  void import("./dev/Gallery").then(({ default: Gallery }) => root.render(<Gallery />));
} else {
  root.render(
    <ConfirmProvider>
      <TooltipProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </TooltipProvider>
    </ConfirmProvider>,
  );
}
