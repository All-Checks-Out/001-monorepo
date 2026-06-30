import AuthProvider from "@frontend/auth/session/AuthProvider";
import ThemeProvider from "@frontend/auth/session/ThemeProvider";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FORM_DESIGN_BASE_PATH } from "./constants/routes";
import { FormDesignApp } from "./FormDesignApp";

const App = () => {
  return (
    <BrowserRouter basename={FORM_DESIGN_BASE_PATH}>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/*" element={<FormDesignApp />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
