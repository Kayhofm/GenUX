import React, { createContext, useState, useContext } from 'react';

const FormContext = createContext();

export function FormProvider({ children }) {
  const [formValues, setFormValues] = useState({});

  const updateFormValue = (id, value) => {
    setFormValues(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const getFormValues = () => formValues;

  const clearFormValues = () => {
    setFormValues({});
  };

  return (
    <FormContext.Provider value={{ formValues, updateFormValue, getFormValues, clearFormValues }}>
      {children}
    </FormContext.Provider>
  );
}

export const useFormContext = () => useContext(FormContext);
