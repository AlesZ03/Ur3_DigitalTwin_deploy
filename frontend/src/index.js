import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
const amplifyConfig = {
  API: {
    GraphQL: {
      endpoint: process.env.REACT_APP_APPSYNC_URL,
      region: process.env.REACT_APP_APPSYNC_REGION,
      defaultAuthMode: 'apiKey',
      apiKey: process.env.REACT_APP_APPSYNC_API_KEY
    }
  }
};

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Configure Amplify using the modern, nested v6+ structure


const root = ReactDOM.createRoot(document.getElementById('root'));

// Check if all necessary values are present before configuring.
const gqlConfig = amplifyConfig.API?.GraphQL;
if (
  !gqlConfig?.endpoint ||
  !gqlConfig?.region ||
  !gqlConfig?.apiKey
) {
  console.error("Hiba: Egy vagy több Amplify konfigurációs érték hiányzik. Ellenőrizd a környezeti változókat (REACT_APP_... az Amplify build beállításaiban).");
  console.error("Kapott értékek:", {
    url: gqlConfig?.endpoint,
    region: gqlConfig?.region,
    apiKey: gqlConfig?.apiKey ? 'Létezik' : 'Hiányzik vagy üres'
  });

  // Display an error message to the user instead of a blank page.
  root.render(
    <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#ff4d4d', backgroundColor: '#1a0000', minHeight: '100vh' }}>
      <h1>Konfigurációs Hiba</h1>
      <p>Az alkalmazás nincs megfelelően beállítva. A szükséges AWS erőforrások (pl. AppSync API) adatai hiányoznak.</p>
      <p>Kérlek, ellenőrizd a böngésző konzolját a részletekért, és győződj meg róla, hogy a Terraform `apply` sikeresen lefutott és az Amplify build befejeződött.</p>
    </div>
  );
} else {
  // If everything is fine, configure Amplify and render the app.
  Amplify.configure(amplifyConfig);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
