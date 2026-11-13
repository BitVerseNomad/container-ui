import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ConfirmProvider } from "./ui";
import { migrateStorage } from "./lib/migrateStorage";
import "./ui/openpier.css";

migrateStorage(window.localStorage);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConfirmProvider>
    <App />
  </ConfirmProvider>,
);
