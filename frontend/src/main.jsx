import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import './style.css';
import './pages.css';
import {JourneyProvider} from './JourneyContext.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import RouteForecasts from './pages/RouteForecasts.jsx';
import {NavigationPage,AiPage,ArPage,AboutPage,NotFound} from './pages/Tools.jsx';
import TrafficInformation from './pages/TrafficInformation.jsx';
import {GovernmentProvider,ProtectedGovernment} from './government/Auth.jsx';
import {GovernmentLogin,GovernmentLayout,GovernmentDashboard,GovernmentAnalytics,AlertManagement} from './pages/Government.jsx';
createRoot(document.getElementById('root')).render(<BrowserRouter><JourneyProvider><Routes><Route element={<Layout/>}>
<Route index element={<Home/>}/><Route path="navigation" element={<NavigationPage/>}/><Route path="ai-predictions" element={<AiPage/>}/><Route path="ar-navigation" element={<ArPage/>}/><Route path="traffic-information" element={<TrafficInformation/>}/><Route path="about" element={<AboutPage/>}/>
<Route path="route-forecasts" element={<RouteForecasts/>}/>
<Route path="government" element={<GovernmentProvider/>}><Route path="login" element={<GovernmentLogin/>}/><Route element={<ProtectedGovernment/>}><Route element={<GovernmentLayout/>}><Route path="dashboard" element={<GovernmentDashboard/>}/><Route path="analytics" element={<GovernmentAnalytics/>}/><Route path="alerts" element={<AlertManagement/>}/></Route></Route></Route><Route path="*" element={<NotFound/>}/>
</Route></Routes></JourneyProvider></BrowserRouter>);
