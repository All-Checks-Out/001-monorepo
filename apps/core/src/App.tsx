import AuthProvider from "@frontend/auth/session/AuthProvider";
import ThemeProvider from "@frontend/auth/session/ThemeProvider";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CORE_BASE_PATH } from "./constants/routes";
import { CoreApp } from "./CoreApp";

const App = () => {
  return (
    <BrowserRouter basename={CORE_BASE_PATH}>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/*" element={<CoreApp />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
