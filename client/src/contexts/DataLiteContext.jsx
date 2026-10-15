import { createContext, useContext, useState, useEffect } from 'react';

const DataLiteContext = createContext(null);

export const DataLiteProvider = ({ children }) => {
  const [dataLiteMode, setDataLiteMode] = useState(() => {
    return localStorage.getItem('dataLiteMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('dataLiteMode', dataLiteMode);
  }, [dataLiteMode]);

  const toggleDataLite = () => {
    setDataLiteMode(prev => !prev);
  };

  const value = {
    dataLiteMode,
    toggleDataLite,
    setDataLiteMode
  };

  return <DataLiteContext.Provider value={value}>{children}</DataLiteContext.Provider>;
};

export const useDataLite = () => {
  const context = useContext(DataLiteContext);
  if (!context) {
    throw new Error('useDataLite must be used within a DataLiteProvider');
  }
  return context;
};
