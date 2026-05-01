# 🏥 SethmaCare E-Channeling Mobile Application

Welcome to the **SethmaCare E-Channeling System**, a comprehensive, role-based mobile application designed to streamline healthcare management for clinics and hospitals. Built with a modern tech stack, this application handles everything from patient appointment booking to complex financial distributions.

## 🌟 Key Features

- **Multi-Role Architecture:** Dedicated secure portals for 6 distinct user types: **Admin, Doctor, Patient, Pharmacist, Receptionist, and Accountant**.
- **Interactive Appointment Booking:** Patients can seamlessly browse doctors, select available time slots, and complete bookings using an interactive, validated mock payment gateway (Card, Online, Cash).
- **Advanced Prescription Management:** Doctors can digitally prescribe medicines from the clinic's inventory. Pharmacists receive real-time queues for pending prescriptions and manage safe dispensing only after patient payments are confirmed.
- **Automated Financial & Salary System:**
  - Calculates real-time Pharmacy Fees based on medicine quantity and unit price.
  - Features a dynamic Salary Distribution engine: Automatically calculates a 70% consultation fee cut for Doctors, routing the remaining 30% plus pharmacy income into an organization pool to pay staff salaries.
- **Role-Specific Dashboards:** Custom statistical dashboards for each role to track pending appointments, completed prescriptions, and revenue.

## 🛠️ Technology Stack

- **Frontend:** React Native (Expo)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JSON Web Tokens (JWT) & SecureStore

## 🚀 Getting Started (Local Development)

### Prerequisites

- Node.js installed
- Expo CLI installed (`npm install -g expo-cli`)
- A running MongoDB instance (Local or Atlas)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/IT24103352/sethmacare-mobile.git
   cd sethmacare-mobile
   ```

2. **Setup the Backend**

   ```bash
   cd backend
   npm install
   ```

   _Create a `.env` file in the `backend` directory with your `MONGO_URI`, `PORT`, and `JWT_SECRET`._

   ```bash
   npm run dev
   ```

3. **Setup the Frontend**

   ```bash
   cd ../frontend
   npm install
   npx expo start
   ```

## 🔐 Test Accounts (Demo)

_The database includes seed data for quick evaluation. All accounts use the password:_ `password123`

| Role         | Email                   |
| ------------ | ----------------------- |
| Admin        | `admin@test.com`        |
| Doctor       | `doctor@test.com`       |
| Patient      | `patient@test.com`      |
| Pharmacist   | `pharmacist@test.com`   |
| Receptionist | `receptionist@test.com` |
| Accountant   | `accountant@test.com`   |

---

**Happy coding! 🚀**
