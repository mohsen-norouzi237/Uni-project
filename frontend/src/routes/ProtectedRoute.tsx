import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import LoadingState from '@/components/LoadingState';
import type { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
    /** Readonly so shared role tuples can be passed without copying. */
    allowedRoles?: readonly UserRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isLoading = useAuthStore((state) => state.isLoading);
    const location = useLocation();

    if (isLoading) {
        return <LoadingState message="در حال بررسی اطلاعات کاربر..." />;
    }

    if (!isAuthenticated) {
        // Full location (not just pathname) so query/hash survive the round trip.
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
}
