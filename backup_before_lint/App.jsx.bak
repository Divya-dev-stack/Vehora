import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './context/AuthProvider';
import ProtectedRoute from './routes/ProtectedRoute';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import VehicleForm from './pages/VehicleForm';
import MechanicDashboard from './pages/MechanicDashboard';
import Assistant from './pages/Assistant';
import AdminDashboard from './pages/AdminDashboard';
import Maintenance from './pages/Maintenance';
import FindMechanic from './pages/FindMechanic';
import AssistanceRequest from './pages/AssistanceRequest';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['user']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicles"
            element={
              <ProtectedRoute roles={['user']}>
                <Vehicles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicles/new"
            element={
              <ProtectedRoute roles={['user']}>
                <VehicleForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicles/:id/edit"
            element={
              <ProtectedRoute roles={['user']}>
                <VehicleForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mechanic"
            element={
              <ProtectedRoute roles={['mechanic']}>
                <MechanicDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/maintenance" element={<ProtectedRoute roles={['user']}><Maintenance /></ProtectedRoute>} />
          <Route path="/find-mechanic" element={<ProtectedRoute roles={['user']}><FindMechanic /></ProtectedRoute>} />
          <Route path="/assistance" element={<ProtectedRoute roles={['user']}><AssistanceRequest /></ProtectedRoute>} />
          <Route path="/assistant" element={<ProtectedRoute roles={['user']}><Assistant /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
