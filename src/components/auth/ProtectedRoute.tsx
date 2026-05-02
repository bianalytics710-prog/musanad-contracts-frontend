/**
 * ProtectedRoute — gate for authenticated subtrees.
 *
 * The TanStack Router `_app` layout already enforces authentication at
 * the route level via `beforeLoad`. This component is the equivalent
 * for ad-hoc protected sub-views (e.g. modals or marketing-shell pages
 * that occasionally require a session). Use the route-level guard for
 * top-level pages and this component only when needed at runtime.
 */
import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import {
  selectHasPermission,
  selectIsAuthenticated,
  useAuthStore,
} from "@/store/auth.store";

export interface ProtectedRouteProps {
  /** Permission code (e.g. "user.manage") required to access children. */
  requirePermission?: string;
  /** Where to send unauthenticated visitors. Defaults to /auth/login. */
  loginPath?: string;
  /** Where to send authenticated-but-unauthorised visitors. Defaults to /app. */
  forbiddenPath?: string;
  children: ReactNode;
}

export function ProtectedRoute({
  requirePermission,
  loginPath = "/auth/login",
  forbiddenPath = "/app",
  children,
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const hasPermission = useAuthStore(
    requirePermission ? selectHasPermission(requirePermission) : () => true,
  );

  if (!isAuthenticated) {
    return <Navigate to={loginPath} replace />;
  }
  if (requirePermission && !hasPermission) {
    return <Navigate to={forbiddenPath} replace />;
  }
  return <>{children}</>;
}

export default ProtectedRoute;
