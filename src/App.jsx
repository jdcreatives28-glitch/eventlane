// src/App.jsx
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppShell from "./Appshell";
import UnreadProvider from "./context/UnreadProvider";

export default function App() {
  return (
    <Router>
      <UnreadProvider>
        <AppShell />
      </UnreadProvider>
    </Router>
  );
}
