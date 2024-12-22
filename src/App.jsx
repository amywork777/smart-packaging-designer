import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PackagingLanding from './pages/PackagingLanding';
import PackagingDesign from './components/PackagingDesign';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PackagingLanding />} />
        <Route path="/design" element={<PackagingDesign />} />
      </Routes>
    </Router>
  );
}

export default App; 