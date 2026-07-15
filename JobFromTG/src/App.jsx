import Home from "./pages/Home.jsx";
import Fav from "./pages/Fav.jsx";
import { FilterProvider } from "./Components/FilterContext.jsx";
import NavBar from './Components/NavBar.jsx'
import {JobProvider} from './Components/JobContext.jsx'
import {Routes, Route} from 'react-router-dom'
function App() {
  return (
    <JobProvider>
    <main>
      <FilterProvider>
      <NavBar/>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/favorite" element={<Fav />} />
      </Routes>
      </FilterProvider>
    </main>
    </JobProvider>
  );
}

export default App;
