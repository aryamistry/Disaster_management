import './index.css';
import { AppProvider } from './context/AppContext.jsx';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import RiskMap from './components/RiskMap.jsx';
import BottomBar from './components/BottomBar.jsx';
import ToastContainer from './components/ToastContainer.jsx';

export default function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <Header />
        <Sidebar />
        <div className="main-content">
          <RiskMap />
          <BottomBar />
        </div>
      </div>
      <ToastContainer />
    </AppProvider>
  );
}
