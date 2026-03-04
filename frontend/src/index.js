import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Configure Amplify
const amplifyConfig = {
  aws_appsync_graphqlEndpoint: process.env.REACT_APP_APPSYNC_URL,
  aws_appsync_region: process.env.REACT_APP_APPSYNC_REGION,
  aws_appsync_authenticationType: 'API_KEY',
  aws_appsync_apiKey: process.env.REACT_APP_APPSYNC_API_KEY,
};

const root = ReactDOM.createRoot(document.getElementById('root'));

// Mielőtt konfigurálnánk az Amplify-t, ellenőrizzük, hogy minden szükséges érték megvan-e.
// Ha valamelyik hiányzik (pl. undefined), az Amplify hibát dobna, ami a "fehér oldal" jelenséget okozza.
if (
  !amplifyConfig.aws_appsync_graphqlEndpoint ||
  !amplifyConfig.aws_appsync_region ||
  !amplifyConfig.aws_appsync_apiKey
) {
  console.error("Hiba: Egy vagy több Amplify konfigurációs érték hiányzik. Ellenőrizd a környezeti változókat (REACT_APP_... az Amplify build beállításaiban).");
  console.error("Kapott értékek:", {
    url: amplifyConfig.aws_appsync_graphqlEndpoint,
    region: amplifyConfig.aws_appsync_region,
    apiKey: amplifyConfig.aws_appsync_apiKey ? 'Létezik' : 'Hiányzik vagy üres'
  });

  // Jelenítsünk meg egy hibaüzenetet a felhasználónak a fehér oldal helyett.
  root.render(
    <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#ff4d4d', backgroundColor: '#1a0000', minHeight: '100vh' }}>
      <h1>Konfigurációs Hiba</h1>
      <p>Az alkalmazás nincs megfelelően beállítva. A szükséges AWS erőforrások (pl. AppSync API) adatai hiányoznak.</p>
      <p>Kérlek, ellenőrizd a böngésző konzolját a részletekért, és győződj meg róla, hogy a Terraform `apply` sikeresen lefutott és az Amplify build befejeződött.</p>
    </div>
  );
} else {
  // Ha minden rendben, konfiguráljuk az Amplify-t és rendereljük az alkalmazást.
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
