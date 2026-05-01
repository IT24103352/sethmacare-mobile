import React from 'react';
import Loading from '../components/Loading';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import DashboardNavigator from './DashboardNavigator';

const AppNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  if (!user) {
    return <AuthNavigator />;
  }

  return <DashboardNavigator />;
};

export default AppNavigator;
