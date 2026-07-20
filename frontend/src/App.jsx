import { Navigate, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import WorkerProfile from "./pages/WorkerProfile.jsx";
import WorkerRegister from "./pages/WorkerRegister.jsx";
import WorkerLogin from "./pages/WorkerLogin.jsx";
import WorkerDashboard from "./pages/WorkerDashboard.jsx";
import CustomerAuth from "./pages/CustomerAuth.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import WorkerChangePassword from "./pages/WorkerChangePassword.jsx";
import WorkerProfileEdit from "./pages/WorkerProfileEdit.jsx";

function WorkerProtectedRoute({ children }) {
  return localStorage.getItem("workerToken") ? children : <Navigate to="/worker/login" replace />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/worker/:id" element={<WorkerProfile />} />
        <Route path="/worker/register" element={<WorkerRegister />} />
        <Route path="/worker/login" element={<WorkerLogin />} />
        <Route path="/worker/dashboard" element={<WorkerDashboard />} />
        <Route path="/customer/login" element={<CustomerAuth />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/worker/change-password" element={<WorkerProtectedRoute><WorkerChangePassword /></WorkerProtectedRoute>} />
        <Route path="/worker/profile/edit" element={<WorkerProfileEdit />} />
      </Routes>
    </div>
  );
}
