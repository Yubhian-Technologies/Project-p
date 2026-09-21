import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { Role } from "../types/user";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { ROUTES } from "../config/routes";

interface ProtectedRouteProps {
  allowedRoles: Role[];
  children: ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { currentUser, role, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!currentUser) return <Navigate to={ROUTES.login} replace />;
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={ROUTES.unauthorized} replace />;
  }

  return <>{children}</>;
}
