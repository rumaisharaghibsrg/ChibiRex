import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './context/StoreContext.jsx';
import { TimeSimulationProvider } from './context/TimeSimulationContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <StoreProvider>
            <TimeSimulationProvider>
                <App />
            </TimeSimulationProvider>
        </StoreProvider>
    </React.StrictMode>,
);
