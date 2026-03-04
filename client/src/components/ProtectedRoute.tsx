import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

/**
 * Check if a JWT token has expired by decoding its payload.
 */
function isTokenExpired(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        // exp is in seconds, Date.now() is in ms
        return payload.exp ? payload.exp * 1000 < Date.now() : false;
    } catch {
        return true; // Malformed token → treat as expired
    }
}

/**
 * A wrapper for routes that require authentication.
 * If the user is missing a JWT token or it has expired, they are redirected to /signin.
 */
const ProtectedRoute = () => {
    const { token, logout } = useAuthStore();

    if (!token || isTokenExpired(token)) {
        // Clear stale auth state if the token is expired
        if (token) logout();
        return <Navigate to="/signin" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
