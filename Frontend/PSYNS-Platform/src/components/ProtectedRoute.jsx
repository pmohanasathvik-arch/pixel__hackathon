// UI-level route guard for this demo. Production authorization must also be enforced server-side.
import React from "react";
export default function ProtectedRoute({ user, children }) {
  if (!user) return null;
  return children;
}