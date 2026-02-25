import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

async function init() {
  if (import.meta.env.VITE_MOCK === '1') {
    const { install } = await import('./mock/index.js');
    await install();
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

init();
