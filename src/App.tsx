import { Navigate, Route, Routes } from 'react-router-dom'
import { CustomerLayout } from './modules/customer/components/CustomerLayout'
import { CustomerHome } from './modules/customer/pages/CustomerHome'
import { DeliveryRequest } from './modules/customer/pages/DeliveryRequest'
import { AdminScheduling } from './modules/scheduling/pages/AdminScheduling'

function App() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<CustomerHome />} />
        <Route path="/request" element={<DeliveryRequest />} />
      </Route>
      <Route path="/admin/scheduling" element={<AdminScheduling />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
