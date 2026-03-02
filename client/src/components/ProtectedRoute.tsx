import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

/**
 * A wrapper for routes that require authentication.
 * If the user is missing a JWT token, they are redirected to /signin.
 */
const ProtectedRoute = () => {
    const { token } = useAuthStore();

    if (!token) {
        return <Navigate to="/signin" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
