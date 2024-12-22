import React, { useState } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface BudgetSelectorProps {
  quantity: number;
  onBudgetChange: (budget: any) => void;
}

const BudgetSelector = ({ quantity, onBudgetChange }: BudgetSelectorProps) => {
  const [budget, setBudget] = useState({ min: '', max: '' });

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const handleBudgetChange = (value: string, type: 'min' | 'max') => {
    // Allow empty string or numbers only
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const newBudget = {
        ...budget,
        [type]: value
      };
      setBudget(newBudget);

      // Only calculate if we have a valid number
      const parsedValue = parseFloat(value) || 0;
      onBudgetChange({
        total: {
          [type]: parsedValue
        },
        perUnit: {
          [type]: quantity > 0 ? parsedValue / quantity : 0
        }
      });
    }
  };

  const hasErrors = parseFloat(budget.max) < parseFloat(budget.min);

  return (
    <div className="space-y-6">
      {/* Budget Inputs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-medium">Budget Range</Label>
          <div className="text-sm text-gray-500">
            For {quantity} {quantity === 1 ? 'unit' : 'units'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Minimum Budget */}
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
              <Input
                type="text"
                value={budget.min}
                onChange={(e) => handleBudgetChange(e.target.value, 'min')}
                className="pl-8 h-14 text-lg"
                placeholder="0.00"
              />
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-600">Minimum Total</span>
              {budget.min && quantity > 0 && (
                <span className="text-blue-600 font-medium">
                  ${(parseFloat(budget.min) / quantity).toFixed(2)} per unit
                </span>
              )}
            </div>
          </div>

          {/* Maximum Budget */}
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
              <Input
                type="text"
                value={budget.max}
                onChange={(e) => handleBudgetChange(e.target.value, 'max')}
                className="pl-8 h-14 text-lg"
                placeholder="0.00"
              />
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-600">Maximum Total</span>
              {budget.max && quantity > 0 && (
                <span className="text-blue-600 font-medium">
                  ${(parseFloat(budget.max) / quantity).toFixed(2)} per unit
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {hasErrors && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-800">
          Maximum budget must be greater than minimum budget
        </div>
      )}
    </div>
  );
};

export default BudgetSelector; 