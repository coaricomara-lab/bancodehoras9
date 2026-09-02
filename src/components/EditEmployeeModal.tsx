import React from 'react';
import { ConstructionSite, Employee } from '../types';
import { EmployeeFormModal } from './EmployeeFormModal';

export interface EditEmployeeModalProps {
  employee: Employee;
  employees?: Employee[];
  constructionSites?: ConstructionSite[];
  theme?: 'dark' | 'light';
  isSaving?: boolean;
  error?: string;
  onClose: () => void;
  onSave?: (employee: Employee) => Promise<void> | void;
  onSaveSuccess?: (savedEmployee: Employee, allUpdatedEmployees?: Employee[]) => void;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  employee,
  employees = [],
  constructionSites = [],
  theme = 'dark',
  onClose,
  onSave,
  onSaveSuccess,
}) => {
  return (
    <EmployeeFormModal
      isOpen={true}
      employee={employee}
      employees={employees}
      constructionSites={constructionSites}
      theme={theme}
      onClose={onClose}
      onSaveSuccess={(savedEmp, updatedList) => {
        onSave?.(savedEmp);
        onSaveSuccess?.(savedEmp, updatedList);
      }}
    />
  );
};

export default EditEmployeeModal;
