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

Amplify.configure(amplifyConfig);


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
