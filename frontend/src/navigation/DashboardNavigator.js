import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminDashboard from '../screens/admin/AdminDashboard';
import ManageUsersScreen from '../screens/admin/ManageUsersScreen';
import AdminAddUser from '../screens/admin/AdminAddUser';
import ManageAnnouncementsScreen from '../screens/admin/ManageAnnouncementsScreen';
import ManageTicketsScreen from '../screens/admin/ManageTicketsScreen';
import PatientDashboard from '../screens/patient/PatientDashboard';
import DoctorListScreen from '../screens/patient/DoctorListScreen';
import BookAppointmentScreen from '../screens/patient/BookAppointmentScreen';
import MyAppointmentsScreen from '../screens/patient/MyAppointmentsScreen';
import MyPrescriptionsScreen from '../screens/patient/MyPrescriptionsScreen';
import MyPaymentsScreen from '../screens/patient/MyPaymentsScreen';
import DoctorDashboard from '../screens/doctor/DoctorDashboard.js';
import DoctorAppointmentsScreen from '../screens/doctor/DoctorAppointmentsScreen';
import DoctorScheduleScreen from '../screens/doctor/DoctorScheduleScreen.js';
import ManagePrescriptions from '../screens/doctor/ManagePrescriptions';
import CreatePrescription from '../screens/doctor/CreatePrescription';
import ReceptionistDashboard from '../screens/receptionist/ReceptionistDashboard';
import ManageAppointmentsScreen from '../screens/receptionist/ManageAppointmentsScreen';
import ManageSchedulesScreen from '../screens/receptionist/ManageSchedulesScreen';
import AccountantDashboard from '../screens/accountant/AccountantDashboard';
import ManagePaymentsScreen from '../screens/accountant/ManagePaymentsScreen';
import ManageSalariesScreen from '../screens/accountant/ManageSalariesScreen';
import PharmacistDashboard from '../screens/pharmacist/PharmacistDashboard';
import ManagePharmacistPrescriptionsScreen from '../screens/pharmacist/ManagePrescriptionsScreen';
import MedicineStockScreen from '../screens/pharmacist/MedicineStockScreen';
import AddMedicineScreen from '../screens/pharmacist/AddMedicineScreen';
import MyProfile from '../screens/shared/MyProfile.js';
import MyTicketsScreen from '../screens/shared/MyTicketsScreen';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

const Stack = createNativeStackNavigator();

const DashboardNavigator = () => {
  const { user } = useAuth();

  const renderRoleDashboard = () => {
    switch (user?.role) {
      case 'Admin':
        return (
          <>
            <Stack.Screen name="AdminHome" component={AdminDashboard} options={{ title: 'Admin Dashboard' }} />
            <Stack.Screen name="ManageUsers" component={ManageUsersScreen} options={{ title: 'Manage Users' }} />
            <Stack.Screen name="AdminAddUser" component={AdminAddUser} options={{ title: 'Add User' }} />
            <Stack.Screen name="ManageAnnouncements" component={ManageAnnouncementsScreen} options={{ title: 'Manage Announcements' }} />
            <Stack.Screen name="ManageTickets" component={ManageTicketsScreen} options={{ title: 'Manage Tickets' }} />
          </>
        );
      case 'Patient':
        return (
          <>
            <Stack.Screen name="PatientHome" component={PatientDashboard} options={{ title: 'Patient Dashboard' }} />
            <Stack.Screen name="DoctorList" component={DoctorListScreen} options={{ title: 'Doctors' }} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ title: 'Book Appointment' }} />
            <Stack.Screen name="MyAppointments" component={MyAppointmentsScreen} options={{ title: 'My Appointments' }} />
            <Stack.Screen name="MyPrescriptions" component={MyPrescriptionsScreen} options={{ title: 'My Prescriptions' }} />
            <Stack.Screen name="MyPayments" component={MyPaymentsScreen} options={{ title: 'My Payments' }} />
          </>
        );
      case 'Doctor':
        return (
          <>
            <Stack.Screen name="DoctorHome" component={DoctorDashboard} options={{ title: 'Doctor Dashboard' }} />
            <Stack.Screen name="DoctorAppointments" component={DoctorAppointmentsScreen} options={{ title: 'My Appointments' }} />
            <Stack.Screen name="DoctorSchedule" component={DoctorScheduleScreen} options={{ title: 'My Schedule' }} />
            <Stack.Screen name="ManagePrescriptions" component={ManagePrescriptions} options={{ title: 'Manage Prescriptions' }} />
            <Stack.Screen name="CreatePrescription" component={CreatePrescription} options={{ title: 'Create Prescription' }} />
          </>
        );
      case 'Receptionist':
        return (
          <>
            <Stack.Screen name="ReceptionistHome" component={ReceptionistDashboard} options={{ title: 'Receptionist Dashboard' }} />
            <Stack.Screen name="ManageAppointments" component={ManageAppointmentsScreen} options={{ title: 'Manage Appointments' }} />
            <Stack.Screen name="ManageSchedules" component={ManageSchedulesScreen} options={{ title: 'Manage Schedules' }} />
          </>
        );
      case 'Accountant':
        return (
          <>
            <Stack.Screen name="AccountantHome" component={AccountantDashboard} options={{ title: 'Accountant Dashboard' }} />
            <Stack.Screen name="ManagePayments" component={ManagePaymentsScreen} options={{ title: 'Manage Payments' }} />
            <Stack.Screen name="ManageSalaries" component={ManageSalariesScreen} options={{ title: 'Manage Salaries' }} />
          </>
        );
      case 'Pharmacist':
        return (
          <>
            <Stack.Screen name="PharmacistHome" component={PharmacistDashboard} options={{ title: 'Pharmacist Dashboard' }} />
            <Stack.Screen name="PendingPrescriptions" component={ManagePharmacistPrescriptionsScreen} options={{ title: 'Manage Prescriptions' }} />
            <Stack.Screen name="MedicineStock" component={MedicineStockScreen} options={{ title: 'Medicine Stock' }} />
            <Stack.Screen name="AddMedicine" component={AddMedicineScreen} options={{ title: 'Add Medicine' }} />
          </>
        );
      default:
        return <Stack.Screen name="PatientHome" component={PatientDashboard} options={{ title: 'Dashboard' }} />;
    }
  };

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      {renderRoleDashboard()}
      <Stack.Screen name="MyProfile" component={MyProfile} options={{ title: 'My Profile' }} />
      <Stack.Screen name="MyTickets" component={MyTicketsScreen} options={{ title: 'My Tickets' }} />
    </Stack.Navigator>
  );
};

export default DashboardNavigator;
