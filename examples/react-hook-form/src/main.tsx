import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SignupForm } from "./SignupForm";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <SignupForm />
  </StrictMode>
);
