import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "@/App.css";
import { getToken, clearToken } from "@/lib/api";
import Login from "@/components/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/components/Dashboard";
import Companies from "@/components/Companies";
import CompanyDetail from "@/components/CompanyDetail";
import Persons from "@/components/Persons";
import OsnivanjeDOO from "@/components/OsnivanjeDOO";
import EvidencijaRada from "@/components/EvidencijaRada";
import SpecijalnoPunomoce from "@/components/SpecijalnoPunomoce";
import Documents from "@/components/Documents";
import PdvTracking from "@/components/PdvTracking";
import AgencySettings from "@/components/AgencySettings";

const RequireAuth = ({ children }) => {
  const location = useLocation();
  const token = getToken();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

function App() {
  const [, force] = useState(0);

  useEffect(() => {
    const onStorage = () => force((v) => v + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="firme" element={<Companies />} />
          <Route path="firme/:id" element={<CompanyDetail />} />
          <Route path="osnivanje" element={<OsnivanjeDOO />} />
          <Route path="specijalno-punomocje" element={<SpecijalnoPunomoce />} />
          <Route path="evidencija-rada" element={<EvidencijaRada />} />
          <Route path="fizicka-lica" element={<Persons />} />
          <Route path="dokumenti" element={<Documents />} />
          <Route path="pdv-ioppd" element={<PdvTracking />} />
          <Route path="agencija" element={<AgencySettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export { clearToken };
export default App;
