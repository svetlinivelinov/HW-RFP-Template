import { Routes, Route, Navigate } from 'react-router-dom';
import DraftsList from './pages/DraftsList';
import DraftEditor from './pages/DraftEditor';

function App() {
  return (
    <Routes>
      <Route path="/" element={<DraftsList />} />
      <Route path="/draft/:id" element={<DraftEditor />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
